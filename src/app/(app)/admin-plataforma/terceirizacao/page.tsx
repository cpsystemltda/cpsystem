import Link from "next/link";
import { Crown } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { competenciaAtualBrt } from "@/lib/dreConstantes";
import { faixaDe, rotuloFaixa } from "@/lib/faixasTerceirizacao";
import { configFaixas } from "@/lib/faixasTerceirizacaoServer";
import { FormFaixas } from "./FormFaixas";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * ESP-011 — painel do gestor: faixas de colaboradores (RN02), nome do pacote
 * (RN09) e a apuração do mês por conta (RN03/RN08).
 */
export default async function AdminTerceirizacaoPage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">Esta área é exclusiva para gestores da plataforma.</p>
      </div>
    );
  }
  const competencia = competenciaAtualBrt();
  const [cfg, apuracoes] = await Promise.all([
    configFaixas(),
    prisma.apuracaoColaboradoresMes.findMany({
      where: { competencia: { gte: `${Number(competencia.slice(0, 4)) - 1}${competencia.slice(4)}` } },
      orderBy: [{ competencia: "desc" }, { pico: "desc" }],
      select: {
        id: true,
        competencia: true,
        pico: true,
        picoEm: true,
        ultimoValor: true,
        conta: { select: { plano: true, statusAssinatura: true, contaTeste: true, empresas: { select: { nomeFantasia: true, razaoSocial: true }, take: 1, orderBy: { criadoEm: "asc" } } } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <Link href="/admin-plataforma" className="text-sm text-slate-600 hover:underline">
        ← Visão geral
      </Link>
      <div className="mt-4 flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber-50">
          <Crown className="h-6 w-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Módulo Terceirização · faixas de colaboradores</h1>
          <p className="mt-1 text-sm text-slate-600">
            O módulo fica liberado no Premium e no período de teste. A faixa do mês é o maior número de colaboradores ativos com alocação aberta, contado uma vez por conta e
            apurado todo dia.
          </p>
          <p className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${cfg.cobrancaAtiva ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {cfg.cobrancaAtiva ? "● Clientes veem a faixa e recebem os avisos" : "○ Faixas visíveis só aqui: clientes não veem preço nem recebem aviso"}
          </p>
        </div>
      </div>

      <section className="mt-6">
        <FormFaixas faixas={cfg.faixas} nomePacote={cfg.nomePacote} cobrancaAtiva={cfg.cobrancaAtiva} />
      </section>

      <section className="mt-8">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] text-violet-800">Apuração por conta</h2>
        <div className="glass mt-3 overflow-hidden rounded-[20px]">
          <table className="table-glass">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Conta</th>
                <th>Plano</th>
                <th className="num">Hoje</th>
                <th className="num">Pico</th>
                <th>Faixa</th>
                <th className="num">Adicional</th>
              </tr>
            </thead>
            <tbody>
              {apuracoes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="center" style={{ padding: "28px", color: "var(--text-mute)" }}>
                    Nenhuma conta com colaboradores cadastrados ainda.
                  </td>
                </tr>
              ) : (
                apuracoes.map((a) => {
                  const f = faixaDe(a.pico, cfg.faixas);
                  const nome = a.conta.empresas[0]?.nomeFantasia || a.conta.empresas[0]?.razaoSocial || "—";
                  return (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap">{a.competencia.split("-").reverse().join("/")}</td>
                      <td>
                        {nome}
                        {a.conta.contaTeste && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">Conta de teste</span>}
                      </td>
                      <td className="text-xs">{a.conta.statusAssinatura === "TRIAL" ? "Teste" : a.conta.plano}</td>
                      <td className="num">{a.competencia === competencia ? a.ultimoValor : "—"}</td>
                      <td className="num">
                        {a.pico}
                        {a.picoEm && <span className="block text-[10px] text-slate-500">{a.picoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>}
                      </td>
                      <td className="text-xs">{rotuloFaixa(f)}</td>
                      <td className="num">{f.acimaDaUltima ? "a combinar" : f.valor > 0 ? brl(f.valor) : "incluído"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
