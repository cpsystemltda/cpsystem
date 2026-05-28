import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Building2,
  FileText,
  ClipboardList,
  Receipt,
  Wallet,
  Coins,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, formatarCnpj } from "@/lib/validators";

// Tela detalhada de uma empresa vinculada — acessada quando o analista
// clica num card de "Empresas vinculadas" no painel. Mostra:
//   - Dados cadastrais da empresa (razão social, CNPJ, contato, endereço)
//   - Termos do vínculo (% comissão, fixo mensal, data início, status)
//   - KPIs financeiros desta empresa específica
//   - Listas de Atas, Contratos e Empenhos (com link pra detalhe)
//   - Histórico de pagamentos recebidos (variáveis + fixos)
export default async function EmpresaDoAnalistaPage({
  params,
}: {
  params: Promise<{ vinculoId: string }>;
}) {
  const { vinculoId } = await params;
  const usuario = await exigirUsuario();

  // Resolve o analista: conta ANALISTA → analista próprio; super admin → todos
  const analista = await prisma.analista.findFirst({
    where:
      usuario.conta.tipo === "ANALISTA"
        ? { contaId: usuario.contaId }
        : usuario.superAdmin
          ? {}
          : { id: "__nunca__" },
  });
  if (!analista) notFound();

  // Carrega vínculo + tudo da conta dele
  const vinculo = await prisma.vinculoAnalista.findFirst({
    where: {
      id: vinculoId,
      ...(usuario.superAdmin ? {} : { analistaId: analista.id }),
    },
    include: {
      analista: { select: { nomeCompleto: true, email: true } },
      conta: {
        include: {
          empresas: true,
          usuarios: { select: { nome: true, email: true } },
        },
      },
      fixosPagos: {
        orderBy: { competencia: "desc" },
      },
      comissoesExecucao: {
        orderBy: { criadoEm: "desc" },
        include: {
          empenho: {
            select: {
              id: true,
              numero: true,
              orgaoNome: true,
              dataEmissao: true,
              status: true,
              instrumento: true,
            },
          },
        },
      },
    },
  });
  if (!vinculo) notFound();

  const empresaIds = vinculo.conta.empresas.map((e) => e.id);

  // Carrega Atas e Contratos da conta da empresa (todos os CNPJs)
  const [atas, contratos] = await Promise.all([
    prisma.ata.findMany({
      where: { empresaId: { in: empresaIds } },
      select: {
        id: true,
        numero: true,
        objeto: true,
        orgaoNome: true,
        vigenciaInicio: true,
        vigenciaFim: true,
        itens: { select: { valorTotal: true } },
      },
      orderBy: { vigenciaFim: "desc" },
    }),
    prisma.contrato.findMany({
      where: { empresaId: { in: empresaIds } },
      select: {
        id: true,
        numero: true,
        objeto: true,
        orgaoNome: true,
        vigenciaInicio: true,
        vigenciaFim: true,
        tipo: true,
        itens: { select: { valorTotal: true } },
      },
      orderBy: { vigenciaFim: "desc" },
    }),
  ]);

  const empresaPrincipal = vinculo.conta.empresas[0];
  const nomeEmpresa =
    empresaPrincipal?.nomeFantasia ||
    empresaPrincipal?.razaoSocial ||
    "Empresa sem nome";

  // Agregados financeiros
  const recebidoVariavel = vinculo.comissoesExecucao
    .filter((c) => c.status === "PAGO" || c.status === "PAGO_PARCIAL")
    .reduce((s, c) => s + c.valorRecebido, 0);
  const aReceberCliente = vinculo.comissoesExecucao
    .filter((c) => c.status === "A_RECEBER" || c.status === "ATRASADO")
    .reduce((s, c) => s + c.valorCalculado, 0);
  const aguardandoOrgao = vinculo.comissoesExecucao
    .filter((c) => c.status === "AGUARDANDO_ORGAO")
    .reduce((s, c) => s + c.valorBaseEmpenho * (vinculo.percentualComissao / 100), 0);
  const recebidoFixo = vinculo.fixosPagos
    .filter((p) => p.status === "PAGO" || p.status === "PAGO_PARCIAL")
    .reduce((s, p) => s + (p.valorRecebido || 0), 0);

  const hoje = new Date();
  const atasVigentes = atas.filter((a) => a.vigenciaFim >= hoje);
  const contratosVigentes = contratos.filter((c) => c.vigenciaFim >= hoje);
  const valorAtas = atasVigentes.reduce(
    (s, a) => s + a.itens.reduce((ss, i) => ss + i.valorTotal, 0),
    0,
  );
  const valorContratos = contratosVigentes.reduce(
    (s, c) => s + c.itens.reduce((ss, i) => ss + i.valorTotal, 0),
    0,
  );

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <Link
        href="/painel-analista"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      {/* Header com nome e status */}
      <div className="mt-4 flex items-start gap-4">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]"
          style={{
            background: "rgba(197,180,255,0.22)",
            color: "var(--lavender-deep, #6B5BB8)",
          }}
        >
          <Building2 className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="text-[28px] font-extrabold leading-none"
              style={{ color: "var(--text)", letterSpacing: "-0.04em" }}
            >
              {nomeEmpresa}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                vinculo.status === "ATIVO"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {vinculo.status}
            </span>
            <span className="text-xs text-slate-500">
              {vinculo.conta.empresas.length} CNPJ
              {vinculo.conta.empresas.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Vínculo desde {vinculo.dataInicio.toLocaleDateString("pt-BR")} ·
            Comissão variável <strong>{vinculo.percentualComissao}%</strong> ·
            Fixo mensal <strong>{brl(vinculo.fixoMensal)}</strong>
          </p>
        </div>
      </div>

      {/* KPIs financeiros desta empresa */}
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <KPI
          icon={Wallet}
          label="Recebido (variável)"
          value={brl(recebidoVariavel)}
          cor="emerald"
        />
        <KPI
          icon={Receipt}
          label="Recebido (fixo)"
          value={brl(recebidoFixo)}
          cor="emerald"
        />
        <KPI
          icon={Coins}
          label="A receber"
          value={brl(aReceberCliente)}
          cor="amber"
          sub={`+ ${brl(aguardandoOrgao)} aguardando órgão`}
        />
        <KPI
          icon={Building2}
          label="Carteira vigente"
          value={brl(valorAtas + valorContratos)}
          cor="violet"
          sub={`${atasVigentes.length} Atas + ${contratosVigentes.length} Contratos`}
        />
      </div>

      {/* Dados cadastrais + CNPJs */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2
          className="mb-4 text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          Dados cadastrais
        </h2>
        <div className="space-y-4">
          {vinculo.conta.empresas.map((e) => (
            <div key={e.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-base font-bold text-slate-900">
                  {e.nomeFantasia || e.razaoSocial}
                </h3>
                {e.nomeFantasia && e.razaoSocial && (
                  <span className="text-xs text-slate-500">
                    Razão social: {e.razaoSocial}
                  </span>
                )}
              </div>
              <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <strong>CNPJ</strong> {formatarCnpj(e.cnpj)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {e.email || "—"}
                </div>
                {e.telefones && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {e.telefones}
                  </div>
                )}
                <div className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>
                    {e.endereco}
                    {e.complemento ? ` — ${e.complemento}` : ""} · CEP {e.cep}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {vinculo.conta.usuarios.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Usuários da empresa
            </p>
            <ul className="mt-2 space-y-1">
              {vinculo.conta.usuarios.map((u, i) => (
                <li key={i} className="text-xs text-slate-700">
                  <strong>{u.nome}</strong> · {u.email}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Atas */}
      <section className="mt-6">
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-600">
          <FileText className="mr-1 inline-block h-3.5 w-3.5" />
          Atas de Registro de Preços ({atas.length})
        </h2>
        {atas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Nenhuma Ata cadastrada por esta empresa.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Número</th>
                  <th className="px-4 py-2 text-left">Órgão</th>
                  <th className="px-4 py-2 text-left">Vigência</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {atas.slice(0, 10).map((a) => {
                  const vigente = a.vigenciaFim >= hoje;
                  const valor = a.itens.reduce((s, i) => s + i.valorTotal, 0);
                  return (
                    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-semibold">
                        <Link href={`/atas/${a.id}`} className="text-violet-700 hover:underline">
                          {a.numero}
                        </Link>
                        {!vigente && (
                          <span className="ml-2 text-[10px] text-slate-400">(vencida)</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">{a.orgaoNome}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        <Calendar className="mr-1 inline-block h-3 w-3" />
                        {a.vigenciaInicio.toLocaleDateString("pt-BR")} →{" "}
                        {a.vigenciaFim.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{brl(valor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Contratos */}
      <section className="mt-6">
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-600">
          <ClipboardList className="mr-1 inline-block h-3.5 w-3.5" />
          Contratos administrativos ({contratos.length})
        </h2>
        {contratos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Nenhum contrato cadastrado por esta empresa.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Número</th>
                  <th className="px-4 py-2 text-left">Órgão</th>
                  <th className="px-4 py-2 text-left">Vigência</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {contratos.slice(0, 10).map((c) => {
                  const vigente = c.vigenciaFim >= hoje;
                  const valor = c.itens.reduce((s, i) => s + i.valorTotal, 0);
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-semibold">
                        <Link href={`/contratos/${c.id}`} className="text-violet-700 hover:underline">
                          {c.numero}
                        </Link>
                        {!vigente && (
                          <span className="ml-2 text-[10px] text-slate-400">(vencido)</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">{c.orgaoNome}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        <Calendar className="mr-1 inline-block h-3 w-3" />
                        {c.vigenciaInicio.toLocaleDateString("pt-BR")} →{" "}
                        {c.vigenciaFim.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{brl(valor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Histórico de execuções (Linha B) */}
      <section className="mt-6">
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-600">
          <Receipt className="mr-1 inline-block h-3.5 w-3.5" />
          Execuções desta empresa ({vinculo.comissoesExecucao.length})
        </h2>
        {vinculo.comissoesExecucao.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Nenhuma execução elegível pra comissão ainda.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Empenho</th>
                  <th className="px-4 py-2 text-left">Órgão</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-right">Comissão</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {vinculo.comissoesExecucao.slice(0, 15).map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-semibold">
                      <Link
                        href={`/execucao/${c.empenho.id}`}
                        className="text-violet-700 hover:underline"
                      >
                        {c.empenho.instrumento} {c.empenho.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{c.empenho.orgaoNome}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{brl(c.valorBaseEmpenho)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {brl(c.valorCalculado || c.valorBaseEmpenho * (c.percentual / 100))}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={`rounded px-2 py-0.5 font-medium ${
                          c.status === "PAGO"
                            ? "bg-emerald-100 text-emerald-700"
                            : c.status === "PAGO_PARCIAL"
                              ? "bg-amber-100 text-amber-700"
                              : c.status === "A_RECEBER" || c.status === "ATRASADO"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Histórico fixo mensal */}
      <section className="mt-6 mb-12">
        <h2 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-600">
          <Receipt className="mr-1 inline-block h-3.5 w-3.5" />
          Fixo mensal — histórico de pagamentos ({vinculo.fixosPagos.length})
        </h2>
        {vinculo.fixosPagos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Nenhum pagamento de fixo mensal registrado.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Competência</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-right">Recebido</th>
                  <th className="px-4 py-2 text-left">Vencimento</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {vinculo.fixosPagos.slice(0, 12).map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 font-semibold">{p.competencia}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{brl(p.valor)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {brl(p.valorRecebido || 0)}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {p.vencimento?.toLocaleDateString("pt-BR") ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={`rounded px-2 py-0.5 font-medium ${
                          p.status === "PAGO"
                            ? "bg-emerald-100 text-emerald-700"
                            : p.status === "PAGO_PARCIAL"
                              ? "bg-amber-100 text-amber-700"
                              : p.status === "ATRASADO"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  sub,
  cor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  cor: "emerald" | "amber" | "violet";
}) {
  const tone = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  }[cor];
  return (
    <div className={`rounded-2xl border ${tone.border} bg-white p-4`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone.bg}`}>
          <Icon className={`h-4 w-4 ${tone.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
          {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
