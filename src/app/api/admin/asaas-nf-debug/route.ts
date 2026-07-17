import { NextRequest, NextResponse } from "next/server";

// Diagnostica por que o botao "Emitir NF" esta desabilitado na cobranca.
// Regina 17/07: tentou emitir manualmente no painel Asaas e todos os botoes
// aparecem desabilitados.

const BASE_PROD = "https://api.asaas.com/v3";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const paymentId = url.searchParams.get("payment") || "pay_ao3rx1tqoqqsy3o8";
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return NextResponse.json({ erro: "ASAAS_API_KEY faltando" }, { status: 500 });

  const headers = { access_token: apiKey, "Content-Type": "application/json" };

  // 1) Detalhes do payment
  const pay = await fetch(`${BASE_PROD}/payments/${paymentId}`, { headers }).then((r) => r.json());
  const custId = pay.customer;

  // 2) Detalhes do customer (pra ver se tem CPF/CNPJ, endereco, etc — obrigatorio pra NF)
  const cust = custId ? await fetch(`${BASE_PROD}/customers/${custId}`, { headers }).then((r) => r.json()) : null;

  // 3) Serviços cadastrados na conta (pra emitir NF precisa ter pelo menos um)
  const servicos = await fetch(`${BASE_PROD}/invoices/settings/services`, { headers }).then((r) => r.json()).catch((e) => ({ erro: String(e) }));

  // 4) Config municipal (pra ver se tudo salvou certo)
  const config = await fetch(`${BASE_PROD}/invoices/settings/municipalSettings`, { headers }).then((r) => r.json()).catch((e) => ({ erro: String(e) }));

  // 5) Tenta CRIAR uma invoice pra ver qual erro (nao vai chegar a autorizar sem servico id)
  const servicoId = servicos?.data?.[0]?.id;
  let tentativaEmissao: unknown = null;
  if (servicoId) {
    const criar = await fetch(`${BASE_PROD}/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        payment: paymentId,
        serviceDescription: "Teste de emissao — validacao de configuracao NFSe",
        observations: "Teste automatico via API",
        value: pay.value,
        deductions: 0,
        effectiveDate: new Date().toISOString().slice(0, 10),
        municipalServiceId: servicoId,
      }),
    });
    tentativaEmissao = { status: criar.status, body: await criar.json() };
  }

  return NextResponse.json({
    paymentId,
    payment: {
      status: pay.status,
      value: pay.value,
      billingType: pay.billingType,
      customer: custId,
      dateCreated: pay.dateCreated,
      confirmedDate: pay.confirmedDate,
    },
    customer: cust ? {
      id: cust.id,
      name: cust.name,
      cpfCnpj: cust.cpfCnpj,
      email: cust.email,
      address: cust.address,
      addressNumber: cust.addressNumber,
      city: cust.city,
      state: cust.state,
      postalCode: cust.postalCode,
    } : null,
    servicosCadastrados: servicos,
    configMunicipal: config,
    tentativaEmissao,
  });
}
