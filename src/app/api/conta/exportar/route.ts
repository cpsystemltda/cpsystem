import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUsuarioAtual } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Exportação dos dados da conta — direito do titular (LGPD, art. 18).
 *
 * Regina 28/08, item 6 da fila: não existia caminho no sistema para o cliente
 * pedir os próprios dados; seria trabalho manual nosso a cada pedido.
 *
 * Entrega um JSON com o que a conta tem no CP System. Documentos anexados não
 * entram no arquivo — entram as referências, porque cada um exige sessão para
 * abrir e empacotar 126 MB numa resposta HTTP não ajuda ninguém.
 */
export async function GET() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (usuario.perfil !== "ADMIN") {
    return NextResponse.json(
      { erro: "Só quem administra a conta pode exportar os dados." },
      { status: 403 },
    );
  }

  const contaId = usuario.contaId;
  const [conta, empresas, usuarios, atas, contratos, empenhos, cobrancas, notas, anexos, auditoria] =
    await Promise.all([
      prisma.conta.findUnique({
        where: { id: contaId },
        select: {
          id: true, tipo: true, plano: true, statusAssinatura: true, criadoEm: true,
          trialAteEm: true, proximoVencimento: true, diaVencimento: true,
          termosAceitosVersao: true, termosAceitosEm: true,
        },
      }),
      prisma.empresa.findMany({ where: { contaId } }),
      prisma.usuario.findMany({
        where: { contaId },
        select: {
          id: true, nome: true, email: true, perfil: true, cargo: true, cpf: true,
          telefoneWhatsApp: true, optInWhatsApp: true, dataNascimento: true,
          emailVerificadoEm: true, criadoEm: true,
        },
      }),
      prisma.ata.findMany({ where: { empresa: { contaId } }, include: { itens: true } }),
      prisma.contrato.findMany({ where: { empresa: { contaId } }, include: { itens: true } }),
      prisma.empenho.findMany({ where: { empresa: { contaId } }, include: { itens: true } }),
      prisma.cobranca.findMany({
        where: { contaId },
        select: { competencia: true, plano: true, forma: true, valor: true, vencimento: true, status: true, pagaEm: true },
      }),
      prisma.notaFiscal.findMany({
        where: { empresa: { contaId } },
        select: { numero: true, serie: true, status: true, valorServicos: true, descricao: true, criadoEm: true },
      }),
      prisma.arquivo.findMany({
        where: { contaId },
        select: { id: true, nomeOriginal: true, contentType: true, criadoEm: true },
      }),
      prisma.logAuditoria.findMany({
        where: { contaId },
        select: { acao: true, recurso: true, resumo: true, criadoEm: true },
        orderBy: { criadoEm: "desc" },
        take: 2000,
      }),
    ]);

  await registrarAuditoria({
    contaId,
    usuarioId: usuario.id,
    acao: "EXPORTAR",
    recurso: "Conta",
    recursoId: contaId,
    resumo: "Exportou os dados da conta (pedido de titular — LGPD)",
  }).catch(() => {});

  const pacote = {
    geradoEm: new Date().toISOString(),
    aviso:
      "Exportação de dados do CP System. Documentos anexados não vêm neste arquivo — " +
      "cada um continua acessível no sistema, e a lista deles está em 'anexos'.",
    conta,
    empresas,
    usuarios,
    atas,
    contratos,
    empenhos,
    cobrancas,
    notasFiscais: notas,
    anexos,
    historicoDeAuditoria: auditoria,
  };

  const nome = `cpsystem-dados-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(pacote, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
