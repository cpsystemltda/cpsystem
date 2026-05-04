import Link from "next/link";
import { UserCheck, Briefcase } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { NovoVinculoForm, EditarFixoForm, EncerrarVinculoButton, MarcarFixoPagoForm } from "./VinculoForms";

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default async function VinculosPage() {
  const usuario = await exigirUsuario();

  if (usuario.conta.tipo !== "EMPRESA") {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <UserCheck className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta tela é exclusiva para contas do tipo Empresa Fornecedora.
        </p>
        {usuario.conta.tipo === "ANALISTA" && (
          <Link href="/painel-analista" className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm text-white">
            Ir para o Painel do Analista
          </Link>
        )}
      </div>
    );
  }

  const vinculos = await prisma.vinculoAnalista.findMany({
    where: { contaId: usuario.contaId },
    include: {
      analista: true,
      fixosPagos: { orderBy: { competencia: "desc" }, take: 6 },
    },
    orderBy: [{ status: "asc" }, { criadoEm: "desc" }],
  });

  // Lista de analistas disponíveis pra criar novo vínculo
  const analistas = await prisma.analista.findMany({
    where: { ativo: true },
    orderBy: { nomeCompleto: "asc" },
    select: { id: true, nomeCompleto: true, cpf: true },
  });

  const competenciaAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50">
          <UserCheck className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analistas vinculados</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gerencie os analistas de licitação que atendem sua empresa, com comissão e fixo mensal.
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Vincular novo analista</h2>
        <p className="mt-1 text-xs text-slate-500">
          A regra de comissão considera execuções a partir da <strong>data de início</strong>. Execuções anteriores ficam de
          fora. Defina o percentual inicial — o analista pode ajustá-lo no painel dele depois.
        </p>
        <div className="mt-4">
          <NovoVinculoForm analistas={analistas.map((a) => ({ value: a.id, label: `${a.nomeCompleto} (${formatarCpf(a.cpf)})` }))} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Vínculos ({vinculos.length})
        </h2>
        {vinculos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-4 text-sm text-slate-600">Nenhum analista vinculado ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vinculos.map((v) => {
              const fixoMesAtual = v.fixosPagos.find((f) => f.competencia === competenciaAtual);
              return (
                <div
                  key={v.id}
                  className={`rounded-xl border bg-white p-5 ${v.status === "ATIVO" ? "border-slate-200" : "border-slate-200 opacity-70"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{v.analista.nomeCompleto}</h3>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                            v.status === "ATIVO" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                      <div className="mt-1 grid gap-x-4 text-xs text-slate-600 md:grid-cols-2">
                        <span>CPF: {formatarCpf(v.analista.cpf)}</span>
                        <span>Contato: {v.analista.email} · {v.analista.telefone}</span>
                        <span>Vínculo desde: {v.dataInicio.toLocaleDateString("pt-BR")}</span>
                        {v.encerradoEm && <span>Encerrado em: {v.encerradoEm.toLocaleDateString("pt-BR")}</span>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Comissão</p>
                          <p className="font-bold">{v.percentualComissao}%</p>
                          <p className="text-[10px] text-slate-500">(o analista pode ajustar)</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Fixo mensal</p>
                          <p className="font-bold">{brl(v.fixoMensal)}</p>
                          <p className="text-[10px] text-slate-500">vence dia {v.diaVencimentoFixo}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Fixo {competenciaAtual}</p>
                          {v.fixoMensal === 0 ? (
                            <p className="text-xs text-slate-400">—</p>
                          ) : fixoMesAtual?.paga ? (
                            <p className="text-xs text-emerald-700 font-medium">Pago em {fixoMesAtual.pagaEm?.toLocaleDateString("pt-BR")}</p>
                          ) : v.status === "ATIVO" ? (
                            <MarcarFixoPagoForm vinculoId={v.id} competenciaAtual={competenciaAtual} />
                          ) : (
                            <p className="text-xs text-slate-400">vínculo encerrado</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {v.status === "ATIVO" && (
                      <div className="flex flex-col items-end gap-2">
                        <EditarFixoForm vinculoId={v.id} fixoAtual={v.fixoMensal} diaAtual={v.diaVencimentoFixo} />
                        <EncerrarVinculoButton vinculoId={v.id} nomeAnalista={v.analista.nomeCompleto} />
                      </div>
                    )}
                  </div>

                  {v.fixosPagos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-2 text-[10px]">
                      <span className="text-slate-500">Histórico de fixo:</span>
                      {v.fixosPagos.map((f) => (
                        <span
                          key={f.id}
                          className={`rounded px-1.5 py-0.5 font-mono ${
                            f.paga ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {f.competencia} {f.paga ? "✓" : "○"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
