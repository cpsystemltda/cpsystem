"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { cifrar, segredoConfigurado } from "@/lib/segredos";

/**
 * Dados fiscais da empresa — o que a prefeitura exige pra emitir NFS-e.
 *
 * Fica no nível da EMPRESA (CNPJ), não da conta: quem emite a nota é a empresa,
 * e conta com vários CNPJs precisa de um cadastro fiscal por CNPJ.
 *
 * O token da casa fiscal é guardado cifrado (lib/segredos) e nunca volta pra
 * tela: a tela mostra só os quatro últimos dígitos, o suficiente pra conferir
 * "é este" sem exibir a credencial de novo.
 */
export type ResultadoConfigFiscal = {
  ok?: true;
  mensagem?: string;
  erro?: string;
  campos?: Record<string, string>;
};

function limpar(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function salvarConfigFiscalAction(
  _prev: ResultadoConfigFiscal | null,
  formData: FormData,
): Promise<ResultadoConfigFiscal> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") {
    return { erro: "Só quem administra a conta pode mexer nos dados fiscais." };
  }

  const empresaId = limpar(formData.get("empresaId"));
  const empresa = await prisma.empresa.findFirst({
    where: { id: empresaId, contaId: usuario.contaId },
    select: { id: true, cnpj: true, razaoSocial: true },
  });
  if (!empresa) return { erro: "Empresa não encontrada." };

  const provedor = limpar(formData.get("provedor")) === "FOCUS_NFE" ? "FOCUS_NFE" : "DEMO";
  const ambiente = limpar(formData.get("ambiente")) === "PRODUCAO" ? "PRODUCAO" : "HOMOLOGACAO";
  const habilitado = limpar(formData.get("habilitado")) === "on";
  const tokenNovo = limpar(formData.get("token"));

  const aliquotaBruta = limpar(formData.get("aliquotaIss")).replace(",", ".");
  const aliquotaIss = aliquotaBruta ? Number(aliquotaBruta) : null;
  if (aliquotaIss !== null && (Number.isNaN(aliquotaIss) || aliquotaIss < 0 || aliquotaIss > 100)) {
    return { erro: "Alíquota de ISS inválida.", campos: { aliquotaIss: "Use um número entre 0 e 100" } };
  }

  // Emitir de verdade sem token é impossível; avisar aqui evita o usuário
  // descobrir isso só na hora de emitir, com o cliente esperando a nota.
  if (habilitado && provedor === "FOCUS_NFE") {
    const jaTem = await prisma.configuracaoFiscal.findUnique({
      where: { empresaId },
      select: { tokenCifrado: true },
    });
    if (!tokenNovo && !jaTem?.tokenCifrado) {
      return {
        erro: "Pra ligar a emissão pela Focus NFe é preciso informar o token.",
        campos: { token: "Informe o token da Focus NFe" },
      };
    }
  }

  if (tokenNovo && !segredoConfigurado()) {
    return {
      erro:
        "O sistema está sem a chave de criptografia (SEGREDO_CHAVE) e se recusa a " +
        "guardar o token fiscal sem cifrar. Fale com o suporte do CP System.",
    };
  }

  // Código IBGE do município do prestador: preenchido sozinho a partir do CNPJ
  // da empresa. É o campo que mais gera erro quando digitado à mão.
  let codigoMunicipio = limpar(formData.get("codigoMunicipio")) || null;
  if (!codigoMunicipio) {
    try {
      const { consultarCodigoMunicipioPorCnpj } = await import("@/lib/receitaCnpj");
      codigoMunicipio = await consultarCodigoMunicipioPorCnpj(empresa.cnpj);
    } catch (e) {
      console.error("[config-fiscal] não consegui descobrir o município:", e);
    }
  }

  const dados = {
    provedor: provedor as "FOCUS_NFE" | "DEMO",
    ambiente: ambiente as "HOMOLOGACAO" | "PRODUCAO",
    habilitado,
    inscricaoMunicipal: limpar(formData.get("inscricaoMunicipal")) || null,
    inscricaoEstadual: limpar(formData.get("inscricaoEstadual")) || null,
    codigoMunicipio,
    regime: (limpar(formData.get("regime")) || "SIMPLES_NACIONAL") as
      | "SIMPLES_NACIONAL"
      | "LUCRO_PRESUMIDO"
      | "LUCRO_REAL"
      | "MEI",
    optanteSimples: limpar(formData.get("optanteSimples")) === "on",
    incentivadorCultural: limpar(formData.get("incentivadorCultural")) === "on",
    itemListaServico: limpar(formData.get("itemListaServico")) || null,
    codigoTributarioMunicipio: limpar(formData.get("codigoTributarioMunicipio")) || null,
    cnaeServico: limpar(formData.get("cnaeServico")) || null,
    aliquotaIss,
    issRetidoPadrao: limpar(formData.get("issRetidoPadrao")) === "on",
    descricaoPadrao: limpar(formData.get("descricaoPadrao")) || null,
    ...(tokenNovo ? { tokenCifrado: cifrar(tokenNovo) } : {}),
  };

  await prisma.configuracaoFiscal.upsert({
    where: { empresaId },
    create: { empresaId, ...dados },
    update: dados,
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Empresa",
    recursoId: empresa.id,
    resumo:
      `Atualizou os dados fiscais de ${empresa.razaoSocial} ` +
      `(${provedor}, ${ambiente}, emissão ${habilitado ? "ligada" : "desligada"})` +
      (tokenNovo ? " e cadastrou um token novo" : ""),
  });

  revalidatePath("/conta/fiscal");
  return {
    ok: true,
    mensagem: habilitado
      ? `Dados fiscais salvos. A emissão de nota está ligada${ambiente === "HOMOLOGACAO" ? " em homologação (nota de teste, sem valor fiscal)" : ""}.`
      : "Dados fiscais salvos. A emissão continua desligada.",
  };
}
