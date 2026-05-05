import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { exigirUsuario } from "@/lib/auth";

const anthropic = new Anthropic();

const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const PROMPT = `Você é um assistente especializado em dados cadastrais de empresas brasileiras.
Analise o documento e extraia as informações da empresa. Retorne SOMENTE um objeto JSON válido com as chaves abaixo.
Use null para campos não encontrados. Não invente dados — só extraia o que está explicitamente no documento.

Chaves esperadas:
- razaoSocial: string | null
- nomeFantasia: string | null
- cnpj: string | null  (formato: 00.000.000/0000-00)
- porte: "MEI" | "ME" | "EPP" | "MEDIA" | "GRANDE" | null
- cnaePrincipal: string | null  (código completo, ex: "4520-0/01")
- cnaesSecundarios: string | null  (códigos separados por vírgula)
- naturezaJuridica: "EI" | "EIRELI" | "LTDA" | "SLU" | "SA_FECHADA" | "SA_ABERTA" | "SS" | "COOPERATIVA" | "COOP_SOCIAL" | "SOC_PROFISSIONAL" | "EMPRESA_PUBLICA" | "SEM_FINS_LUCRATIVOS" | "OUTRA" | null
- endereco: string | null  (logradouro + número + bairro, sem CEP)
- cep: string | null  (formato: 00000-000)
- email: string | null
- telefones: string | null
- responsavel: string | null  (nome do sócio administrador ou representante legal)`;

export async function POST(req: NextRequest) {
  try {
    await exigirUsuario();
  } catch {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida" }, { status: 400 });
  }

  const arquivo = form.get("arquivo") as File | null;
  if (!arquivo) return NextResponse.json({ erro: "Nenhum arquivo enviado" }, { status: 400 });
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return NextResponse.json(
      { erro: "Formato não suportado. Envie PDF ou imagem (JPG, PNG, WEBP)." },
      { status: 400 },
    );
  }
  if (arquivo.size > MAX_BYTES) {
    return NextResponse.json({ erro: "Arquivo muito grande. Limite de 10 MB." }, { status: 400 });
  }

  const bytes = await arquivo.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  const content: Anthropic.Messages.ContentBlockParam[] =
    arquivo.type === "application/pdf"
      ? [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: PROMPT },
        ]
      : [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: arquivo.type as "image/jpeg" | "image/png" | "image/webp",
              data: base64,
            },
          },
          { type: "text", text: PROMPT },
        ];

  let text: string;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });
    text = msg.content.find((c) => c.type === "text")?.text ?? "";
  } catch (err) {
    console.error("Anthropic error:", err);
    return NextResponse.json({ erro: "Falha ao processar com IA. Tente novamente." }, { status: 502 });
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ erro: "IA não retornou dados estruturados." }, { status: 500 });
  }

  try {
    const dados = JSON.parse(jsonMatch[0]);
    return NextResponse.json(dados);
  } catch {
    return NextResponse.json({ erro: "Erro ao interpretar resposta da IA." }, { status: 500 });
  }
}
