"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { revogarConta } from "@/lib/googleCalendar";

type Result = { erro?: string; ok?: boolean };

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
