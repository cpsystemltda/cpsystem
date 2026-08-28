import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "@/lib/whatsapp";
import { enviarEmail } from "@/lib/email";
import { avisarEquipe } from "@/lib/alertaInterno";
import { whatsappFormatado, CONTATOS_CP_SYSTEM } from "@/lib/contatosCpSystem";

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
 */
export async function darBoasVindas(contaId: string): Promise<void> {
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
  if (!conta) return;

  const usuario = conta.usuarios[0];
  const empresa = conta.empresas[0];
  if (!usuario) return;

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
    const texto = ehAnalista
      ? `👋 *Bem-vindo ao CP System, ${primeiro}!*\n\n` +
        `Seu cadastro de analista está ativo.\n\n` +
        `*Por onde começar:*\n` +
        `1. Monte sua carteira em cpsystem.app.br/painel-analista\n` +
        `2. Cada cliente que assinar por você rende *R$ 29,90/mês*, a partir da 1ª fatura paga\n` +
        `3. Os avisos da sua carteira chegam aqui mesmo, neste número\n\n` +
        `Qualquer dúvida, é só responder esta mensagem — quem atende é gente, não robô.\n\n` +
        `Contato CP System`
      : `👋 *Bem-vindo ao CP System, ${primeiro}!*\n\n` +
        `Sua conta de *${empresa?.nomeFantasia || empresa?.razaoSocial || "sua empresa"}* está ativa` +
        (fimTeste ? `, com teste liberado até *${fimTeste}*` : "") +
        `.\n\n` +
        `*Por onde começar:*\n` +
        `1. Cadastre uma ata, contrato ou empenho em cpsystem.app.br/contratacoes/nova\n` +
        `2. A partir daí o sistema acompanha prazos de entrega, vigência e pagamento por você\n` +
        `3. Os avisos importantes chegam aqui mesmo, neste número\n\n` +
        `Qualquer dúvida, é só responder esta mensagem — quem atende é gente, não robô.\n\n` +
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
              ? "Seu cadastro de analista está ativo."
              : `A conta de <strong>${empresa?.razaoSocial ?? "sua empresa"}</strong> está ativa${
                  fimTeste ? `, com teste liberado até <strong>${fimTeste}</strong>` : ""
                }.`
          }
        </p>
        <p style="margin:0 0 8px;font-weight:600">Por onde começar</p>
        <ol style="margin:0 0 16px;padding-left:20px;line-height:1.7">
          ${
            ehAnalista
              ? `<li>Monte sua carteira no painel do analista.</li>
          <li>Cada cliente que assinar por você rende R$ 29,90/mês, a partir da 1ª fatura paga.</li>
          <li>Os avisos da sua carteira chegam por WhatsApp e por aqui.</li>`
              : `<li>Cadastre uma ata, contrato ou empenho.</li>
          <li>O sistema passa a acompanhar prazos de entrega, vigência e pagamento.</li>
          <li>Os avisos importantes chegam por WhatsApp e por aqui.</li>`
          }
        </ol>
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
          ? `Seu cadastro de analista está ativo.\n\nComece montando sua carteira em https://cpsystem.app.br/painel-analista\n\n`
          : `A conta de ${empresa?.razaoSocial ?? "sua empresa"} está ativa` +
            (fimTeste ? `, com teste liberado até ${fimTeste}` : "") +
            `.\n\nComece cadastrando uma ata, contrato ou empenho em https://cpsystem.app.br/contratacoes/nova\n\n`) +
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
}
