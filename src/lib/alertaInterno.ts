import { prisma } from "@/lib/prisma";
import { enviarTexto } from "@/lib/whatsapp";

/**
 * Alerta operacional pra equipe do CP System (grupo ⚙️Suporte, com fallback).
 *
 * Existia dentro do webhook de entrada e servia só pra chamado de suporte.
 * Virou lib em 28/08 porque o mesmo caminho passou a ser usado pra avisar
 * cadastro novo — e porque o caminho tinha dois furos que só apareceram quando
 * a Regina cobrou "nem eu nem o Igor fomos alertados":
 *
 * 1. O id do grupo ia por `formatarTelefone`, que o rejeitava como telefone.
 *    Hoje o envio usa `formatarDestino`, que aceita grupo.
 * 2. O fallback exigia `optInWhatsApp: true` e os super admins estão todos com
 *    opt-in false, então a consulta voltava vazia.
 *
 * Opt-in é preferência sobre notificação de PRODUTO. Alerta interno de operação
 * — cliente esperando resposta, cliente novo entrando — não é opcional, e por
 * isso não é filtrado aqui. Se não houver ninguém pra avisar, isso vai pro log
 * em vez de sumir em silêncio, que foi exatamente como o problema durou meses.
 */
export async function avisarEquipe(texto: string): Promise<{ entregue: boolean }> {
  const grupoId = process.env.SUPORTE_GROUP_ID || "";
  if (grupoId) {
    try {
      await enviarTexto(grupoId, texto);
      return { entregue: true };
    } catch (err) {
      console.error("[alerta-interno] falha ao postar no grupo de suporte:", err);
    }
  }

  const superAdmins = await prisma.usuario.findMany({
    where: { superAdmin: true, telefoneWhatsApp: { not: null } },
    select: { nome: true, telefoneWhatsApp: true },
  });
  if (superAdmins.length === 0) {
    console.error("[alerta-interno] nenhum super admin com telefone — alerta não tem pra onde ir");
    return { entregue: false };
  }

  let entregue = false;
  for (const admin of superAdmins) {
    if (!admin.telefoneWhatsApp) continue;
    try {
      await enviarTexto(admin.telefoneWhatsApp, texto);
      entregue = true;
    } catch (err) {
      console.error(`[alerta-interno] falha ao avisar ${admin.nome}:`, err);
    }
  }
  return { entregue };
}
