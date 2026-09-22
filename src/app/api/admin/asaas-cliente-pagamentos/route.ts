import { NextRequest, NextResponse } from "next/server";
import { asaasBaseUrl } from "@/lib/asaas-env";

/**
 * O que o Asaas diz sobre as cobranças de um cliente.
 *
 * Existe por causa de um erro caro: em 21/09 eu afirmei à Regina que o cartão
 * do Léo nunca havia sido cobrado automaticamente, olhando só o nosso banco. O
 * Asaas mostrava o contrário — julho foi debitado normalmente. A regra que
 * ficou: *sobre pagamento, quem responde é o gateway, nunca a nossa tabela.*
 *
 * Consultar isso exigia a chave da API, que só existe no servidor. Sem um
 * caminho pronto, a checagem virava "puxar segredo pra máquina" — e aí ou se
 * checa errado, ou não se checa. Este endpoint é o caminho certo.
 *
 * A base vem de `asaasBaseUrl()`, nunca comparada na mão: o outro endpoint de
 * diagnóstico comparava `=== "producao"` enquanto a variável dizia
 * "production", caía no sandbox e devolvia lista vazia — que foi exatamente o
 * que me fez errar.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }
  const customer = url.searchParams.get("customer");
  const invoice = url.searchParams.get("invoice");
  if (!customer && !invoice) {
    return NextResponse.json({ erro: "informe ?customer=cus_... ou ?invoice=inv_..." }, { status: 400 });
  }

  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return NextResponse.json({ erro: "ASAAS_API_KEY ausente" }, { status: 500 });

  const base = asaasBaseUrl();

  // Uma nota específica: é daqui que sai o PDF para entregar ao cliente.
  if (invoice) {
    const ri = await fetch(`${base}/invoices/${invoice}`, {
      headers: { access_token: apiKey, "User-Agent": "CP System" },
    });
    if (!ri.ok) return NextResponse.json({ erro: `Asaas HTTP ${ri.status}` }, { status: 502 });
    const inv = (await ri.json()) as Record<string, unknown>;
    return NextResponse.json({
      id: inv.id,
      status: inv.status,
      numero: inv.number,
      valor: inv.value,
      emitidaEm: inv.effectiveDate ?? null,
      pdf: inv.pdfUrl ?? null,
      xml: inv.xmlUrl ?? null,
      link: inv.rpsSerie ? null : (inv.pdfUrl ?? null),
    });
  }
  const r = await fetch(`${base}/payments?customer=${customer}&limit=20&order=desc`, {
    headers: { access_token: apiKey, "User-Agent": "CP System" },
  });
  if (!r.ok) {
    return NextResponse.json({ erro: `Asaas HTTP ${r.status}`, base }, { status: 502 });
  }
  const j = (await r.json()) as { data?: Record<string, unknown>[] };

  return NextResponse.json({
    base,
    total: j.data?.length ?? 0,
    pagamentos: (j.data ?? []).map((p) => ({
      id: p.id,
      vencimento: p.dueDate,
      status: p.status,
      valor: p.value,
      forma: p.billingType,
      pagoEm: p.paymentDate ?? null,
      confirmadoEm: p.confirmedDate ?? null,
      link: p.invoiceUrl ?? null,
      descricao: p.description ?? null,
    })),
  });
}
