import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "@/lib/whatsapp";
import { enviarEmail } from "@/lib/email";
import { avisarEquipe } from "@/lib/alertaInterno";
import { whatsappFormatado, CONTATOS_CP_SYSTEM } from "@/lib/contatosCpSystem";

/** Marca em LogAuditoria de que esta conta já foi recebida. */
export const RECURSO_BOAS_VINDAS = "BOAS_VINDAS";

/**
 * Boas-vindas ao cliente que acabou de assinar o teste — e aviso pra equipe.
 *
 * Regina 28/08, ao ver a primeira mensagem que o CP System mandou pro Marcos:
 * "por que ele não recebeu antes de mais nada uma mensagem de boas-vindas? Já
 * foi direto pra notificação sem nada, sem nem dar bom dia pro cara?". Estava
 * certa — não existia boas-vindas nenhuma, nem WhatsApp nem e-mail. O primeiro
 * contato do cliente com a gente era um aviso automático de contrato.
 *
 * E ninguém do CP System era avisado de cadastro novo: o sistema só notificava
 * quando o cliente vinha indicado por analista ou embaixador. Cliente que chega
 * pelo site ou pelo anúncio — justamente o que a gente paga pra atrair —
 * entrava sem que ninguém soubesse. Foram dois assim antes de alguém notar.
 *
 * Tudo aqui é best-effort: falha de WhatsApp ou de e-mail não pode derrubar o
 * cadastro, que é o momento mais caro do funil.
 *
 * É idempotente por conta, registrado em LogAuditoria. A marca não depende de
 * canal: se o cliente não tem WhatsApp e o e-mail falhar, ainda assim consta
 * que as boas-vindas rodaram. Sem isso, a rotina diária de ativação — que paga
 * a dívida de quem entrou antes desta função existir — reenviaria o e-mail
 * todo santo dia pra quem não tem telefone cadastrado.
 *
 * Retorna `true` se executou agora, `false` se a conta já tinha sido recebida.
 */
