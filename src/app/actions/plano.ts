"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";

export async function alterarPlanoAction(_prev: { erro?: string; ok?: boolean } | null, formData: FormData) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const plano = String(formData.get("plano"));

  if (plano !== "BASICO" && plano !== "PREMIUM") {
    return { erro: "Plano inválido." };
  }

  await prisma.conta.update({
    where: { id: usuario.contaId },
    data: { plano },
  });

  revalidatePath("/juridico");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { ok: true };
}
