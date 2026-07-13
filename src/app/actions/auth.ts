"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { criarSessao, destruirSessao, hashSenha, verificarSenha } from "@/lib/auth";
import { loginSchema, normalizarCnpj, normalizarCpf, signupAnalistaSchema, signupSchema } from "@/lib/validators";
import { validarCartao } from "@/lib/cartao";

type ActionResult = {
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
};

function valoresParaEcho(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    // Não echo de campos sensíveis: senha + dados completos do cartão
    if (k === "senha" || k === "confirmacaoSenha" || k === "cartaoNumero" || k === "cartaoCvv") continue;
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

export async function signupAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  // Múltiplos e-mails e telefones (CampoMultiplo) chegam como name="X[]"
  // Pegamos todos, mas pro Zod usamos só o 1º (compat com schema antigo).
  const emailsArray = formData.getAll("emailEmpresa[]").map(String).filter(Boolean);
  const telefonesArray = formData.getAll("telefones[]").map(String).filter(Boolean);
  const dados: Record<string, string> = {};
  for (const [k, val] of formData.entries()) {
    if (k.endsWith("[]")) continue;
    dados[k] = String(val);
  }
  if (emailsArray.length > 0 && !dados.emailEmpresa) dados.emailEmpresa = emailsArray[0];
  if (telefonesArray.length > 0 && !dados.telefones) dados.telefones = telefonesArray[0];
  // O form não pede mais "nome" e "email de acesso" separados — usamos
  // responsavel e o primeiro e-mail da empresa como credencial padrão.
  if (!dados.nome && dados.responsavel) dados.nome = dados.responsavel;
  if (!dados.email && dados.emailEmpresa) dados.email = dados.emailEmpresa;
  const parsed = signupSchema.safeParse(dados);
  const valores = valoresParaEcho(formData);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos, valores };
  }

  const v = parsed.data;
  const cnpj = normalizarCnpj(v.cnpj);
  const emailNorm = v.email.trim().toLowerCase();

  // Valida cartão (Luhn + bandeira + validade + CVV + nome) — antes de tocar no DB
  const cartao = validarCartao({
    numero: v.cartaoNumero,
    validade: v.cartaoValidade,
    cvv: v.cartaoCvv,
    nome: v.cartaoNome,
  });
  if (!cartao.ok) {
    const campoMap: Record<string, string> = {
      numero: "cartaoNumero",
      validade: "cartaoValidade",
      cvv: "cartaoCvv",
      nome: "cartaoNome",
    };
    return {
      erro: `Cartão inválido: ${cartao.mensagem}`,
      campos: { [campoMap[cartao.campo]]: cartao.mensagem },
      valores,
    };
  }

  // Bloqueio de email duplicado entre empresa e analista (regra de negócio do PO)
  const emailExiste = await prisma.usuario.findUnique({ where: { email: emailNorm } });
  if (emailExiste) {
    return {
      erro: "E-mail já cadastrado em outra conta (empresa ou analista).",
      campos: { email: "E-mail já cadastrado" },
      valores,
    };
  }

  const cnpjExiste = await prisma.empresa.findUnique({ where: { cnpj } });
  if (cnpjExiste) {
    return {
      erro: "CNPJ já cadastrado em outra conta.",
      campos: { cnpj: "CNPJ já cadastrado" },
      valores,
    };
  }

  const senhaHash = await hashSenha(v.senha);

  // Cupom (Regina 09/07) — se aplicado, dias de trial personalizado + vincula
  // analista automaticamente. Prioridade: cupom > ?ref= > autocomplete.
  // Reserva o slot em transacao (evita 2 signups pegarem o ultimo uso).
  const cupomCodigoRaw = String(formData.get("cupomCodigo") || "").trim().toUpperCase();
  let cupomAplicadoId: string | null = null;
  let diasTrial = 14;
  let analistaViaCupomId: string | null = null;
  if (cupomCodigoRaw) {
    const { aplicarCupomInterno } = await import("@/app/actions/cupom");
    const r = await aplicarCupomInterno(cupomCodigoRaw);
    if (!r.ok) {
      const msgs: Record<string, string> = {
        nao_encontrado: "Cupom não encontrado.",
        desativado: "Cupom desativado.",
        expirado: "Cupom expirado.",
        esgotado: "Cupom já foi usado o número máximo de vezes.",
        vazio: "Cupom vazio.",
      };
      return {
        erro: msgs[r.motivo] || "Cupom inválido.",
        campos: { cupomCodigo: msgs[r.motivo] || "Inválido" },
        valores,
      };
    }
    cupomAplicadoId = r.cupomId;
    diasTrial = r.diasTrial;
    analistaViaCupomId = r.analistaVinculadoId;
  }
  const trialAteEm = new Date(Date.now() + diasTrial * 24 * 60 * 60 * 1000);

  // Vínculo opcional com analista (vem do autocomplete no signup)
  const analistaIdRaw = String(formData.get("analistaId") || "").trim();
  let analistaValido: { id: string; contaId: string | null } | null = null;
  if (analistaIdRaw) {
    const a = await prisma.analista.findUnique({
      where: { id: analistaIdRaw },
      select: { id: true, contaId: true, ativo: true },
    });
    if (!a || !a.ativo) {
      return { erro: "Analista selecionado não está mais disponível." };
    }
    analistaValido = { id: a.id, contaId: a.contaId };
  }

  // Programa de Embaixador: ID do analista que indicou via link pessoal
  // /signup?ref=ANALISTA_ID. Valida que existe e ta ativo. Se invalido
  // (link expirado, analista desativado), simplesmente ignora (signup
  // segue normal sem embaixador) — nao bloquear cadastro por isso.
  //
  // ALEM disso: programa de Referral C2C — link /signup?ref=conta-<id>
  // grava 'indicadoPorContaId'. Cliente que indicou ganha 1 mes gratis
  // quando essa conta nova pagar a 1a fatura.
  const refRaw = String(formData.get("embaixadorIdRef") || "").trim();
  let embaixadorIdValido: string | null = null;
  let indicadoPorContaIdValido: string | null = null;
  if (refRaw) {
    if (refRaw.startsWith("conta-")) {
      // Referral C2C: ?ref=conta-<contaId>
      const contaIdRef = refRaw.slice("conta-".length);
      const c = await prisma.conta.findUnique({
        where: { id: contaIdRef },
        select: { id: true, statusAssinatura: true },
      });
      // Só aceita se a conta indicadora existe e nao esta bloqueada/cancelada.
      if (c && c.statusAssinatura !== "CANCELADA") {
        indicadoPorContaIdValido = c.id;
      }
    } else {
      // Programa Embaixador: ?ref=<analistaId>
      const emb = await prisma.analista.findUnique({
        where: { id: refRaw },
        select: { id: true, ativo: true },
      });
      if (emb && emb.ativo) embaixadorIdValido = emb.id;
    }
  }

  const conta = await prisma.conta.create({
    data: {
      tipo: "EMPRESA",
      plano: v.plano,
      statusAssinatura: "TRIAL",
      trialAteEm,
      // Aceite eletronico do contrato v2.0 no momento do cadastro
      // (Regina 03/07). MP 2.200-2/2001 art. 10, §2º equipara aceite
      // eletronico a assinatura fisica.
      termosAceitosEm: new Date(),
      // Prioridade: cupom > ?ref= > autocomplete do signup.
      embaixadorId: analistaViaCupomId ?? embaixadorIdValido,
      cupomAplicadoId,
      indicadoPorContaId: indicadoPorContaIdValido,
      usuarios: {
        create: {
          nome: v.nome,
          email: emailNorm,
          senhaHash,
          perfil: "ADMIN",
          // Regina 02/07: WhatsApp obrigatorio no cadastro. Recebe
          // notificacoes automaticas (opt-out em /conta/notificacoes).
          telefoneWhatsApp: v.telefoneWhatsApp.replace(/\D/g, ""),
          optInWhatsApp: true,
        },
      },
      empresas: {
        create: {
          razaoSocial: v.razaoSocial,
          nomeFantasia: v.nomeFantasia || null,
          cnpj,
          porte: v.porte,
          cnaePrincipal: v.cnaePrincipal || null,
          naturezaJuridica: v.naturezaJuridica,
          endereco: v.endereco,
          complemento: v.complemento || null,
          cep: v.cep.replace(/\D/g, ""),
          email: v.emailEmpresa,
          emails: emailsArray.length > 0 ? emailsArray : [v.emailEmpresa],
          telefones: v.telefones,
          telefonesLista: telefonesArray.length > 0 ? telefonesArray : [v.telefones],
          responsavel: v.responsavel,
        },
      },
      // Cartão validado — só persistimos últimos 4 + bandeira + validade.
      // PAN/CVV jamais tocam o disco. Tokenização real via gateway entra
      // como melhoria futura quando ASAAS_API_KEY for configurado.
      metodosPagamento: {
        create: {
          forma: "CARTAO_CREDITO",
          apelido: `${cartao.bandeira} final ${cartao.ultimos4}`,
          bandeira: cartao.bandeira,
          ultimosDigitos: cartao.ultimos4,
          validadeMes: cartao.validadeMes,
          validadeAno: cartao.validadeAno,
          padrao: true,
          ativo: true,
        },
      },
      // Regina 13/07: dia de vencimento fixo + CPF titular pra Asaas.
      diaVencimento: Number(v.diaVencimento),
      cpfTitularCartao: v.cpfTitularCartao,
    },
    include: { usuarios: true, empresas: { take: 1 } },
  });

  // Regina 13/07: já cria Customer + Subscription no Asaas no signup, com
  // nextDueDate = próximo dia {10|15|20} APÓS o fim do trial. Asaas guarda
  // o cartão tokenizado e cobra sozinho quando o trial acabar. Cliente não
  // precisa voltar em /conta/checkout. Best-effort — se falhar (ex: cartão
  // recusado, gateway offline), signup continua e conta fica sem subscription
  // pra ser resolvida em /conta/completar-cadastro depois.
  try {
    const { calcularValorMensal } = await import("@/lib/precos");
    const { getGateway } = await import("@/lib/gateway");
    const gateway = await getGateway();

    if (gateway.criarAssinatura) {
      const breakdown = await calcularValorMensal(conta.id, v.plano);
      const empresa = conta.empresas[0]!;
      // Calcula próximo dia diaVencimento APÓS trialAteEm
      const diaEscolhido = Number(v.diaVencimento);
      const nextDueDate = new Date(trialAteEm);
      nextDueDate.setDate(diaEscolhido);
      if (nextDueDate <= trialAteEm) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }

      // Cria customer no Asaas
      const { customerId } = await gateway.criarCliente({
        contaId: conta.id,
        nome: empresa.razaoSocial,
        email: emailNorm,
        cpfCnpj: normalizarCnpj(empresa.cnpj),
        telefone: empresa.telefones,
        endereco: empresa.endereco,
      });

      // Cria cobranca interna referente ao primeiro mes pos-trial
      const competencia = `${nextDueDate.getFullYear()}-${String(nextDueDate.getMonth() + 1).padStart(2, "0")}`;
      const cobrancaInterna = await prisma.cobranca.create({
        data: {
          contaId: conta.id,
          competencia,
          plano: v.plano,
          forma: "CARTAO_CREDITO",
          valor: breakdown.valorTotal,
          vencimento: nextDueDate,
          status: "PENDENTE",
        },
      });

      // Cria subscription — Asaas tokeniza cartão e passa a cobrar todo mes.
      // Dados sensíveis do cartão vêm direto do formData (nao guardados em disco).
      const cartaoNumero = v.cartaoNumero.replace(/\s/g, "");
      const cartaoNome = v.cartaoNome;
      const cartaoCvv = v.cartaoCvv;
      const sub = await gateway.criarAssinatura({
        customerId,
        cobrancaIdInterno: cobrancaInterna.id,
        valor: breakdown.valorTotal,
        proximoVencimento: nextDueDate,
        descricao: `CP System — Plano ${v.plano} (${competencia})`,
        cartao: {
          numero: cartaoNumero,
          nome: cartaoNome,
          validadeMes: cartao.validadeMes,
          validadeAno: cartao.validadeAno,
          cvv: cartaoCvv,
        },
        titular: {
          nome: cartaoNome,
          email: emailNorm,
          cpfCnpj: v.cpfTitularCartao,
          telefone: empresa.telefones || undefined,
          cep: empresa.cep || undefined,
          numeroEndereco: empresa.endereco.match(/,\s*(\d+[A-Za-z]?)\b/)?.[1] || "S/N",
        },
      });

      await prisma.conta.update({
        where: { id: conta.id },
        data: {
          gatewayCustomerId: customerId,
          gatewaySubscriptionId: sub.subscriptionId,
          gatewayProvider: gateway.nome,
          proximoVencimento: nextDueDate,
        },
      });
      await prisma.cobranca.update({
        where: { id: cobrancaInterna.id },
        data: {
          gatewayChargeId: sub.primeiraCobranca.chargeId,
          gatewayInvoiceUrl: sub.primeiraCobranca.invoiceUrl || null,
          status: sub.primeiraCobranca.status,
        },
      });
    }
  } catch (err) {
    // Best-effort — signup continua mesmo se gateway falhar
    console.error("[signup] falha ao criar subscription no gateway:", err);
  }

  // Cria o vínculo + notifica o analista
  if (analistaValido) {
    // % e fixo são opcionais no signup. Se preenchidos, já entram com
    // o valor — economiza uma ida posterior em /vinculos.
    const pctRaw = Number(formData.get("vinculoPercentual") || 0);
    const fixoRaw = Number(formData.get("vinculoFixo") || 0);
    const pct = isNaN(pctRaw) || pctRaw < 0 || pctRaw > 100 ? 0 : pctRaw;
    const fixo = isNaN(fixoRaw) || fixoRaw < 0 ? 0 : fixoRaw;
    await prisma.vinculoAnalista.create({
      data: {
        contaId: conta.id,
        analistaId: analistaValido.id,
        dataInicio: new Date(),
        percentualComissao: pct,
        fixoMensal: fixo,
        diaVencimentoFixo: 5,
        status: "ATIVO",
      },
    });

    if (analistaValido.contaId) {
      const usuariosDoAnalista = await prisma.usuario.findMany({
        where: { contaId: analistaValido.contaId },
        select: { id: true },
      });
      const { notificar } = await import("@/lib/notificacoes");
      for (const u of usuariosDoAnalista) {
        await notificar({
          usuarioId: u.id,
          tipo: "VINCULO_CRIADO",
          titulo: `Nova empresa vinculou você: ${v.razaoSocial}`,
          descricao: "Defina o percentual de comissão e o fixo mensal no seu painel.",
          link: "/painel-analista",
          recursoTipo: "VinculoAnalista",
          recursoId: conta.id,
        });
      }
    }
  }

  // Notifica o embaixador via WhatsApp quando a conta veio por link
  // pessoal (?ref=<analistaId>). Regina 07/07: cada analista tem seu link
  // proprio e precisa saber na hora quando um cliente novo cadastrou.
  // Best-effort — falha aqui nao bloqueia o signup.
  if (embaixadorIdValido) {
    try {
      const emb = await prisma.analista.findUnique({
        where: { id: embaixadorIdValido },
        select: { id: true, nomeCompleto: true, contaId: true },
      });
      if (emb?.contaId) {
        const usuariosDoEmb = await prisma.usuario.findMany({
          where: { contaId: emb.contaId, optInWhatsApp: true, telefoneWhatsApp: { not: null } },
          select: { id: true, nome: true },
        });
        const { dispararNotificacao } = await import("@/lib/whatsapp");
        const primeiroNomeCliente = v.nome.split(" ")[0] || v.nome;
        for (const u of usuariosDoEmb) {
          const primeiro = u.nome.split(" ")[0] || u.nome;
          const mensagem =
            `🎉 *Novo cliente vinculado a você — CP System*\n\n` +
            `${primeiro}, parabéns! *${primeiroNomeCliente}* (${v.razaoSocial}) acabou de se cadastrar no CP System pelo seu link pessoal.\n\n` +
            `A partir da 1ª fatura paga, você recebe *R$ 29,90/mês* enquanto o cliente permanecer assinante.\n\n` +
            `Acompanhe em https://cpsystem.app.br/painel-analista`;
          await dispararNotificacao({
            usuarioId: u.id,
            tipo: "ANALISTA_VINCULADO",
            referenciaId: `emb-vinc-${conta.id}`,
            mensagem,
          });
        }
      }
    } catch (e) {
      console.error("[signup] erro ao notificar embaixador via WA:", e);
    }
  }

  await criarSessao(conta.usuarios[0].id);
  redirect("/dashboard");
}

