import Link from "next/link";
import { AlertTriangle, FileText, ShieldCheck } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { segredoConfigurado } from "@/lib/segredos";
import { prisma } from "@/lib/prisma";
import { ConfigFiscalForm } from "./ConfigFiscalForm";

/**
 * Dados fiscais por empresa — o que a prefeitura exige pra emitir NFS-e.
 *
 * Fica por EMPRESA e não por conta porque quem emite a nota é o CNPJ: conta com
 * três CNPJs precisa de três cadastros, cada um com a própria credencial.
 */
export default async function FiscalPage() {
  const usuario = await exigirUsuario();

  const empresas = await prisma.empresa.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      configuracaoFiscal: true,
      _count: { select: { notasFiscais: true } },
    },
  });

  const podeEditar = usuario.perfil === "ADMIN";
  // O token da casa fiscal é guardado cifrado. Sem a chave de criptografia o
  // sistema se RECUSA a salvá-lo — melhor descobrir isso aqui do que na hora de
  // cadastrar, com o contador do cliente esperando do outro lado.
  const chaveDeCifraOk = segredoConfigurado();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
        Conta · Dados fiscais
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
        Emissão de nota fiscal
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Preencha os dados que a prefeitura exige e o CP System passa a emitir a NFS-e
        direto do empenho — com os itens e o órgão que já estão cadastrados.
      </p>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div className="text-xs leading-relaxed text-emerald-900">
          <strong>Seu certificado digital não fica com a gente.</strong> Ele fica hospedado
          na casa fiscal, e o CP System guarda apenas um token de acesso — cifrado, e que
          você pode revogar a qualquer momento. Token vazado se revoga; certificado A1
          vazado assina em nome da sua empresa.
        </div>
      </div>

      {!chaveDeCifraOk && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
          <div className="text-xs leading-relaxed text-red-900">
            <strong>A chave de criptografia do sistema não está configurada.</strong> Sem ela, o
            CP System se recusa a guardar o token da casa fiscal — de propósito, porque guardar
            credencial sem cifra é pior que não guardar. Todo o resto desta tela funciona; só o
            cadastro do token fica bloqueado. Avise o suporte do CP System.
          </div>
        </div>
      )}

      {empresas.length === 0 && (
        <p className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Cadastre uma empresa antes de configurar a emissão de nota.
        </p>
      )}

      {!podeEditar && empresas.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p className="text-xs text-amber-900">
            Só quem administra a conta pode alterar dados fiscais. Você consegue ver o
            cadastro, mas não salvar.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {empresas.map((e) => (
          <section key={e.id} className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {e.nomeFantasia || e.razaoSocial}
                </h2>
                <p className="text-xs text-slate-500">
                  CNPJ {e.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                  {e._count.notasFiscais > 0 && ` · ${e._count.notasFiscais} nota(s) emitida(s)`}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                  e.configuracaoFiscal?.habilitado
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <FileText className="h-3 w-3" />
                {e.configuracaoFiscal?.habilitado ? "Emissão ligada" : "Emissão desligada"}
              </span>
            </div>

            <ConfigFiscalForm
              empresaId={e.id}
              podeEditar={podeEditar}
              config={
                e.configuracaoFiscal
                  ? {
                      provedor: e.configuracaoFiscal.provedor,
                      ambiente: e.configuracaoFiscal.ambiente,
                      habilitado: e.configuracaoFiscal.habilitado,
                      temToken: !!e.configuracaoFiscal.tokenCifrado,
                      inscricaoMunicipal: e.configuracaoFiscal.inscricaoMunicipal,
                      inscricaoEstadual: e.configuracaoFiscal.inscricaoEstadual,
                      codigoMunicipio: e.configuracaoFiscal.codigoMunicipio,
                      regime: e.configuracaoFiscal.regime,
                      optanteSimples: e.configuracaoFiscal.optanteSimples,
                      incentivadorCultural: e.configuracaoFiscal.incentivadorCultural,
                      itemListaServico: e.configuracaoFiscal.itemListaServico,
                      codigoTributarioMunicipio: e.configuracaoFiscal.codigoTributarioMunicipio,
                      cnaeServico: e.configuracaoFiscal.cnaeServico,
                      aliquotaIss: e.configuracaoFiscal.aliquotaIss,
                      issRetidoPadrao: e.configuracaoFiscal.issRetidoPadrao,
                      descricaoPadrao: e.configuracaoFiscal.descricaoPadrao,
                    }
                  : null
              }
            />
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Dúvida sobre item da lista de serviço ou alíquota? Quem sabe isso é a contabilidade
        da sua empresa — são os mesmos dados que ela usa pra emitir a nota hoje.{" "}
        <Link href="/suporte" className="font-semibold text-violet-700 hover:underline">
          Fale com a gente
        </Link>{" "}
        se precisar de ajuda.
      </p>
    </div>
  );
}
