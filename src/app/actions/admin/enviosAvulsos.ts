"use server";

import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { enviarTexto, enviarDocumentoPdf } from "@/lib/whatsapp";
import { gerarMagicLink, urlDoMagicLink } from "@/lib/magicLink";
import { VERSAO_CONTRATO_ANALISTA } from "@/components/legal/ContratoAnalistaParceiro";

// Envios avulsos disparados MANUALMENTE por super admin no /admin.
// Regina 13/07:
//   1) enviarContratoAnalistaWaAction — manda pro Igor revisar o contrato v1.0
//   2) enviarMagicLinkMigracaoAction — manda pro Leo (ou outro TRIAL antigo)
//      concluir a migracao. Link unico, 48h de validade.

export type EnvioResult = { erro?: string; ok?: boolean; detalhe?: string };

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://cpsystem.app.br").replace(/\/$/, "");
}

// Envia o PDF do contrato de analista para um telefone informado.
// Uso tipico: Regina envia pra Igor pra revisao.
export async function enviarContratoAnalistaWaAction(
  _prev: EnvioResult | null,
  formData: FormData,
): Promise<EnvioResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Somente super admin." };

  const telefone = String(formData.get("telefone") || "").trim();
  const nome = String(formData.get("nome") || "").trim() || "revisor";
  if (telefone.replace(/\D/g, "").length < 10) {
    return { erro: "Telefone inválido — inclua DDD." };
  }

  // Aviso curto antes do PDF (contexto no WA)
  const aviso =
    `📄 *Contrato de Adesão ao Programa de Analista Parceiro — CP System*\n\n` +
    `Versão ${VERSAO_CONTRATO_ANALISTA}. Segue em PDF pra revisão.\n\n` +
    `Se quiser sugerir alteração, responde aqui neste chat.`;

  try {
    await enviarTexto(telefone, aviso);
    const url = `${baseUrl()}/contratos/analista/pdf`;
    const res = await enviarDocumentoPdf(
      telefone,
      url,
      `Contrato-Analista-Parceiro-CP-System-v${VERSAO_CONTRATO_ANALISTA}.pdf`,
      `Contrato Analista v${VERSAO_CONTRATO_ANALISTA} — para revisão`,
    );

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "NotificacaoWhatsApp",
      resumo: `Enviou contrato analista v${VERSAO_CONTRATO_ANALISTA} pra ${nome} (${telefone})`,
    });

    return { ok: true, detalhe: `Enviado (messageId: ${res.messageId}).` };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Falha ao enviar." };
  }
}

// Gera magic link e envia por WA pro usuario informado concluir a migracao.
export async function enviarMagicLinkMigracaoAction(
  _prev: EnvioResult | null,
  formData: FormData,
): Promise<EnvioResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Somente super admin." };

  const usuarioAlvoId = String(formData.get("usuarioId") || "").trim();
  const motivo = String(formData.get("motivo") || "migracao").trim() || "migracao";
  if (!usuarioAlvoId) return { erro: "Escolha o usuário destino." };

  const alvo = await prisma.usuario.findUnique({
    where: { id: usuarioAlvoId },
    select: {
      id: true,
      nome: true,
      telefoneWhatsApp: true,
      optInWhatsApp: true,
      conta: { select: { tipo: true } },
    },
  });
  if (!alvo) return { erro: "Usuário não encontrado." };
  if (!alvo.telefoneWhatsApp) return { erro: "Usuário sem telefone cadastrado." };

  try {
    const { token, expiraEm } = await gerarMagicLink({
      usuarioId: alvo.id,
      motivo,
      criadoPor: usuario.id,
    });
    const link = urlDoMagicLink(token);
    const primeiroNome = alvo.nome.split(" ")[0];
    const validade = expiraEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

    const mensagem =
      `Olá ${primeiroNome}, aqui é do CP System.\n\n` +
      `Preparamos tudo pra você concluir a migração da sua conta. É rapidinho:\n` +
      `1) Confirme os dados da sua empresa (razão social, CNPJ, endereço);\n` +
      `2) Aceite a versão atualizada do contrato;\n` +
      `3) Cadastre o cartão pra que a cobrança comece automaticamente no dia que você escolher.\n\n` +
      `Este link entra logado direto na sua conta (uso único, válido até ${validade}):\n` +
      `${link}\n\n` +
      `Qualquer dúvida, é só responder por aqui.`;

    const res = await enviarTexto(alvo.telefoneWhatsApp, mensagem);

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "MagicLink",
      resumo: `Enviou magic link de migração pra ${alvo.nome} (${alvo.telefoneWhatsApp})`,
    });

    return { ok: true, detalhe: `Enviado (messageId: ${res.messageId}). Link expira ${validade}.` };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Falha ao enviar." };
  }
}
