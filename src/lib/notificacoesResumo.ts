import "server-only";
import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "@/lib/whatsapp";
import { janelaExecucao } from "@/lib/prazoEntrega";
import type { InstrumentoContratual } from "@/generated/prisma/client";

// Nova arquitetura de notificacoes diarias — Regina 08/07/2026 apos incidente
// de flood do Leo (11+ msgs individuais em 1s no cron matinal).
//
// Regras:
// - MAX 4 msgs/dia por usuario (cap global em dispararNotificacao)
// - 3 execucoes/dia, cada uma com conteudo diferente por janela
// - Cada execucao consolida TODOS os alertas relevantes em UMA msg por usuario
// - Espacamento de 1.5s entre disparos pra nao spammar a Z-API
// - Kill switch via env WHATSAPP_KILL_SWITCH=1 (guarda em dispararNotificacao)

const LABEL_INSTRUMENTO: Record<InstrumentoContratual, string> = {
  NOTA_EMPENHO: "Nota de Empenho",
  CARTA_CONTRATO: "Carta-Contrato",
  AUTORIZACAO_COMPRA: "Autorização de Compra",
  AUTORIZACAO_ENTREGA: "Autorização de Entrega",
  ORDEM_SERVICO: "Ordem de Serviço",
};

export type Janela = "MANHA" | "TARDE" | "NOITE";

type Item = {
  categoria: string;
  urgencia: number; // 5 = critico, 1 = informativo
  linha: string; // texto formatado com bullet
};

type MapaUsuarios = Map<string, Item[]>;

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function primeiroNome(nome: string): string {
  return nome.split(" ")[0] || nome;
}

function addItem(mapa: MapaUsuarios, usuarioId: string, item: Item): void {
  const arr = mapa.get(usuarioId) ?? [];
  arr.push(item);
  mapa.set(usuarioId, arr);
}

