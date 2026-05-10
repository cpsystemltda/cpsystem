import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, ClipboardList, Receipt, AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";
import { brl, formatarCnpj, ROTULO_PROCEDIMENTO, ROTULO_TIPO } from "@/lib/validators";
import { Tabs } from "@/components/Tabs";
import { NotificacoesTab } from "@/components/abas/NotificacoesTab";
import { ProcedimentosTab } from "@/components/abas/ProcedimentosTab";
import { AnexosTab, AnotacoesTab } from "@/components/abas/AnexosTab";
import { OrgaosTab, EnderecosPontosFocaisTab } from "@/components/abas/OrgaosTab";
import { LerMais } from "@/components/LerMais";

export default async function AtaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  const ata = await prisma.ata.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: {
      empresa: true,
      contratos: { orderBy: { criadoEm: "desc" } },
      empenhos: { orderBy: { criadoEm: "desc" }, where: { contratoId: null } },
      orgaos: { orderBy: { tipo: "asc" } },
      enderecosEntrega: true,
      pontosFocais: true,
      notificacoes: { include: { andamentos: { orderBy: { dataEvento: "asc" } } }, orderBy: { criadoEm: "desc" } },
      procedimentos: {
        include: {
          andamentos: { orderBy: { dataEvento: "asc" } },
          penalidades: { orderBy: { dataAplicacao: "asc" } },
        },
        orderBy: { criadoEm: "desc" },
      },
      anexos: { orderBy: { criadoEm: "desc" } },
      anotacoes: { orderBy: { criadoEm: "desc" } },
    },
  });

  if (!ata) notFound();

  const saldo = await calcularSaldoAta(ata.id);

  const venceEmDias = Math.ceil((ata.vigenciaFim.getTime() - Date.now()) / 86400000);
  const reajusteEmDias = ata.marcoOrcamentoEstimado
    ? Math.ceil((new Date(ata.marcoOrcamentoEstimado.getTime() + 365 * 86400000).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <Link href="/atas" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Voltar para Atas
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]"
          style={{ background: "rgba(212,175,55,0.18)", color: "var(--primary-deep)" }}
        >
          <FileText className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[32px] font-extrabold leading-none" style={{ color: "var(--text)", letterSpacing: "-0.04em" }}>
            Ata {ata.numero}
          </h1>
          <p className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
            {ata.empresa.nomeFantasia || ata.empresa.razaoSocial} · {ata.orgaoNome}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/contratacoes/nova/contrato" className="btn-secondary" style={{ height: "36px", padding: "0 14px", fontSize: "12px" }}>
            + Contrato
          </Link>
          <Link href="/contratacoes/nova/empenho" className="btn-secondary" style={{ height: "36px", padding: "0 14px", fontSize: "12px" }}>
            + Empenho
          </Link>
        </div>
      </div>

      {/* Objeto — largura cheia, quebra natural, sem corte */}
      <section className="glass mt-4 rounded-[20px] px-6 py-5">
        <h2
          className="text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          Objeto
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{
            color: "var(--text-soft)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {ata.objeto}
        </p>
      </section>

      {(venceEmDias < 60 || (reajusteEmDias !== null && reajusteEmDias < 60)) && (
        <div className="mt-6 space-y-2">
          {venceEmDias < 60 && (
            <Alerta cor={venceEmDias < 0 ? "red" : "amber"}>
              {venceEmDias < 0
                ? `Esta Ata venceu há ${-venceEmDias} dias.`
                : `Vigência expira em ${venceEmDias} dias (${ata.vigenciaFim.toLocaleDateString("pt-BR")}).`}
            </Alerta>
          )}
          {reajusteEmDias !== null && reajusteEmDias < 60 && reajusteEmDias > 0 && (
            <Alerta cor="amber">
              Janela de reajuste de preços abre em {reajusteEmDias} dias (1 ano após o orçamento de {ata.marcoOrcamentoEstimado!.toLocaleDateString("pt-BR")}).
            </Alerta>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat titulo="Valor total" valor={brl(saldo.valorTotal)} />
        <Stat titulo="Valor utilizado" valor={brl(saldo.valorUsado)} sub={`${saldo.percentualUsado.toFixed(1)}%`} />
        <Stat titulo="Valor disponível" valor={brl(saldo.valorDisponivel)} cor="emerald" />
      </div>

      <div className="mt-8">
        <Tabs
          abas={[
            {
              key: "saldo",
              label: "Saldo de itens",
              content: <TabelaSaldoItens saldo={saldo} />,
            },
            {
              key: "orgaos",
              label: "Órgãos",
              badge: ata.orgaos.length,
              content: (
                <OrgaosTab
                  ataId={ata.id}
                  orgaos={ata.orgaos}
                  valorTotalAta={saldo.valorTotal}
                  aceitaCarona={ata.aceitaCarona}
                />
              ),
            },
            {
              key: "enderecos",
              label: "Endereços / Pontos focais",
              badge: ata.enderecosEntrega.length + ata.pontosFocais.length,
              content: (
                <EnderecosPontosFocaisTab
                  enderecos={ata.enderecosEntrega}
                  pontosFocais={ata.pontosFocais}
                  ataId={ata.id}
                />
              ),
            },
            {
              key: "derivados",
              label: "Derivados",
              badge: ata.contratos.length + ata.empenhos.length,
              content: <DerivadosLista contratos={ata.contratos} empenhos={ata.empenhos} />,
            },
            {
              key: "notificacoes",
              label: "Notificações",
              badge: ata.notificacoes.length,
              content: <NotificacoesTab notificacoes={ata.notificacoes} ataId={ata.id} />,
            },
            {
              key: "procedimentos",
              label: "Procedimentos apuratórios",
              badge: ata.procedimentos.length,
              content: <ProcedimentosTab procedimentos={ata.procedimentos} ataId={ata.id} />,
            },
            {
              key: "anexos",
              label: "Anexos",
              badge: ata.anexos.length,
              content: <AnexosTab anexos={ata.anexos} ataId={ata.id} />,
            },
            {
              key: "anotacoes",
              label: "Anotações",
              badge: ata.anotacoes.length,
              content: <AnotacoesTab anotacoes={ata.anotacoes} ataId={ata.id} />,
            },
            {
              key: "dados",
              label: "Dados",
              content: <DadosAta ata={ata} />,
            },
          ]}
        />
      </div>
    </div>
  );
}

function TabelaSaldoItens({
  saldo,
}: {
  saldo: {
    itens: {
      ataItemId: string;
      descricao: string;
      unidade: string;
      lote: string | null;
      numero: string | null;
      quantidadeTotal: number;
      quantidadeUsada: number;
      quantidadeDisponivel: number;
      valorUnitario: number;
      valorDisponivel: number;
    }[];
  };
}) {
  // Agrupa itens por lote — ordem de aparição preservada (Lote 1, 2, 3...
  // conforme primeira ocorrência); itens sem lote vão para "Itens isolados".
  const grupos = new Map<string, typeof saldo.itens>();
  const ITENS_ISOLADOS = "__isolados__";
  for (const it of saldo.itens) {
    const chave = it.lote && it.lote.trim() ? it.lote.trim() : ITENS_ISOLADOS;
    const arr = grupos.get(chave) ?? [];
    arr.push(it);
    grupos.set(chave, arr);
  }
  // Renderiza lotes na ordem natural numérica quando possível, senão alfabética;
  // "Itens isolados" sempre por último.
  const chavesOrdenadas = Array.from(grupos.keys())
    .filter((k) => k !== ITENS_ISOLADOS)
    .sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, "pt-BR", { numeric: true });
    });
  if (grupos.has(ITENS_ISOLADOS)) chavesOrdenadas.push(ITENS_ISOLADOS);

  return (
    <div className="space-y-5">
      {chavesOrdenadas.map((chave) => {
        const itens = grupos.get(chave) ?? [];
        const tituloGrupo = chave === ITENS_ISOLADOS ? "Itens isolados" : `Lote ${chave}`;
        const subtotalQtd = itens.reduce((s, it) => s + it.quantidadeTotal, 0);
        const subtotalDisp = itens.reduce((s, it) => s + it.valorDisponivel, 0);
        return (
          <section key={chave} className="glass overflow-hidden rounded-[20px]">
            <header
              className="flex items-center justify-between gap-3 px-6 py-3"
              style={{ borderBottom: "0.5px solid var(--hairline)" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-extrabold"
                  style={{
                    background:
                      chave === ITENS_ISOLADOS
                        ? "rgba(15,14,12,0.06)"
                        : "rgba(212,175,55,0.18)",
                    border:
                      chave === ITENS_ISOLADOS
                        ? "0.5px solid var(--hairline)"
                        : "0.5px solid rgba(168,137,71,0.5)",
                    color:
                      chave === ITENS_ISOLADOS ? "var(--text-mute)" : "var(--primary-deep)",
                  }}
                >
                  {chave === ITENS_ISOLADOS ? "—" : chave}
                </span>
                <h3
                  className="text-[14px] font-extrabold"
                  style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
                >
                  {tituloGrupo}
                </h3>
                <span className="text-xs" style={{ color: "var(--text-soft)" }}>
                  {itens.length} item{itens.length !== 1 ? "ns" : ""} · {subtotalQtd} unidade{subtotalQtd !== 1 ? "s" : ""} · {brl(subtotalDisp)} disponível
                </span>
              </div>
            </header>
            <table className="table-glass" style={{ minWidth: "1160px", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "64px" }} />{/* Item */}
                <col style={{ width: "auto", minWidth: "320px" }} />
                <col style={{ width: "64px" }} />
                <col style={{ width: "104px" }} />
                <col style={{ width: "104px" }} />
                <col style={{ width: "112px" }} />
                <col style={{ width: "108px" }} />
                <col style={{ width: "128px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="center">Item</th>
                  <th>Descrição</th>
                  <th>Un.</th>
                  <th className="num">Qtd. registrada</th>
                  <th className="num">Qtd. usada</th>
                  <th className="num">Qtd. disponível</th>
                  <th className="num">Valor unit.</th>
                  <th className="num">Valor disponível</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => (
                  <tr key={it.ataItemId}>
                    <td className="center" style={{ verticalAlign: "top" }}>
                      <span
                        className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold tabular"
                        style={{
                          background: it.numero ? "rgba(15,14,12,0.06)" : "transparent",
                          color: it.numero ? "var(--text)" : "var(--text-mute)",
                          border: it.numero ? "0.5px solid var(--hairline)" : "none",
                        }}
                      >
                        {it.numero ?? "—"}
                      </span>
                    </td>
                    <td
                      className="strong"
                      title={it.descricao}
                      style={{ whiteSpace: "normal", wordBreak: "break-word", verticalAlign: "top" }}
                    >
                      <LerMais texto={it.descricao} limite={140} />
                    </td>
                    <td>{it.unidade}</td>
                    <td className="num">{it.quantidadeTotal}</td>
                    <td className="num">{it.quantidadeUsada}</td>
                    <td className="num">
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            it.quantidadeDisponivel === 0
                              ? "var(--coral-deep)"
                              : "var(--mint-deep)",
                        }}
                      >
                        {it.quantidadeDisponivel}
                      </span>
                    </td>
                    <td className="num">{brl(it.valorUnitario)}</td>
                    <td className="num strong">{brl(it.valorDisponivel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function DerivadosLista({
  contratos,
  empenhos,
}: {
  contratos: { id: string; numero: string; objeto: string }[];
  empenhos: { id: string; numero: string; status: string }[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Contratos derivados ({contratos.length})</h3>
        {contratos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">Nenhum contrato.</p>
        ) : (
          <ul className="space-y-2">
            {contratos.map((c) => (
              <li key={c.id}>
                <Link href={`/contratos/${c.id}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-300">
                  <ClipboardList className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium">Contrato {c.numero}</div>
                    <div className="text-xs text-slate-500">{c.objeto.slice(0, 60)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Empenhos diretos ({empenhos.length})</h3>
        {empenhos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">Nenhum empenho direto.</p>
        ) : (
          <ul className="space-y-2">
            {empenhos.map((e) => (
              <li key={e.id}>
                <Link href={`/execucao/${e.id}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-300">
                  <Receipt className="h-4 w-4 text-amber-600" />
                  <div>
                    <div className="text-sm font-medium">Empenho {e.numero}</div>
                    <div className="text-xs text-slate-500">Status: {e.status}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DadosAta({
  ata,
}: {
  ata: {
    tipo: string; procedimentoSelecao: string; processoAdministrativo: string;
    numeroLicitacao: string | null; orgaoNome: string; orgaoCnpj: string;
    idAtaPncp: string | null; dataAssinatura: Date; dataPublicacao: Date | null;
    vigenciaInicio: Date; vigenciaFim: Date; aceitaCarona: boolean;
    prazoEntregaDias: number | null; prazoPagamentoDias: number | null;
  };
}) {
  return (
    <div className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
      <Info label="Tipo" valor={ROTULO_TIPO[ata.tipo as keyof typeof ROTULO_TIPO]} />
      <Info label="Procedimento" valor={ROTULO_PROCEDIMENTO[ata.procedimentoSelecao as keyof typeof ROTULO_PROCEDIMENTO]} />
      <Info label="Processo administrativo" valor={ata.processoAdministrativo} />
      <Info label="Nº Licitação" valor={ata.numeroLicitacao || "—"} />
      <Info label="Órgão gerenciador" valor={`${ata.orgaoNome} (${formatarCnpj(ata.orgaoCnpj)})`} />
      <Info label="ID PNCP" valor={ata.idAtaPncp || "—"} />
      <Info label="Data de assinatura" valor={ata.dataAssinatura.toLocaleDateString("pt-BR")} />
      <Info label="Data de publicação" valor={ata.dataPublicacao?.toLocaleDateString("pt-BR") || "—"} />
      <Info label="Vigência" valor={`${ata.vigenciaInicio.toLocaleDateString("pt-BR")} → ${ata.vigenciaFim.toLocaleDateString("pt-BR")}`} />
      <Info label="Aceita carona" valor={ata.aceitaCarona ? "Sim" : "Não"} />
      <Info label="Prazo de entrega" valor={ata.prazoEntregaDias ? `${ata.prazoEntregaDias} dias` : "—"} />
      <Info label="Prazo de pagamento" valor={ata.prazoPagamentoDias ? `${ata.prazoPagamentoDias} dias` : "—"} />
    </div>
  );
}

function Stat({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub?: string; cor?: "emerald" }) {
  const corCls = cor === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold ${corCls}`}>{valor}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{valor}</dd>
    </div>
  );
}

function Alerta({ cor, children }: { cor: "amber" | "red"; children: React.ReactNode }) {
  const cls =
    cor === "red"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${cls}`}>
      <AlertTriangle className="h-4 w-4" />
      {children}
    </div>
  );
}
