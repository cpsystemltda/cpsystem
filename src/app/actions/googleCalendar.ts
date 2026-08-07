"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { revogarConta } from "@/lib/googleCalendar";

type Result = { erro?: string; ok?: boolean };

// Salva o que o CP System pode mandar pra agenda do cliente.
// Leo 30/07: "tem que me dar a opcao de escolher... senao vai todas, ai vira
// uma zona". Escolher QUAIS agendas do Google integrar exigiria permissao pra
// enxergar todas elas (scope calendar.events) — o oposto do que ele quer. O
// controle util e sobre o que SAI daqui pra agenda dedicada.
export async function salvarPreferenciasGoogleAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const conta = await prisma.googleAccount.findUnique({
    where: { usuarioId: usuario.id },
    select: { id: true },
  });
  if (!conta) return { erro: "Nenhuma conta Google conectada." };

  // Checkbox ausente no FormData = desmarcado.
  const lig = (campo: string) => formData.get(campo) === "on";

  await prisma.googleAccount.update({
    where: { id: conta.id },
    data: {
      syncEmpenhos: lig("syncEmpenhos"),
      syncAtas: lig("syncAtas"),
      syncContratos: lig("syncContratos"),
      syncGarantias: lig("syncGarantias"),
      syncCobrancas: lig("syncCobrancas"),
    },
  });

  revalidatePath("/conta/integracoes");
  return { ok: true };
}

// Desconecta a conta Google do usuario atual: revoga no Google e
// remove o registro local. Empenhos ja sincronizados deixam de receber
// updates mas os eventos no Google Calendar permanecem (usuario decide
// se quer apagar manualmente).
export async function desconectarGoogleAction(
  _p: Result | null,
  _formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const conta = await prisma.googleAccount.findUnique({
    where: { usuarioId: usuario.id },
  });
  if (!conta) return { erro: "Nenhuma conta Google conectada." };

  try {
    await revogarConta(conta);
    revalidatePath("/conta/integracoes");
    return { ok: true };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao desconectar." };
  }
}
