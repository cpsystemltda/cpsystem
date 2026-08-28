import "server-only";
import { prisma } from "@/lib/prisma";
import { decifrar } from "@/lib/segredos";
import { ProvedorFocusNfe } from "./focusnfe";
import { ProvedorFiscalDemo } from "./demo";
import type { ProvedorNfse } from "./types";

export * from "./types";

/**
 * Resolve o provedor fiscal DA EMPRESA — diferente do gateway de pagamento, que
 * é um só pra plataforma inteira.
 *
 * A razão é fiscal, não técnica: quem emite a nota é a empresa do cliente, com
 * o CNPJ e o certificado dela. Cada empresa tem a própria credencial, e nunca
 * pode acontecer de a credencial de uma emitir em nome da outra.
 */
export type ContextoFiscal = {
  provedor: ProvedorNfse;
  config: NonNullable<Awaited<ReturnType<typeof carregarConfig>>>;
};

async function carregarConfig(empresaId: string) {
  return prisma.configuracaoFiscal.findUnique({ where: { empresaId } });
}

export class ErroFiscalConfig extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroFiscalConfig";
  }
}

export async function getProvedorFiscal(empresaId: string): Promise<ContextoFiscal> {
  const config = await carregarConfig(empresaId);
  if (!config) {
    throw new ErroFiscalConfig(
      "Esta empresa ainda não tem os dados fiscais cadastrados. Preencha em Conta → Dados fiscais.",
    );
  }
  if (!config.habilitado) {
    throw new ErroFiscalConfig(
      "A emissão de nota está desligada para esta empresa. Ative em Conta → Dados fiscais.",
    );
  }

  if (config.provedor === "FOCUS_NFE") {
    if (!config.tokenCifrado) {
      throw new ErroFiscalConfig(
        "Falta o token da Focus NFe. Cadastre em Conta → Dados fiscais.",
      );
    }
    let token: string;
    try {
      token = decifrar(config.tokenCifrado);
    } catch {
      throw new ErroFiscalConfig(
        "Não foi possível ler o token fiscal guardado. Cadastre o token novamente em Conta → Dados fiscais.",
      );
    }
    return {
      provedor: new ProvedorFocusNfe({ token, ambiente: config.ambiente }),
      config,
    };
  }

  return { provedor: new ProvedorFiscalDemo(), config };
}
