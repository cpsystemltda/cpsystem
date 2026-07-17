import { NextRequest, NextResponse } from "next/server";
import { enviarEmail, statusSmtp } from "@/lib/email";

// Envia um email de teste pra confirmar que SMTP funciona ponta a ponta.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const para = url.searchParams.get("para") || "regina.luiza@greis.com.br";
  const status = statusSmtp();
  if (!status.configurado) return NextResponse.json({ erro: "SMTP nao configurado", status });

  try {
    const r = await enviarEmail({
      para,
      assunto: "CP System — teste de SMTP",
      html: `<p>Se você está lendo isso, o SMTP do Google Workspace está funcionando.</p><p>Agora as notas fiscais emitidas pelos clientes serão enviadas por e-mail automaticamente.</p><p>— CP System</p>`,
      texto: "Teste de SMTP CP System",
    });
    return NextResponse.json({ ok: true, messageId: r.messageId, para, status });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: err instanceof Error ? err.message : String(err), status }, { status: 500 });
  }
}