// Busca pública (sem auth) usada pelo autocomplete no signup.
// Retorna apenas dados não-sensíveis: nome, CPF mascarado e e-mail.
export async function buscarAnalistasPublicos(termo: string) {
  const t = termo.trim();
  if (t.length < 2) return [];

  const cpfDigits = t.replace(/\D/g, "");
  const buscaCpf = cpfDigits.length >= 3;

  // Busca case-insensitive (Igor reportou: "tirar filtro de não encontrar
  // escrevendo minúsculo ou maiúsculo")
  const analistas = await prisma.analista.findMany({
    where: {
      ativo: true,
      OR: [
        { nomeCompleto: { contains: t, mode: "insensitive" } },
        ...(buscaCpf ? [{ cpf: { contains: cpfDigits } }] : []),
      ],
    },
    select: { id: true, nomeCompleto: true, cpf: true, email: true },
    take: 10,
    orderBy: { nomeCompleto: "asc" },
  });

  return analistas.map((a) => ({
    id: a.id,
    nome: a.nomeCompleto,
    cpfMascarado: `***.${a.cpf.slice(3, 6)}.${a.cpf.slice(6, 9)}-**`,
    email: a.email,
  }));
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { erro: "Preencha e-mail e senha." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { conta: true },
  });
  if (!usuario) return { erro: "Credenciais inválidas." };

  const ok = await verificarSenha(parsed.data.senha, usuario.senhaHash);
  if (!ok) return { erro: "Credenciais inválidas." };

  // Valida que o tipo escolhido no toggle bate com o tipo real da conta
  // (Regina 10/06: caso comum de tentar logar no lado errado). SuperAdmin
  // ignora — pra Regina/Igor poderem entrar mesmo na conta de testes.
  if (
    parsed.data.tipo &&
    !usuario.superAdmin &&
    parsed.data.tipo !== usuario.conta.tipo
  ) {
    const tipoCertoLabel = usuario.conta.tipo === "ANALISTA" ? "Analista" : "Empresa";
    return {
      erro: `Esse e-mail é de uma conta de ${tipoCertoLabel}. Volte e selecione "${tipoCertoLabel}" no topo do formulário.`,
    };
  }

  await criarSessao(usuario.id);
  // Redireciona pra rota inicial conforme o tipo da conta:
  // - SuperAdmin: visão de plataforma
  // - Analista: painel próprio (não tem dashboard de empresa)
  // - Empresa: dashboard operacional
  const destino = usuario.superAdmin
    ? "/admin-plataforma"
    : usuario.conta.tipo === "ANALISTA"
      ? "/painel-analista"
      : "/dashboard";
  redirect(destino);
}

