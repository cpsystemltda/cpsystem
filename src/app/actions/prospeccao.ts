"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";

/**
 * Registro das ligações de prospecção.
 *
 * Regina 08/09: a closer não usa Claude, então o acompanhamento não podia
 * viver num link de fora. Mora aqui dentro, com o login dela — e Regina e Igor
 * veem o andamento na mesma tela, sem precisar pedir relatório.
 */
export type ResultadoLead = { ok?: true; erro?: string };

const SITUACOES = [
  "NAO_CONTATADO",
  "TENTOU_NAO_FALOU",
  "FALOU_COM_DECISOR",
  "DEMONSTRACAO_MARCADA",
  "CLIENTE",
  "RETORNAR_DEPOIS",
  "NAO_E_CLIENTE",
  "NAO_PERTURBAR",
] as const;
type Situacao = (typeof SITUACOES)[number];

/** Quem pode trabalhar a prospecção: a equipe do CP System, não os clientes. */
async function exigirAcessoInterno() {
  const usuario = await exigirUsuario();
  if (usuario.superAdmin) return usuario;
  if (usuario.email === "demonstracao@cpsystem.app.br") return usuario;

  // Colaborador da conta interna com o módulo de prospecção marcado.
  const interna = await prisma.conta.findFirst({
    where: { id: usuario.contaId, usuarios: { some: { superAdmin: true } } },
    select: { id: true },
  });
  const liberado =
    !!interna &&
    (!usuario.acessoRestrito || usuario.modulosPermitidos.includes("PROSPECCAO"));
  if (!liberado) throw new Error("Sem acesso à prospecção.");
  return usuario;
}

export async function atualizarLeadAction(
  _prev: ResultadoLead | null,
  formData: FormData,
): Promise<ResultadoLead> {
  const usuario = await exigirAcessoInterno();
  // Acompanhamento não escreve durante o modo de observação de cliente.
  await bloquearEspionagem();

  const id = String(formData.get("id") || "").trim();
  if (!id) return { erro: "Lead não informado." };

  const dados: Record<string, unknown> = {
    atualizadoPorId: usuario.id,
    atualizadoPorNome: usuario.nome,
  };

  // Cada campo só entra se veio no formulário: o seletor e as anotações são
  // salvos separadamente, e um não pode apagar o outro.
  const situacao = String(formData.get("situacao") || "").trim();
  if (situacao) {
    if (!SITUACOES.includes(situacao as Situacao)) return { erro: "Situação inválida." };
    dados.situacao = situacao;

    // As datas de contato se preenchem sozinhas. Pedir para a closer digitar
    // data no meio de uma ligação é pedir para o campo ficar vazio — e sem ele
    // não existe acompanhamento, que é justamente o que Regina e Igor querem
    // ver (Regina 08/09: "quem ela entrou em contato, o dia que ela entrou em
    // contato, se teve retorno").
    const houveContato = situacao !== "NAO_CONTATADO";
    if (houveContato) {
      const atual = await prisma.leadProspeccao.findUnique({
        where: { id },
        select: { dataPrimeiroContato: true },
      });
      dados.dataUltimoContato = new Date();
      if (!atual?.dataPrimeiroContato) dados.dataPrimeiroContato = new Date();
    }
  }
  if (formData.has("anotacoes")) {
    dados.anotacoes = String(formData.get("anotacoes") || "").slice(0, 4000);
  }
  if (formData.has("teveRetorno")) {
    dados.teveRetorno = formData.get("teveRetorno") === "1";
  }
  if (formData.has("contatoNome")) {
    dados.contatoNome = String(formData.get("contatoNome") || "").slice(0, 120) || null;
  }
  if (formData.has("retornarEm")) {
    const v = String(formData.get("retornarEm") || "").trim();
    const d = v ? new Date(`${v}T12:00:00`) : null;
    dados.retornarEm = d && !Number.isNaN(d.getTime()) ? d : null;
  }

  try {
    await prisma.leadProspeccao.update({ where: { id }, data: dados });
  } catch {
    return { erro: "Não consegui salvar. Tente de novo." };
  }

  revalidatePath("/prospeccao");
  return { ok: true };
}
