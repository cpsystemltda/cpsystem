import "server-only";
import { Resend } from "resend";

// Envio de email via Resend (Regina 17/07). Migrado de Google Workspace SMTP
// por Workspace admin bloquear SMTP externo.
//
// Env vars:
//   RESEND_API_KEY = re_...
//   EMAIL_FROM     = "CP System <contato@cpsystem.app.br>" (dominio verificado)
//
// Requisitos:
//   - Dominio cpsystem.app.br verificado em resend.com/domains (SPF + DKIM)
//   - API key com permissao de send

const API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.EMAIL_FROM || "CP System <contato@cpsystem.app.br>";

let client: Resend | null = null;
function getClient(): Resend {
  if (client) return client;
  if (!API_KEY) throw new Error("RESEND_API_KEY nao configurado");
  client = new Resend(API_KEY);
  return client;
}

export type EnvioEmailOpts = {
  para: string;
  assunto: string;
  html: string;
  texto?: string;
  anexos?: Array<{ filename: string; url?: string; content?: Buffer | string }>;
  responder?: string; // Reply-To
};

// Retorna { messageId } ou throw.
export async function enviarEmail(opts: EnvioEmailOpts): Promise<{ messageId: string }> {
  const c = getClient();

  // Resolve anexos: se veio URL, baixa; senao usa content direto
  const attachments = await Promise.all(
    (opts.anexos ?? []).map(async (a) => {
      if (a.content) {
        const content = typeof a.content === "string" ? Buffer.from(a.content) : a.content;
        return { filename: a.filename, content };
      }
      if (a.url) {
        const r = await fetch(a.url);
        if (!r.ok) throw new Error(`falha ao baixar anexo ${a.url}: ${r.status}`);
        const buffer = Buffer.from(await r.arrayBuffer());
        return { filename: a.filename, content: buffer };
      }
      throw new Error("anexo sem content nem url");
    }),
  );

  const { data, error } = await c.emails.send({
    from: FROM,
    to: opts.para,
    subject: opts.assunto,
    html: opts.html,
    text: opts.texto,
    replyTo: opts.responder || FROM,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (error) throw new Error(`Resend: ${error.name} — ${error.message}`);
  return { messageId: data?.id ?? "" };
}

// Helper de status pra UI de admin (mantem nome antigo pra nao quebrar callers)
export function statusSmtp(): { configurado: boolean; host: string; user: string } {
  return {
    configurado: !!API_KEY,
    host: "resend.com",
    user: API_KEY ? `${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}` : "(nao configurado)",
  };
}
