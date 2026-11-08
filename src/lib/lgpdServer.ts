import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { cifrar, decifrar, segredoConfigurado } from "@/lib/segredos";
import { registrarAuditoria } from "@/lib/auditoria";
import { VERSAO_ADENDO_LGPD } from "@/lib/lgpd";

/**
 * LGPD (ESP-007) — lado do servidor.
 *
 * CPF de colaborador (ESP-008) vai cifrado no banco (AES-256-GCM, mesma
 * chave dos segredos) e acompanhado de um hash com pimenta, que permite
 * procurar e impedir duplicidade sem decifrar. Sem SEGREDO_CHAVE o cadastro
 * de colaborador é recusado — não existe "guardar em texto puro por enquanto".
 */

export function lgpdPronta(): boolean {
  return segredoConfigurado();
}

export function cifrarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  return cifrar(d);
}

export function decifrarCpf(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    return decifrar(blob);
  } catch {
    return null;
  }
}

/** Hash determinístico (sha256 com pimenta derivada da chave) para busca e unicidade. */
export function hashCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  const pimenta = createHash("sha256").update(`cpf|${process.env.SEGREDO_CHAVE || ""}`).digest("hex");
  return createHash("sha256").update(`${pimenta}:${d}`).digest("hex");
}

/**
 * RN05: toda consulta a dado pessoal de colaborador fica registrada — quem,
 * quando, o quê. Consultável pelo Admin da empresa em /equipe/lgpd.
 */
export async function registrarAcessoDadosPessoais(opts: { contaId: string; usuarioId: string; recurso: "Colaborador" | "ColaboradorDocumento" | "ColaboradoresLista"; recursoId?: string; resumo: string }): Promise<void> {
  await registrarAuditoria({ contaId: opts.contaId, usuarioId: opts.usuarioId, acao: "ACESSO", recurso: opts.recurso, recursoId: opts.recursoId, resumo: opts.resumo }).catch(() => {});
}

/** RN08: a conta já aceitou a versão vigente do adendo? */
export function adendoAceito(conta: { adendoLgpdVersao: string | null }): boolean {
  return conta.adendoLgpdVersao === VERSAO_ADENDO_LGPD;
}

export async function ultimoAceiteAdendo(contaId: string) {
  return prisma.aceiteAdendoLgpd.findFirst({
    where: { contaId, versao: VERSAO_ADENDO_LGPD },
    orderBy: { aceitoEm: "desc" },
  });
}