export async function darBoasVindas(contaId: string): Promise<boolean> {
  const jaRecebeu = await prisma.logAuditoria.findFirst({
    where: { contaId, recurso: RECURSO_BOAS_VINDAS },
    select: { id: true },
  });
  if (jaRecebeu) return false;

  const conta = await prisma.conta.findUnique({
    where: { id: contaId },
    select: {
      id: true,
      tipo: true,
      plano: true,
      trialAteEm: true,
      analista: { select: { nomeCompleto: true } },
      empresas: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true }, take: 1 },
      usuarios: {
        select: { id: true, nome: true, email: true, telefoneWhatsApp: true, optInWhatsApp: true },
        orderBy: { criadoEm: "asc" },
        take: 1,
      },
      vinculosAnalista: { select: { analista: { select: { nomeCompleto: true } } }, take: 1 },
    },
  });
  if (!conta) return false;

  const usuario = conta.usuarios[0];
  const empresa = conta.empresas[0];
  if (!usuario) return false;

  const primeiro = usuario.nome.split(" ")[0] || usuario.nome;
  const fimTeste = conta.trialAteEm
    ? conta.trialAteEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : null;

  // Conta de ANALISTA nao tem empresa nem carteira ainda: o primeiro passo
  // dele e outro (montar a carteira), e prometer "acompanho seus prazos" seria
  // falar do produto errado pra pessoa errada — analista != cliente.
  const ehAnalista = conta.tipo === "ANALISTA";

  // O aviso pra equipe diz o que REALMENTE saiu. Antes afirmava "recebeu por
  // WhatsApp e e-mail" sempre — e quem le o alerta decide se precisa ligar pro
  // cliente com base nisso.
  let entregouWhats = false;
  let entregouEmail = false;

  // ── 1. WhatsApp pro cliente ───────────────────────────────────────────────
  // Sai antes de qualquer notificação automática porque é o primeiro contato:
  // o cliente precisa saber de quem é o número que vai falar com ele depois.
  if (usuario.optInWhatsApp && usuario.telefoneWhatsApp) {
    // Regina 31/08, sobre a versão anterior: "boas-vindas ao CP System, olha o
    // que você diz, que tosco (...) tem que ser 'é um prazer tê-los conosco,
    // nossa intenção é otimizar seus resultados e diminuir seus prejuízos',
    // colocar os principais pontos do sistema e desejar pra ele um início
    // excelente. Não uma coisa genérica (...) tem que ser mais curta e mais
    // direta". O que saía antes era um roteiro de configuração — dizia o que a
    // pessoa tinha que fazer, nunca o que ela ganhava com isso.
    const texto = ehAnalista
      ? `👋 *Bem-vindo ao CP System, ${primeiro}!*\n\n` +
        `É um prazer ter você conosco. Nossa intenção é direta: ampliar seus resultados ` +
        `e proteger sua carteira de prejuízos.\n\n` +
        `*O que você passa a ter:*\n\n` +
        `▸ Os prazos de todos os seus clientes em um só painel\n` +
        `▸ Avisos de risco da carteira direto neste número\n` +
        `▸ R$ 29,90 por mês, vitalício, por cliente ativo vinculado a você\n\n` +
        `Comece montando sua carteira: cpsystem.app.br/painel-analista\n\n` +
        `Desejamos um excelente começo. Qualquer dúvida, é só responder esta mensagem.\n\n` +
        `Contato CP System`
      : `👋 *Bem-vindo ao CP System, ${primeiro}!*\n\n` +
        `É um prazer ter a *${empresa?.nomeFantasia || empresa?.razaoSocial || "sua empresa"}* ` +
        `conosco. Nossa intenção é direta: otimizar seus resultados e diminuir seus prejuízos ` +
        `no contrato público.\n\n` +
        `*O que o sistema passa a fazer por você:*\n\n` +
        `▸ Acompanha prazos de vigência, entrega e pagamento, e avisa antes de virar multa\n` +
        `▸ Mostra o saldo disponível de cada ata e contrato, sem planilha\n` +
        `▸ Sinaliza entrega concluída que ainda está sem nota emitida\n\n` +
        `Comece por aqui: cpsystem.app.br/contratacoes/nova` +
        (fimTeste ? `\nSeu teste vai até *${fimTeste}*.` : "") +
        `\n\nDesejamos um excelente começo. Qualquer dúvida, é só responder esta mensagem.\n\n` +
        `Contato CP System`;

    const r = await dispararNotificacao({
      usuarioId: usuario.id,
      tipo: "BOAS_VINDAS",
      referenciaId: `boas-vindas-${conta.id}`,
      mensagem: texto,
    }).catch((e) => {
      console.error("[boas-vindas] WhatsApp falhou:", e);
      return { enviado: false } as { enviado: boolean };
    });
    entregouWhats = r.enviado;
  }

  // Link de confirmação de e-mail. Vai DENTRO das boas-vindas em vez de virar
  // um segundo e-mail: duas mensagens automáticas no mesmo minuto é a receita
  // pra a primeira ser ignorada e a segunda cair em spam.
  //
  // Confirmar não é obrigatório pra entrar — travar o acesso no cadastro
  // derrubaria conversão de cliente legítimo por causa de robô. O que a
  // confirmação faz é dar base pra a gente saber em quem falar de verdade.
  let linkConfirmacao: string | null = null;
  try {
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("hex");
    await prisma.magicLink.create({
      data: {
        token,
        usuarioId: usuario.id,
        motivo: "verificar-email",
        expiraEm: new Date(Date.now() + 7 * 86400000),
      },
    });
    linkConfirmacao = `https://cpsystem.app.br/verificar-email?token=${token}`;
  } catch (e) {
    console.error("[boas-vindas] não consegui criar o link de confirmação:", e);
  }

  // ── 2. E-mail pro cliente ─────────────────────────────────────────────────
  // Vale mesmo com WhatsApp: quem não marcou opt-in só tem este canal, e é onde
  // o cliente reencontra o acesso quando precisa dias depois.
  if (usuario.email) {
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <p style="font-size:18px;font-weight:700;margin:0 0 16px">Bem-vindo ao CP System, ${primeiro}!</p>
        <p style="margin:0 0 16px;line-height:1.6">
          ${
            ehAnalista
              ? "É um prazer ter você conosco. Nossa intenção é direta: ampliar seus resultados e proteger sua carteira de prejuízos."
              : `É um prazer ter a <strong>${empresa?.nomeFantasia || empresa?.razaoSocial || "sua empresa"}</strong> conosco. Nossa intenção é direta: otimizar seus resultados e diminuir seus prejuízos no contrato público.`
          }
        </p>
        <p style="margin:0 0 8px;font-weight:600">
          ${ehAnalista ? "O que você passa a ter" : "O que o sistema passa a fazer por você"}
        </p>
        <ul style="margin:0 0 16px;padding-left:20px;line-height:1.7">
          ${
            ehAnalista
              ? `<li>Os prazos de todos os seus clientes em um só painel.</li>
          <li>Avisos de risco da carteira por WhatsApp.</li>
          <li>R$ 29,90 por mês, vitalício, por cliente ativo vinculado a você.</li>`
              : `<li>Acompanha prazos de vigência, entrega e pagamento, e avisa antes de virar multa.</li>
          <li>Mostra o saldo disponível de cada ata e contrato, sem planilha.</li>
          <li>Sinaliza entrega concluída que ainda está sem nota emitida.</li>`
          }
        </ul>
        ${
          !ehAnalista && fimTeste
            ? `<p style="margin:0 0 16px;line-height:1.6">Seu teste vai até <strong>${fimTeste}</strong>.</p>`
            : ""
        }
        <p style="margin:0 0 16px">
          <a href="${ehAnalista ? "https://cpsystem.app.br/painel-analista" : "https://cpsystem.app.br/dashboard"}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Acessar o sistema</a>
        </p>
        ${
          linkConfirmacao
            ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569">
                 Confirme que este e-mail é seu para receber avisos de prazo e cobrança sem risco de perder nada:
                 <a href="${linkConfirmacao}" style="color:#1d4ed8;font-weight:600">confirmar meu e-mail</a>.
               </p>`
            : ""
        }
        <p style="margin:0 0 6px;line-height:1.6">
          Precisando de qualquer coisa: WhatsApp ${whatsappFormatado()} ou ${CONTATOS_CP_SYSTEM.email}.
        </p>
        <p style="margin:24px 0 0;color:#64748b;font-size:13px">Contato CP System</p>
      </div>`;

    await enviarEmail({
      para: usuario.email,
      assunto: "Bem-vindo ao CP System",
      html,
      texto:
        `Bem-vindo ao CP System, ${primeiro}!\n\n` +
        (ehAnalista
          ? `É um prazer ter você conosco. Nossa intenção é direta: ampliar seus resultados e proteger sua carteira de prejuízos.\n\n` +
            `O que você passa a ter:\n` +
            `- Os prazos de todos os seus clientes em um só painel\n` +
            `- Avisos de risco da carteira por WhatsApp\n` +
            `- R$ 29,90 por mês, vitalício, por cliente ativo vinculado a você\n\n` +
            `Comece montando sua carteira em https://cpsystem.app.br/painel-analista\n\n`
          : `É um prazer ter a ${empresa?.nomeFantasia || empresa?.razaoSocial || "sua empresa"} conosco. ` +
            `Nossa intenção é direta: otimizar seus resultados e diminuir seus prejuízos no contrato público.\n\n` +
            `O que o sistema passa a fazer por você:\n` +
            `- Acompanha prazos de vigência, entrega e pagamento, e avisa antes de virar multa\n` +
            `- Mostra o saldo disponível de cada ata e contrato, sem planilha\n` +
            `- Sinaliza entrega concluída que ainda está sem nota emitida\n\n` +
            `Comece em https://cpsystem.app.br/contratacoes/nova` +
            (fimTeste ? `\nSeu teste vai até ${fimTeste}.` : "") +
            `\n\n`) +
        `Desejamos um excelente começo.\n\n` +
        (linkConfirmacao ? `Confirme seu e-mail: ${linkConfirmacao}\n\n` : "") +
        `Dúvidas: WhatsApp ${whatsappFormatado()} ou ${CONTATOS_CP_SYSTEM.email}.\n\nContato CP System`,
    })
      .then(() => {
        entregouEmail = true;
      })
      .catch((e) => console.error("[boas-vindas] e-mail falhou:", e));
  }

  // ── 3. Aviso pra equipe ───────────────────────────────────────────────────
  const origem = conta.vinculosAnalista[0]
    ? `indicado por ${conta.vinculosAnalista[0].analista.nomeCompleto}`
    : "chegou direto (site/anúncio) — sem analista vinculado";

  await avisarEquipe(
    `🎉 *Cadastro novo no CP System*\n\n` +
      (ehAnalista
        ? `Tipo: *ANALISTA* — ${conta.analista?.nomeCompleto ?? usuario.nome}\n`
        : "") +
      `Empresa: *${empresa?.razaoSocial ?? (ehAnalista ? "(conta de analista)" : "(sem empresa)")}*` +
      (empresa?.cnpj ? `\nCNPJ: ${empresa.cnpj}` : "") +
      `\nResponsável: ${usuario.nome} — ${usuario.email}` +
      (usuario.telefoneWhatsApp ? `\nWhatsApp: ${usuario.telefoneWhatsApp}` : "\nWhatsApp: não informado") +
      `\nPlano: ${conta.plano}${fimTeste ? ` · teste até ${fimTeste}` : ""}` +
      `\nOrigem: ${origem}\n\n` +
      (entregouWhats || entregouEmail
        ? `Boas-vindas enviadas por ${[entregouWhats ? "WhatsApp" : null, entregouEmail ? "e-mail" : null].filter(Boolean).join(" e ")}.`
        : `⚠️ As boas-vindas NÃO saíram (nem WhatsApp nem e-mail) — vale um contato manual.`),
  ).catch((e) => console.error("[boas-vindas] aviso à equipe falhou:", e));

  // Marca por último, e mesmo quando nenhum canal entregou: o que não pode
  // acontecer é a rotina diária reprocessar a mesma conta pra sempre. Falha de
  // entrega vira contato manual (o alerta acima diz isso), não retentativa
  // automática infinita.
  await prisma.logAuditoria
    .create({
      data: {
        contaId: conta.id,
        usuarioId: usuario.id,
        acao: "CRIAR",
        recurso: RECURSO_BOAS_VINDAS,
        recursoId: conta.id,
        resumo: `Boas-vindas enviadas por ${
          [entregouWhats ? "WhatsApp" : null, entregouEmail ? "e-mail" : null]
            .filter(Boolean)
            .join(" e ") || "nenhum canal"
        }`,
      },
    })
    .catch((e) => console.error("[boas-vindas] marca de auditoria falhou:", e));

  return true;
}
