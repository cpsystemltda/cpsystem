import "server-only";
import { prisma } from "@/lib/prisma";

// Resumos semanais consolidados (Regina 14/07).
// Chave semana ISO: yyyy-Www (ex "2026-W29"). Idempotencia via
// NotificacaoWhatsApp (usuarioId, tipo, referenciaId=chave).

export function semanaIso(agora: Date = new Date()): string {
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

// ------- Resumo pra CLIENTE EMPRESA (uma msg por conta) -------

export type ResumoEmpresa = {
  contaId: string;
  usuarioAdminId: string;
  telefone: string;
  primeiroNome: string;
  mensagem: string;
} | null;

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const dataBr = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export async function montarResumoEmpresa(contaId: string): Promise<ResumoEmpresa> {
  const conta = await prisma.conta.findUnique({
    where: { id: contaId },
    select: {
      statusAssinatura: true, plano: true, proximoVencimento: true, diaVencimento: true,
      usuarios: {
        where: { perfil: "ADMIN", optInWhatsApp: true, telefoneWhatsApp: { not: null } },
        select: { id: true, nome: true, telefoneWhatsApp: true },
        take: 1,
      },
      empresas: { select: { id: true, razaoSocial: true } },
    },
  });
  if (!conta || conta.usuarios.length === 0 || conta.empresas.length === 0) return null;
  const usuario = conta.usuarios[0];
  if (!usuario.telefoneWhatsApp) return null;

  const agora = new Date();
  const em30 = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
  const em7 = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const empresaIds = conta.empresas.map((e) => e.id);

  const [atasVenc30, contratosVenc30, atasCrit7, contratosCrit7, empenhosVigentes] = await Promise.all([
    prisma.ata.findMany({
      where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: agora, lte: em30 } },
      orderBy: { vigenciaFim: "asc" }, take: 3,
      select: { numero: true, vigenciaFim: true },
    }),
    prisma.contrato.findMany({
      where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: agora, lte: em30 } },
      orderBy: { vigenciaFim: "asc" }, take: 3,
      select: { numero: true, vigenciaFim: true },
    }),
    prisma.ata.count({ where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: agora, lte: em7 } } }),
    prisma.contrato.count({ where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: agora, lte: em7 } } }),
    // Regina 10/08: o Leo recebeu "EMPENHOS VIGENTES: 59" e o numero nao
    // significava nada pra ele. A contagem pegava TODO empenho com vigencia
    // futura, incluindo os 94 ja PAGOS — misturava o que acabou com o que
    // ainda da trabalho. Agora conta so o que esta em aberto (nao pago), que
    // e a mesma regua do resumo de sexta: a execucao so fecha quando o orgao
    // paga.
    prisma.empenho.count({
      where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: agora }, status: { not: "PAGO" } },
    }),
  ]);

  const primeiroNome = usuario.nome.split(" ")[0] || usuario.nome;
  const linhas: string[] = [`Olá ${primeiroNome}, resumo semanal da sua operação:`];

  // Bloco vencimentos criticos (7d) sempre no topo se houver
  if (atasCrit7 + contratosCrit7 > 0) {
    linhas.push("");
    linhas.push("⚠️ *ATENÇÃO — VENCE EM 7 DIAS*");
    for (const a of atasVenc30) if (a.vigenciaFim && a.vigenciaFim <= em7) linhas.push(`• Ata ${a.numero} — ${dataBr(a.vigenciaFim)}`);
    for (const c of contratosVenc30) if (c.vigenciaFim && c.vigenciaFim <= em7) linhas.push(`• Contrato ${c.numero} — ${dataBr(c.vigenciaFim)}`);
  }

  linhas.push("");
  linhas.push("📊 *VENCIMENTOS PRÓXIMOS 30 DIAS*");
  if (atasVenc30.length === 0 && contratosVenc30.length === 0) {
    linhas.push("Nenhum. Semana tranquila.");
  } else {
    for (const a of atasVenc30) linhas.push(`• Ata ${a.numero} vence ${dataBr(a.vigenciaFim!)}`);
    for (const c of contratosVenc30) linhas.push(`• Contrato ${c.numero} vence ${dataBr(c.vigenciaFim!)}`);
  }

  if (empenhosVigentes > 0) {
    linhas.push("");
    linhas.push(`📦 *EM EXECUÇÃO (órgão ainda não pagou):* ${empenhosVigentes}`);
  }

  // Assinatura
  linhas.push("");
  if (conta.statusAssinatura === "ATIVA" && conta.proximoVencimento) {
    linhas.push(`💳 Próxima cobrança: ${dataBr(conta.proximoVencimento)} (${conta.plano} — débito automático)`);
  } else if (conta.statusAssinatura === "TRIAL") {
    linhas.push(`💳 Assinatura em TRIAL. Complete o cadastro em cpsystem.app.br pra evitar bloqueio.`);
  } else if (conta.statusAssinatura === "INADIMPLENTE") {
    linhas.push(`💳 Assinatura em ATRASO. Regularize em cpsystem.app.br/conta/assinatura.`);
  }

  linhas.push("");
  linhas.push("Acesse detalhes em cpsystem.app.br.");
  linhas.push("");
  linhas.push("— CP System");

  return {
    contaId,
    usuarioAdminId: usuario.id,
    telefone: usuario.telefoneWhatsApp,
    primeiroNome,
    mensagem: linhas.join("\n"),
  };
}

// ------- Resumo pra ANALISTA (uma msg por analista) -------

export type ResumoAnalista = {
  analistaId: string;
  usuarioId: string;
  telefone: string;
  primeiroNome: string;
  mensagem: string;
} | null;