async function destinatariosDaConta(contaId: string) {
  return prisma.usuario.findMany({
    where: { contaId, optInWhatsApp: true, telefoneWhatsApp: { not: null } },
    select: { id: true, nome: true },
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// COLETORES — cada um retorna map usuarioId -> Item[]
// ============================================================

// MANHA: empenhos atrasados e entregas de HOJE.
async function coletarCriticosDoDia(inicioHoje: Date, amanha: Date): Promise<MapaUsuarios> {
  const mapa: MapaUsuarios = new Map();

  const empenhos = await prisma.empenho.findMany({
    where: { status: { in: ["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO"] } },
    select: {
      id: true, numero: true, instrumento: true, orgaoNome: true, status: true,
      vigenciaFim: true, dataPrevistaExecucao: true, prazoEntregaModo: true,
      dataEntregaCerta: true, dataEntregaInicio: true, dataEntregaFim: true,
      dataPedidoRecebido: true, prazoEntregaDias: true, prazoEntregaUnidade: true,
      empresa: { select: { contaId: true } },
    },
  });

  for (const e of empenhos) {
    const janela = janelaExecucao(e);
    const limite = janela.fim;
    const label = LABEL_INSTRUMENTO[e.instrumento];
    const usuarios = await destinatariosDaConta(e.empresa.contaId);
    if (!usuarios.length) continue;

    if (limite < inicioHoje) {
      const dias = Math.floor((inicioHoje.getTime() - limite.getTime()) / 86400000);
      for (const u of usuarios) {
        addItem(mapa, u.id, {
          categoria: "atrasado",
          urgencia: 5,
          linha: `🚨 ${label} ${e.numero} (${e.orgaoNome}) — atrasado ${dias}d`,
        });
      }
    } else if (limite >= inicioHoje && limite < amanha) {
      for (const u of usuarios) {
        addItem(mapa, u.id, {
          categoria: "hoje",
          urgencia: 5,
          linha: `⏰ ${label} ${e.numero} (${e.orgaoNome}) — entrega HOJE`,
        });
      }
    }
  }

  // Faturas CP System em atraso
  const cobrancasAtrasadas = await prisma.cobranca.findMany({
    where: { status: "ATRASADA" },
    select: { id: true, valor: true, vencimento: true, contaId: true },
  });
  for (const c of cobrancasAtrasadas) {
    const usuarios = await destinatariosDaConta(c.contaId);
    const dias = Math.floor((inicioHoje.getTime() - c.vencimento.getTime()) / 86400000);
    for (const u of usuarios) {
      addItem(mapa, u.id, {
        categoria: "fatura_atrasada",
        urgencia: 4,
        linha: `🔴 Fatura CP System de ${brl(c.valor)} atrasada há ${dias}d`,
      });
    }
  }

  return mapa;
}

// TARDE: alertas de acao imediata — D-5 a D-15 + NF sem pagto 30d+ +
// fatura CP System vencendo em 3 dias.
async function coletarAcaoImediata(inicioHoje: Date): Promise<MapaUsuarios> {
  const mapa: MapaUsuarios = new Map();
  const dias5 = new Date(inicioHoje.getTime() + 5 * 86400000);
  const dias6 = new Date(inicioHoje.getTime() + 6 * 86400000);
  const dias10 = new Date(inicioHoje.getTime() + 10 * 86400000);
  const dias11 = new Date(inicioHoje.getTime() + 11 * 86400000);
  const dias15 = new Date(inicioHoje.getTime() + 15 * 86400000);
  const dias16 = new Date(inicioHoje.getTime() + 16 * 86400000);
  const ha30d = new Date(inicioHoje.getTime() - 30 * 86400000);
  const em3d = new Date(inicioHoje.getTime() + 3 * 86400000);
  const em4d = new Date(inicioHoje.getTime() + 4 * 86400000);

  async function coletarVencendo(dias: number, inicio: Date, fim: Date) {
    const emoji = dias === 5 ? "🚨" : dias === 10 ? "🔔" : "⚠️";

    const atas = await prisma.ata.findMany({
      where: { vigenciaFim: { gte: inicio, lt: fim } },
      select: { id: true, numero: true, orgaoNome: true, empresa: { select: { contaId: true } } },
    });
    for (const a of atas) {
      const usuarios = await destinatariosDaConta(a.empresa.contaId);
      for (const u of usuarios) {
        addItem(mapa, u.id, {
          categoria: "vencendo",
          urgencia: dias === 5 ? 5 : 4,
          linha: `${emoji} Ata ${a.numero} (${a.orgaoNome}) — vence em ${dias}d`,
        });
      }
    }

    const contratos = await prisma.contrato.findMany({
      where: { vigenciaFim: { gte: inicio, lt: fim } },
      select: { id: true, numero: true, orgaoNome: true, empresa: { select: { contaId: true } } },
    });
    for (const c of contratos) {
      const usuarios = await destinatariosDaConta(c.empresa.contaId);
      for (const u of usuarios) {
        addItem(mapa, u.id, {
          categoria: "vencendo",
          urgencia: dias === 5 ? 5 : 4,
          linha: `${emoji} Contrato ${c.numero} (${c.orgaoNome}) — vence em ${dias}d`,
        });
      }
    }
  }

  await coletarVencendo(5, dias5, dias6);
  await coletarVencendo(10, dias10, dias11);
  await coletarVencendo(15, dias15, dias16);

  // NF sem pagamento 30d+ (dispara valor pra acionar cobranca do orgao)
  const empenhosNfPendente = await prisma.empenho.findMany({
    where: {
      status: { in: ["NF_EMITIDA", "NF_ENCAMINHADA"] },
      OR: [
        { dataNfEncaminhada: { lte: ha30d } },
        { AND: [{ dataNfEncaminhada: null }, { dataNfEmitida: { lte: ha30d } }] },
      ],
    },
    select: {
      id: true, numero: true, orgaoNome: true, instrumento: true,
      dataNfEmitida: true, dataNfEncaminhada: true,
      itens: { select: { valorTotal: true } },
      empresa: { select: { contaId: true } },
    },
  });
  for (const e of empenhosNfPendente) {
    const usuarios = await destinatariosDaConta(e.empresa.contaId);
    const valor = e.itens.reduce((s, i) => s + i.valorTotal, 0);
    const dataNf = e.dataNfEncaminhada ?? e.dataNfEmitida;
    const dias = dataNf ? Math.floor((inicioHoje.getTime() - dataNf.getTime()) / 86400000) : 30;
    const label = LABEL_INSTRUMENTO[e.instrumento];
    for (const u of usuarios) {
      addItem(mapa, u.id, {
        categoria: "nf_sem_pgto",
        urgencia: 3,
        linha: `💸 ${label} ${e.numero} (${e.orgaoNome}) — ${brl(valor)} sem pagto há ${dias}d`,
      });
    }
  }

  // Fatura CP System vence em 3 dias
  const cobrancasVencendo = await prisma.cobranca.findMany({
    where: { status: "PENDENTE", vencimento: { gte: em3d, lt: em4d } },
    select: { id: true, valor: true, vencimento: true, contaId: true },
  });
  for (const c of cobrancasVencendo) {
    const usuarios = await destinatariosDaConta(c.contaId);
    for (const u of usuarios) {
      addItem(mapa, u.id, {
        categoria: "fatura_vencendo",
        urgencia: 3,
        linha: `💳 Fatura CP System de ${brl(c.valor)} vence em 3d (${c.vencimento.toLocaleDateString("pt-BR")})`,
      });
    }
  }

  return mapa;
}

// NOITE: planejamento — D-30, D-60, D-90 + cartao expirando + garantias
// vencendo em D-30/60/90.
async function coletarPlanejamento(inicioHoje: Date): Promise<MapaUsuarios> {
  const mapa: MapaUsuarios = new Map();

  async function coletarVencendo(dias: number) {
    const inicio = new Date(inicioHoje.getTime() + dias * 86400000);
    const fim = new Date(inicioHoje.getTime() + (dias + 1) * 86400000);
    const emoji = dias === 30 ? "📆" : dias === 60 ? "📋" : "🗓️";

    const atas = await prisma.ata.findMany({
      where: { vigenciaFim: { gte: inicio, lt: fim } },
      select: { id: true, numero: true, orgaoNome: true, empresa: { select: { contaId: true } } },
    });
    for (const a of atas) {
      const usuarios = await destinatariosDaConta(a.empresa.contaId);
      for (const u of usuarios) {
        addItem(mapa, u.id, {
          categoria: "planejamento",
          urgencia: dias === 30 ? 2 : 1,
          linha: `${emoji} Ata ${a.numero} (${a.orgaoNome}) — vence em ${dias}d`,
        });
      }
    }

    const contratos = await prisma.contrato.findMany({
      where: { vigenciaFim: { gte: inicio, lt: fim } },
      select: { id: true, numero: true, orgaoNome: true, empresa: { select: { contaId: true } } },
    });
    for (const c of contratos) {
      const usuarios = await destinatariosDaConta(c.empresa.contaId);
      for (const u of usuarios) {
        addItem(mapa, u.id, {
          categoria: "planejamento",
          urgencia: dias === 30 ? 2 : 1,
          linha: `${emoji} Contrato ${c.numero} (${c.orgaoNome}) — vence em ${dias}d`,
        });
      }
    }

    const garantias = await prisma.garantia.findMany({
      where: { dataFim: { gte: inicio, lt: fim } },
      select: {
        id: true, modalidade: true,
        empenho: { select: { numero: true, orgaoNome: true, empresa: { select: { contaId: true } } } },
        contrato: { select: { numero: true, orgaoNome: true, empresa: { select: { contaId: true } } } },
      },
    });
    for (const g of garantias) {
      const doc = g.empenho ?? g.contrato;
      if (!doc) continue;
      const usuarios = await destinatariosDaConta(doc.empresa.contaId);
      for (const u of usuarios) {
        addItem(mapa, u.id, {
          categoria: "garantia",
          urgencia: dias === 30 ? 2 : 1,
          linha: `🛡️ Garantia ${g.modalidade} de ${doc.numero} (${doc.orgaoNome}) — vence em ${dias}d`,
        });
      }
    }
  }

  await coletarVencendo(30);
  await coletarVencendo(60);
  await coletarVencendo(90);

  // Cartao CP System expirando neste mes ou proximo
  const mesAtual = inicioHoje.getMonth() + 1;
  const anoAtual = inicioHoje.getFullYear();
  const cartoes = await prisma.metodoPagamento.findMany({
    where: {
      forma: "CARTAO_CREDITO",
      padrao: true,
      OR: [
        { validadeAno: anoAtual, validadeMes: { gte: mesAtual, lte: mesAtual + 1 } },
        ...(mesAtual === 12 ? [{ validadeAno: anoAtual + 1, validadeMes: 1 }] : []),
      ],
    },
    select: { contaId: true, bandeira: true, ultimosDigitos: true, validadeMes: true, validadeAno: true },
  });
  for (const c of cartoes) {
    const usuarios = await destinatariosDaConta(c.contaId);
    for (const u of usuarios) {
      addItem(mapa, u.id, {
        categoria: "cartao",
        urgencia: 2,
        linha: `💳 ${c.bandeira || "Cartão"} final ${c.ultimosDigitos} vence em ${String(c.validadeMes).padStart(2, "0")}/${c.validadeAno}`,
      });
    }
  }

  return mapa;
}

// Aniversarios — na MANHA.
async function coletarAniversarios(hoje: Date): Promise<MapaUsuarios> {
  const mapa: MapaUsuarios = new Map();
  const mes = hoje.getMonth() + 1;
  const dia = hoje.getDate();
  const usuarios = await prisma.$queryRaw<Array<{ id: string; nome: string }>>`
    SELECT id, nome FROM "Usuario"
    WHERE "optInWhatsApp" = true
      AND "telefoneWhatsApp" IS NOT NULL
      AND EXTRACT(MONTH FROM "dataNascimento") = ${mes}
      AND EXTRACT(DAY FROM "dataNascimento") = ${dia}
  `;
  for (const u of usuarios) {
    addItem(mapa, u.id, {
      categoria: "aniversario",
      urgencia: 3,
      linha: `🎂 Feliz aniversário, ${primeiroNome(u.nome)}!`,
    });
  }
  return mapa;
}

// ============================================================
// MONTAGEM DE MENSAGEM CONSOLIDADA
// ============================================================

const JANELA_TITULO: Record<Janela, string> = {
  MANHA: "Bom dia — o que precisa da sua atenção HOJE",
  TARDE: "Boa tarde — alertas de ação nos próximos dias",
  NOITE: "Boa noite — resumo pra você planejar a semana",
};

const JANELA_INTRO: Record<Janela, string> = {
  MANHA: "Começando o dia com o que é crítico:",
  TARDE: "Alertas que precisam de ação essa semana:",
  NOITE: "Documentos vencendo nas próximas semanas — planeje com antecedência:",
};

function montarMensagem(nome: string, janela: Janela, items: Item[]): string {
  const primeiro = primeiroNome(nome);
  const ordenados = [...items].sort((a, b) => b.urgencia - a.urgencia);

  const linhas: string[] = [
    `📊 *${JANELA_TITULO[janela]}*`,
    ``,
    `Olá, ${primeiro}! ${JANELA_INTRO[janela]}`,
    ``,
  ];

  // Agrupa por categoria (mantendo ordem de urgencia)
  const grupos = new Map<string, Item[]>();
  for (const item of ordenados) {
    const g = grupos.get(item.categoria) ?? [];
    g.push(item);
    grupos.set(item.categoria, g);
  }

  for (const [, itens] of grupos) {
    for (const i of itens) {
      linhas.push(i.linha);
    }
    linhas.push("");
  }

  linhas.push(`🔗 Ver tudo: https://cpsystem.app.br/dashboard`);

  return linhas.join("\n");
}

// ============================================================
// ORQUESTRADOR
// ============================================================

// Merge de vários MapaUsuarios em UM só (acumula items por usuario).
function mergeMapas(...mapas: MapaUsuarios[]): MapaUsuarios {
  const merged: MapaUsuarios = new Map();
  for (const m of mapas) {
    for (const [uid, items] of m) {
      const arr = merged.get(uid) ?? [];
      arr.push(...items);
      merged.set(uid, arr);
    }
  }
  return merged;
}

// Executa a coleta + disparo consolidado da janela.
// Retorna quantos usuarios foram notificados e quantos ficaram sem items.
export async function executarResumoDaJanela(
  janela: Janela,
  hoje: Date = new Date(),
): Promise<{ janela: Janela; usuariosNotificados: number; capAtingido: number; semItems: number }> {
  const inicioHoje = new Date(hoje);
  inicioHoje.setHours(0, 0, 0, 0);
  const amanha = new Date(inicioHoje.getTime() + 86400000);
  const hojeStr = inicioHoje.toISOString().slice(0, 10);

  let mapa: MapaUsuarios = new Map();

  if (janela === "MANHA") {
    const [criticos, aniv] = await Promise.all([
      coletarCriticosDoDia(inicioHoje, amanha),
      coletarAniversarios(inicioHoje),
    ]);
    mapa = mergeMapas(criticos, aniv);
  } else if (janela === "TARDE") {
    mapa = await coletarAcaoImediata(inicioHoje);
  } else if (janela === "NOITE") {
    mapa = await coletarPlanejamento(inicioHoje);
  }

  // Busca dados dos usuarios coletados de uma vez (evita N queries)
  const usuarioIds = Array.from(mapa.keys());
  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: usuarioIds } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(usuarios.map((u) => [u.id, u.nome]));

  let usuariosNotificados = 0;
  let capAtingido = 0;
  let semItems = 0;

  for (const [usuarioId, items] of mapa) {
    if (items.length === 0) {
      semItems++;
      continue;
    }
    const nome = nomePorId.get(usuarioId) ?? "Cliente";
    const mensagem = montarMensagem(nome, janela, items);
    const r = await dispararNotificacao({
      usuarioId,
      tipo: "VENCIMENTO_EMPENHO", // tipo generico — refId diferencia
      referenciaId: `resumo-${janela.toLowerCase()}-${hojeStr}`,
      mensagem,
    });
    if (r.enviado) usuariosNotificados++;
    if (r.motivo === "cap_diario_atingido") capAtingido++;
    // Espacamento de 1.5s entre disparos — protege Z-API + parece humano
    await sleep(1500);
  }

  return { janela, usuariosNotificados, capAtingido, semItems };
}
