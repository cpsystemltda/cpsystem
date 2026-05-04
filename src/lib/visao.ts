"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type Visao = "EMPRESA" | "ANALISTA" | "ADMIN_PLATAFORMA";

const COOKIE_VISAO = "cp_visao";

export async function lerVisao(): Promise<Visao | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE_VISAO)?.value;
  if (v === "EMPRESA" || v === "ANALISTA" || v === "ADMIN_PLATAFORMA") return v;
  return null;
}

export async function trocarVisaoAction(formData: FormData) {
  const visao = String(formData.get("visao")) as Visao;
  if (!["EMPRESA", "ANALISTA", "ADMIN_PLATAFORMA"].includes(visao)) {
    throw new Error("Visão inválida.");
  }
  const jar = await cookies();
  jar.set(COOKIE_VISAO, visao, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
  if (visao === "ADMIN_PLATAFORMA") redirect("/admin-plataforma");
  if (visao === "ANALISTA") redirect("/painel-analista");
  redirect("/dashboard");
}
