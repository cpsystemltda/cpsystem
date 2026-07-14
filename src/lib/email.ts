import "server-only";
import nodemailer from "nodemailer";

// Envio de email via SMTP (Regina 14/07). Padrao Google Workspace:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=contato@cpsystem.app.br  (email do workspace)
//   SMTP_PASS=<App Password gerado em myaccount.google.com/apppasswords>
//   EMAIL_FROM="CP System <contato@cpsystem.app.br>"
//
// Requisitos: Google exige App Password (2FA ligado). Nao use a senha
// normal da conta — nao funciona.

const HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const PORT = Number(process.env.SMTP_PORT || 465);
const USER = process.env.SMTP_USER || "";
const PASS = process.env.SMTP_PASS || "";
const FROM = process.env.EMAIL_FROM || "CP System <contato@cpsystem.app.br>";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  if (!USER || !PASS) {
    throw new Error("SMTP nao configurado — defina SMTP_USER e SMTP_PASS.");
  }
  transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: USER, pass: PASS },
  });
  return transporter;
}

export type EnvioEmailOpts = {
  para: string;
  assunto: string;
  html: string;
  texto?: string;
  anexos?: Array<{ filename: string; url?: string; content?: Buffer | string }>;
  responder?: string; // Reply-To
};

// Retorna { ok, messageId } ou throw. Caller decide se propaga.
export async function enviarEmail(opts: EnvioEmailOpts): Promise<{ messageId: string }> {
  const t = getTransporter();

  // Baixa anexos por URL (quando fornecido `url` no lugar de `content`)
  // O Nodemailer aceita `path` (URL) diretamente, mas alguns servidores nao
  // gostam de streaming — melhor baixar antes.
  const anexosProntos = await Promise.all(
    (opts.anexos ?? []).map(async (a) => {
      if (a.content) return { filename: a.filename, content: a.content };
      if (a.url) {
        const r = await fetch(a.url);
        if (!r.ok) throw new Error(`falha ao baixar anexo ${a.url}: ${r.status}`);
        const buffer = Buffer.from(await r.arrayBuffer());
        return { filename: a.filename, content: buffer };
      }
      throw new Error("anexo sem content nem url");
    }),
  );

  const info = await t.sendMail({
    from: FROM,
    to: opts.para,
    subject: opts.assunto,
    text: opts.texto,
    html: opts.html,
    attachments: anexosProntos,
    replyTo: opts.responder || FROM,
  });
  return { messageId: info.messageId ?? "" };
}

// Helper de status pra UI de admin
export function statusSmtp(): { configurado: boolean; host: string; user: string } {
  return {
    configurado: !!(USER && PASS),
    host: HOST,
    user: USER ? `${USER.slice(0, 3)}...${USER.slice(-4)}` : "(nao configurado)",
  };
}