export async function montarResumoAnalista(analistaId: string): Promise<ResumoAnalista> {
  const analista = await prisma.analista.findUnique({
    where: { id: analistaId },
    select: {
      id: true, nomeCompleto: true, telefone: true, pix: true, contaId: true,
      conta: {
        select: {
          usuarios: {
            where: { optInWhatsApp: true, telefoneWhatsApp: { not: null } },
            select: { id: true, nome: true, telefoneWhatsApp: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!analista) return null;

  // Fallback: se conta analista nao tem WA, tenta o proprio Analista.telefone (cadastro)
  const usuario = analista.conta?.usuarios[0];
  const telefone = usuario?.telefoneWhatsApp || analista.telefone;
  const usuarioId = usuario?.id;
  if (!telefone || !usuarioId) return null;

  const [contasIndicadas, comissoes] = await Promise.all([
    prisma.conta.findMany({
      where: { embaixadorId: analistaId },
      select: { statusAssinatura: true, empresas: { select: { razaoSocial: true }, take: 1 } },
    }),
    prisma.comissao.findMany({
      where: { analistaId, paga: false },
      select: {
        valor: true,
        competencia: true,
        // Data de compensacao: o CP System so recebe D+32 do pagamento do
        // cliente, entao a comissao so pode sair depois disso.
        conta: {
          select: {
            cobrancas: {
              where: { status: "PAGA", pagaEm: { not: null } },
              select: { pagaEm: true },
              orderBy: { pagaEm: "asc" },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  const ativas = contasIndicadas.filter((c) => c.statusAssinatura === "ATIVA").length;
  const trials = contasIndicadas.filter((c) => c.statusAssinatura === "TRIAL").length;
  const inadimplentes = contasIndicadas.filter((c) => c.statusAssinatura === "INADIMPLENTE" || c.statusAssinatura === "CANCELADA").length;
  const aReceber = comissoes.reduce((s, c) => s + c.valor, 0);

  // Proximo dia 20 do mes
  const hoje = new Date();
  const prox20 = new Date(hoje.getFullYear(), hoje.getMonth(), 20);
  if (hoje.getDate() >= 20) prox20.setMonth(prox20.getMonth() + 1);

  const primeiroNome = analista.nomeCompleto.split(" ")[0] || analista.nomeCompleto;
  const linhas: string[] = [`Olá ${primeiroNome}, resumo semanal do seu programa Analista Parceiro:`];

  linhas.push("");
  linhas.push("📊 *SUA REDE*");
  linhas.push(`• Clientes ativos (comissão correndo): *${ativas}*`);
  if (trials > 0) linhas.push(`• Em trial (aguardando 1ª fatura paga): ${trials}`);
  if (inadimplentes > 0) linhas.push(`• Em atraso/cancelados: ${inadimplentes}`);

  linhas.push("");
  linhas.push("💰 *COMISSÃO*");
  if (aReceber > 0) {
    linhas.push(`• A receber no próximo PIX: *${BRL(aReceber)}*`);
    // Regina 10/08: o Igor viu R$ 59,80 com UM cliente e estranhou, com razao.
    // O valor estava certo (julho + agosto acumulados), mas a mensagem nao
    // dizia isso — parecia erro de calculo. Agora discrimina as competencias
    // sempre que houver mais de um mes em aberto.
    if (comissoes.length > 1) {
      const meses = comissoes
        .map((c) => c.competencia)
        .sort()
        .map((c) => {
          const [ano, mes] = c.split("-");
          const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
          return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`;
        });
      linhas.push(`• Referente a ${comissoes.length} meses acumulados: ${meses.join(" + ")}`);
    }

    // Regina 10/08: a data do PIX nao pode ser so "proximo dia 20". O CP
    // System recebe do gateway D+32 do pagamento do cliente; antes disso nao
    // ha caixa pra repassar. Anuncia o dia 20 seguinte a compensacao, pra nao
    // prometer data que nao se cumpre.
    const COMPENSACAO_DIAS = 32;
    let dataPix = prox20;
    const compensacoes = comissoes
      .map((c) => c.conta?.cobrancas?.[0]?.pagaEm)
      .filter((d): d is Date => !!d)
      .map((d) => new Date(d.getTime() + COMPENSACAO_DIAS * 24 * 60 * 60 * 1000));
    if (compensacoes.length > 0) {
      const maisCedo = new Date(Math.min(...compensacoes.map((d) => d.getTime())));
      if (maisCedo > prox20) {
        // primeiro dia 20 depois da compensacao
        const d = new Date(maisCedo.getFullYear(), maisCedo.getMonth(), 20);
        if (maisCedo.getDate() > 20) d.setMonth(d.getMonth() + 1);
        dataPix = d;
      }
    }
    linhas.push(`• Data do PIX: ${dataBr(dataPix)}`);
    linhas.push(`• O repasse sai após o pagamento do cliente compensar (32 dias).`);
  } else {
    linhas.push(`• Nada apurado ainda. Comissão só passa a correr após a 1ª fatura paga do cliente.`);
    if (trials > 0) linhas.push(`• Você tem ${trials} cliente(s) em trial — quando pagarem, sua comissão começa.`);
  }

  linhas.push("");
  linhas.push("📈 *COMO CRESCER*");
  linhas.push(`Cada novo cliente indicado = +R$ 29,90/mês vitalício.`);
  linhas.push(`Seu link: cpsystem.app.br/signup?ref=${analistaId}`);

  linhas.push("");
  linhas.push("— CP System");

  return {
    analistaId,
    usuarioId,
    telefone,
    primeiroNome,
    mensagem: linhas.join("\n"),
  };
}
