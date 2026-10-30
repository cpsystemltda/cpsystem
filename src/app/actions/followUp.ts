"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { temAcessoInterno } from "@/lib/acessoInterno";
import { registrarFollowUp, CANAIS, RESULTADOS } from "@/lib/followUpClientes";
import type { CanalFollowUp, ResultadoFollowUp } from "@/generated/prisma/client";

/**
 * Registro de um contato de follow-up com cliente (Igor, 30/10/2026).
 *
 * Quem registra é a equipe do CP System; o cliente nunca vê esta tela. O
 * marco da cadência não vem do formulário — a lib decide pela idade do
 * cliente, para o registro não depender de ninguém lembrar "em que marco ele
 * estava".
 */
export type ResultadoRegistro = { ok?: true; marco?: number; erro?: string };

export async function registrarFollowUpAction(
  _prev: ResultadoRegistro | null,
  formData: FormData,
): Promise<ResultadoRegistro> {
  const usuario = await exigirUsuario();
  if (!(await temAcessoInterno(usuario))) return { erro: "Sem acesso ao follow-up de clientes." };
  // Registro é escrita: não acontece durante a observação de um cliente.
  await bloquearEspionagem();

  const texto = (k: string) => String(formData.get(k) ?? "").trim();

  const contaId = texto("contaId");
  if (!contaId) return { erro: "Cliente não informado." };

  const resultado = texto("resultado") as ResultadoFollowUp;
  if (!RESULTADOS.includes(resultado)) return { erro: "Informe se conseguiu falar com o cliente." };

  const canal = texto("canal") as CanalFollowUp;
  if (!CANAIS.includes(canal)) return { erro: "Informe por onde foi o contato." };

  let retornarEm: Date | null = null;
  const retorno = texto("retornarEm");
  if (retorno) {
    const d = new Date(`${retorno}T12:00:00`);
    if (Number.isNaN(d.getTime())) return { erro: "Data de retorno inválida." };
    retornarEm = d;
  }

  try {
    const r = await registrarFollowUp(
      {
        contaId,
        resultado,
        canal,
        contatoNome: texto("contatoNome") || null,
        resumo: texto("resumo"),
        orientacoes: texto("orientacoes") || null,
        feedback: texto("feedback") || null,
        retornarEm,
      },
      { id: usuario.id, nome: usuario.nome },
    );
    revalidatePath("/follow-up");
    return { ok: true, marco: r.marcoDias };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não consegui salvar. Tente de novo." };
  }
}
