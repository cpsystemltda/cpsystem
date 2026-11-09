import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { janelaExecucao, prazoLimiteOuVigencia } from "@/lib/prazoEntrega";

/**
 * API pública do CP System (pedido do Léo/Green, vídeo de 06/11/2026: "gerar
 * um token de API para o meu sistema interno conversar com o CP System —
 * baixar os eventos para a agenda e informar o que foi pago").
 *
 * - Token por conta, criado pelo ADMIN em Conta › Integrações. Guardado só
 *   como sha256; o valor completo aparece uma vez.
 * - Escopos: "leitura" (execuções, eventos, contratos, atas) e
 *   "pagamentos:escrita" (registrar a baixa de pagamento de uma execução).
 * - Limite de 120 chamadas por minuto por token (best-effort, por instância).
 */

export const ESCOPOS = ["leitura", "pagamentos:escrita"] as const;
export type Escopo = (typeof ESCOPOS)[number];
export const ROTULO_ESCOPO: Record<Escopo, string> = {
  leitura: "Leitura (execuções, agenda de eventos, contratos e atas)",
  "pagamentos:escrita": "Registrar pagamento (baixa) de execução",
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function gerarToken(): { token: string; prefixo: string; hash: string } {
  const token = `cps_live_${randomBytes(24).toString("base64url")}`;
  return { token, prefixo: token.slice(0, 13), hash: hashToken(token) };
}

export type ContextoApi = { tokenId: string; contaId: string; escopos: string[] };

const janela = new Map<string, { inicio: number; n: number }>();
const LIMITE_MIN = 120;

export function erroApi(status: number, codigo: string, mensagem: string): NextResponse {
  return NextResponse.json({ erro: { codigo, mensagem } }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Autentica `Authorization: Bearer cps_live_…`; devolve contexto ou a resposta de erro. */
export async function autenticarApi(req: Request, escopo: Escopo): Promise<ContextoApi | NextResponse> {
  const auth = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(cps_live_[\w-]{20,})$/.exec(auth.trim());
  if (!m) return erroApi(401, "token_ausente", "Envie o cabeçalho Authorization: Bearer <token>.");
  const t = await prisma.apiToken.findUnique({ where: { hash: hashToken(m[1]) }, select: { id: true, contaId: true, escopos: true, revogadoEm: true, expiraEm: true, conta: { select: { statusAssinatura: true, arquivadaEm: true } } } });
  if (!t || t.revogadoEm || (t.expiraEm && t.expiraEm < new Date())) return erroApi(401, "token_invalido", "Token inválido, revogado ou expirado.");
  if (t.conta.arquivadaEm || t.conta.statusAssinatura === "CANCELADA") return erroApi(403, "conta_inativa", "A conta não está ativa.");
  if (!t.escopos.includes(escopo)) return erroApi(403, "escopo_insuficiente", `Este token não tem o escopo "${escopo}".`);
  const agora = Date.now();
  const j = janela.get(t.id);
  if (!j || agora - j.inicio > 60_000) janela.set(t.id, { inicio: agora, n: 1 });
  else if (++j.n > LIMITE_MIN) return erroApi(429, "limite", `Limite de ${LIMITE_MIN} chamadas por minuto.`);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  prisma.apiToken.update({ where: { id: t.id }, data: { ultimoUsoEm: new Date(), ultimoIp: ip, usos: { increment: 1 } } }).catch(() => {});
  return { tokenId: t.id, contaId: t.contaId, escopos: t.escopos };
}

export function ehErro(x: ContextoApi | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}

export function parseDataParam(v: string | null): Date | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00.000Z`);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const dia = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export const SELECT_EXECUCAO = {
  id: true,
  instrumento: true,
  numero: true,
  identificador: true,
  objeto: true,
  status: true,
  orgaoNome: true,
  orgaoCnpj: true,
  dataEmissao: true,
  dataPrevistaExecucao: true,
  vigenciaInicio: true,
  vigenciaFim: true,
  prazoEntregaModo: true,
  prazoEntregaDias: true,
  prazoEntregaUnidade: true,
  dataEntregaCerta: true,
  dataEntregaInicio: true,
  dataEntregaFim: true,
  horaInicio: true,
  horaFim: true,
  prazoPagamentoDias: true,
  dataPedidoRecebido: true,
  dataDespacho: true,
  dataEntrega: true,
  dataNfEmitida: true,
  dataNfEncaminhada: true,
  dataPagamento: true,
  numeroOrdemFornecimento: true,
  criadoEm: true,
  atualizadoEm: true,
  empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } },
  contrato: { select: { id: true, numero: true } },
  ata: { select: { id: true, numero: true } },
  itens: { select: { id: true, descricao: true, unidade: true, quantidade: true, valorUnitario: true, valorTotal: true } },
} as const;

type ExecucaoRow = {
  id: string;
  instrumento: string;
  numero: string;
  identificador: string | null;
  objeto: string;
  status: string;
  orgaoNome: string;
  orgaoCnpj: string;
  dataEmissao: Date;
  dataPrevistaExecucao: Date | null;
  vigenciaInicio: Date;
  vigenciaFim: Date;
  prazoEntregaModo: "RELATIVO" | "DATA_CERTA" | "PRAZO_CERTO" | "SOB_DEMANDA";
  prazoEntregaDias: number | null;
  prazoEntregaUnidade: "DIAS" | "MESES" | "ANOS";
  dataEntregaCerta: Date | null;
  dataEntregaInicio: Date | null;
  dataEntregaFim: Date | null;
  horaInicio: string | null;
  horaFim: string | null;
  prazoPagamentoDias: number | null;
  dataPedidoRecebido: Date | null;
  dataDespacho: Date | null;
  dataEntrega: Date | null;
  dataNfEmitida: Date | null;
  dataNfEncaminhada: Date | null;
  dataPagamento: Date | null;
  numeroOrdemFornecimento: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  empresa: { id: string; razaoSocial: string; nomeFantasia: string | null; cnpj: string };
  contrato: { id: string; numero: string } | null;
  ata: { id: string; numero: string } | null;
  itens: { id: string; descricao: string; unidade: string; quantidade: number; valorUnitario: number; valorTotal: number }[];
};

export function serializarExecucao(e: ExecucaoRow) {
  const jan = janelaExecucao(e);
  const valorTotal = Math.round(e.itens.reduce((s, i) => s + i.valorTotal, 0) * 100) / 100;
  return {
    id: e.id,
    instrumento: e.instrumento,
    numero: e.numero,
    identificador: e.identificador,
    objeto: e.objeto,
    status: e.status,
    pago: e.status === "PAGO",
    valorTotal,
    empresa: { id: e.empresa.id, nome: e.empresa.nomeFantasia || e.empresa.razaoSocial, cnpj: e.empresa.cnpj },
    orgao: { nome: e.orgaoNome, cnpj: e.orgaoCnpj },
    contrato: e.contrato,
    ata: e.ata,
    ordemFornecimento: e.numeroOrdemFornecimento,
    datas: {
      emissao: dia(e.dataEmissao),
      prazoEntrega: dia(prazoLimiteOuVigencia(e)),
      execucaoInicio: dia(jan.inicio),
      execucaoFim: dia(jan.fim),
      horaInicio: e.horaInicio,
      horaFim: e.horaFim,
      pedidoRecebido: dia(e.dataPedidoRecebido),
      despacho: dia(e.dataDespacho),
      entrega: dia(e.dataEntrega),
      nfEmitida: dia(e.dataNfEmitida),
      nfEncaminhada: dia(e.dataNfEncaminhada),
      pagamento: dia(e.dataPagamento),
      vigenciaInicio: dia(e.vigenciaInicio),
      vigenciaFim: dia(e.vigenciaFim),
    },
    prazoPagamentoDias: e.prazoPagamentoDias,
    itens: e.itens.map((i) => ({ id: i.id, descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade, valorUnitario: i.valorUnitario, valorTotal: i.valorTotal })),
    criadoEm: iso(e.criadoEm),
    atualizadoEm: iso(e.atualizadoEm),
    url: `https://cpsystem.app.br/execucao/${e.id}`,
  };
}

/** Evento de agenda (formato simples, fácil de importar em qualquer calendário). */
export function eventoDaExecucao(e: ExecucaoRow) {
  const s = serializarExecucao(e);
  return {
    id: `execucao-${e.id}`,
    execucaoId: e.id,
    titulo: `${e.numero}${e.identificador ? ` · ${e.identificador}` : ""} — ${e.orgaoNome}`,
    descricao: e.objeto,
    inicio: s.datas.execucaoInicio,
    fim: s.datas.execucaoFim,
    horaInicio: e.horaInicio,
    horaFim: e.horaFim,
    diaInteiro: !e.horaInicio,
    status: e.status,
    pago: s.pago,
    valorTotal: s.valorTotal,
    empresa: s.empresa.nome,
    url: s.url,
  };
}