export async function logoutAction() {
  await destruirSessao();
  redirect("/login");
}

// ============================================================
// SIGNUP DO ANALISTA (conta tipo ANALISTA)
// ============================================================
export async function signupAnalistaAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const dados = Object.fromEntries(formData);
  const valores = valoresParaEcho(formData);
  const parsed = signupAnalistaSchema.safeParse(dados);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos, valores };
  }

  const v = parsed.data;
  const nome = v.nome.trim();
  const email = v.email.trim().toLowerCase();
  const cpf = normalizarCpf(v.cpf);
  const telefone = v.telefone.trim();
  const endereco = v.endereco.trim();
  const banco = (v.banco ?? "").trim();
  const agencia = (v.agencia ?? "").trim();
  const contaCorrente = (v.contaCorrente ?? "").trim();
  const pix = (v.pix ?? "").trim();
  const razaoSocial = (v.razaoSocial ?? "").trim();
  const nomeFantasia = (v.nomeFantasia ?? "").trim();
  const cnpjPj = v.cnpj ? normalizarCnpj(v.cnpj) : "";
  const portePj = (v.porte ?? "").trim();
  const cnaePrincipal = (v.cnaePrincipal ?? "").trim();
  const cnaesSecundarios = (v.cnaesSecundarios ?? "").trim();
  const naturezaJuridica = (v.naturezaJuridica ?? "").trim();
  const enderecoPj = (v.enderecoPj ?? "").trim();
  const emailPj = (v.emailPj ?? "").trim();
  const telefonePj = (v.telefonePj ?? "").trim();

  const emailExiste = await prisma.usuario.findUnique({ where: { email } });
  if (emailExiste) return { erro: "E-mail já cadastrado.", campos: { email: "E-mail já cadastrado" }, valores };

  const cpfExiste = await prisma.analista.findUnique({ where: { cpf } });
  if (cpfExiste) return { erro: "CPF já cadastrado como analista.", campos: { cpf: "CPF já cadastrado" }, valores };

  const senhaHash = await hashSenha(v.senha);

  const conta = await prisma.conta.create({
    data: {
      tipo: "ANALISTA",
      plano: "BASICO",
      statusAssinatura: "ATIVA", // analista não paga assinatura — só ganha comissão
      usuarios: {
        create: { nome, email, senhaHash, perfil: "ADMIN" },
      },
      analista: {
        create: {
          nomeCompleto: nome,
          cpf,
          telefone,
          endereco,
          cep: v.cep ? v.cep.replace(/\D/g, "") : null,
          complemento: (v.complemento ?? "").trim() || null,
          email,
          banco: banco || null,
          agencia: agencia || null,
          contaCorrente: contaCorrente || null,
          pix: pix || null,
          razaoSocial: razaoSocial || null,
          nomeFantasia: nomeFantasia || null,
          cnpj: cnpjPj.length === 14 ? cnpjPj : null,
          porte: ["MEI", "ME", "EPP", "MEDIA", "GRANDE"].includes(portePj)
            ? (portePj as "MEI" | "ME" | "EPP" | "MEDIA" | "GRANDE")
            : null,
          cnaePrincipal: cnaePrincipal || null,
          cnaesSecundarios: cnaesSecundarios || null,
          naturezaJuridica: naturezaJuridica || null,
          enderecoPj: enderecoPj || null,
          emailPj: emailPj || null,
          telefonePj: telefonePj || null,
          ativo: true,
        },
      },
    },
    include: { usuarios: true },
  });

  await criarSessao(conta.usuarios[0].id);
  redirect("/painel-analista");
}
