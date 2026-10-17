import { redirect } from "next/navigation";
import { Receipt, CircleAlert, Building2, CalendarDays } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FiltroLista } from "@/components/FiltroLista";
import { ListaNotasFiscais, type NotaFiscalLinha } from "@/components/ListaNotasFiscais";

/**
 * Todas as notas fiscais emitidas pelo CP System.
 *
 * Regina, 15/10/2026: *"a gente como administrador e superadministrador, eu e
 * o Igor, também temos que ter acesso a todas as notas fiscais emitidas
 * dentro do sistema."*
 *
 * Igor, 17/10, com o recorte: *"deve ter um campo no login de administrador
 * de notas fiscais emitidas. Lá dentro separadas por ano e mês. Além disso,
 * devem aparecer também por empresa — todas as notas emitidas para cada
 * empresa."*
 *
 * São duas perguntas diferentes e por isso duas visões, não uma tabela só:
 *
 * · **Por período** responde "quanto faturamos e quantas notas saíram em
 *   setembro?" — é a visão da contabilidade, e por isso traz subtotal por mês.
 * · **Por empresa** responde "o cliente pediu a nota de julho, cadê?" — é a
 *   visão do atendimento, e por isso agrupa tudo de um CNPJ junto.
 *
 * A tela mostra também o que **não** saiu: pagamento recebido sem nota é
 * pendência fiscal, e é justamente o que some quando a lista só traz o que
 * deu certo.
 */
export const dynamic = "force-dynamic";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default async function NotasFiscaisPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string; empresa?: string; visao?: string }>;
}) {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) redirect("/dashboard");

  const sp = await searchParams;
  const anoFiltro = sp.ano || "";
  const mesFiltro = sp.mes || "";
  const empresaFiltro = sp.empresa || "";
  const porEmpresa = sp.visao === "empresa";

  const cobrancas = await prisma.cobranca.findMany({
    where: { status: "PAGA" },
    orderBy: [{ pagaEm: "desc" }],
    select: {
      id: true, competencia: true, valor: true, pagaEm: true,
      nfseNumero: true, nfseStatus: true, nfsePdfUrl: true,
      conta: {
        select: {
          empresas: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true }, take: 1 },
          analista: { select: { nomeCompleto: true } },
        },
      },
    },
  });

  type Linha = NotaFiscalLinha & { ano: string; mes: string; chaveEmpresa: string };

  const todas: Linha[] = cobrancas.map((c) => {
    // A competência é o mês de referência da mensalidade, e é por ela que a
    // contabilidade procura — não pela data em que o dinheiro caiu.
    const [ano, mes] = (c.competencia || "").split("-");
    const emp = c.conta.empresas[0];
    return {
      id: c.id,
      competencia: c.competencia,
      valor: c.valor,
      pagaEm: c.pagaEm,
      nfseNumero: c.nfseNumero,
      nfseStatus: c.nfseStatus,
      nfsePdfUrl: c.nfsePdfUrl,
      cliente: emp?.nomeFantasia || emp?.razaoSocial || c.conta.analista?.nomeCompleto || "—",
      ano: ano || "—",
      mes: mes || "—",
      chaveEmpresa: emp?.cnpj || c.conta.analista?.nomeCompleto || "sem-empresa",
    };
  });

  const anos = [...new Set(todas.map((l) => l.ano))].filter((a) => a !== "—").sort().reverse();
  const empresas = [...new Map(todas.map((l) => [l.chaveEmpresa, l.cliente ?? "—"])).entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "pt-BR"));

  const linhas = todas.filter(
    (l) =>
      (!anoFiltro || l.ano === anoFiltro) &&
      (!mesFiltro || l.mes === mesFiltro) &&
      (!empresaFiltro || l.chaveEmpresa === empresaFiltro),
  );

  const emitidas = linhas.filter((l) => l.nfsePdfUrl || l.nfseStatus === "AUTHORIZED");
  const comFalha = linhas.filter((l) => l.nfseStatus === "ERROR");
  const ontem = new Date(Date.now() - 24 * 3600_000);
  const semNota = linhas.filter((l) => !l.nfseStatus && l.pagaEm && l.pagaEm < ontem);
  const emEmissao = linhas.length - emitidas.length - comFalha.length - semNota.length;
  const faturado = linhas.reduce((s, l) => s + l.valor, 0);

  // Agrupamento: por ano/mês ou por empresa, conforme a pergunta que se faz.
  const grupos = new Map<string, { titulo: string; subtitulo: string; linhas: Linha[] }>();
  for (const l of linhas) {
    const chave = porEmpresa ? l.chaveEmpresa : `${l.ano}-${l.mes}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        titulo: porEmpresa
          ? String(l.cliente ?? "—")
          : `${MESES[Number(l.mes) - 1] ?? l.mes} de ${l.ano}`,
        subtitulo: porEmpresa ? formatarCnpj(l.chaveEmpresa) : "",
        linhas: [],
      });
    }
    grupos.get(chave)!.linhas.push(l);
  }
  const ordenados = [...grupos.entries()].sort((a, b) =>
    porEmpresa
      ? a[1].titulo.localeCompare(b[1].titulo, "pt-BR")
      : b[0].localeCompare(a[0]),
  );

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
          Operação interna
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
          Notas fiscais emitidas
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Todas as notas da assinatura emitidas pelo CP System, e os pagamentos que ainda não
          geraram nota.
        </p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Cartao titulo="Pagamentos" valor={`${linhas.length}`} detalhe={brl(faturado)} />
        <Cartao titulo="Notas emitidas" valor={`${emitidas.length}`} detalhe="com PDF disponível" />
        <Cartao titulo="Em emissão" valor={`${Math.max(0, emEmissao)}`} detalhe="aguardando o provedor" />
        <Cartao
          titulo="Precisam de atenção"
          valor={`${comFalha.length + semNota.length}`}
          detalhe={comFalha.length > 0 ? `${comFalha.length} com falha` : "nenhuma pendência"}
          alerta={comFalha.length + semNota.length > 0}
        />
      </div>

      {(comFalha.length > 0 || semNota.length > 0) && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">
                {comFalha.length + semNota.length} pagamento(s) sem nota fiscal emitida
              </p>
              <p className="mt-1 text-xs">
                {comFalha.length > 0 && <>{comFalha.length} falharam na emissão. </>}
                {semNota.length > 0 && (
                  <>{semNota.length} foram pagos há mais de 24h e o provedor não emitiu nada. </>
                )}
                Dinheiro recebido sem nota é pendência fiscal — vale conferir no painel do Asaas.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Aba href="/admin/notas-fiscais" ativa={!porEmpresa} icone={<CalendarDays className="h-4 w-4" />}>
          Por período
        </Aba>
        <Aba href="/admin/notas-fiscais?visao=empresa" ativa={porEmpresa} icone={<Building2 className="h-4 w-4" />}>
          Por empresa
        </Aba>
      </div>

      <div className="mt-3">
        <FiltroLista
          filtros={[
            { name: "ano", label: "Todos os anos", opcoes: anos.map((a) => ({ value: a, label: a })) },
            {
              name: "mes",
              label: "Todos os meses",
              opcoes: MESES.map((m, i) => ({
                value: String(i + 1).padStart(2, "0"),
                label: m.charAt(0).toUpperCase() + m.slice(1),
              })),
            },
            {
              name: "empresa",
              label: "Todas as empresas",
              opcoes: empresas.map(([chave, nome]) => ({ value: chave, label: String(nome) })),
            },
          ]}
        />
      </div>

      {ordenados.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Nenhuma nota com esse recorte.
        </div>
      ) : (
        ordenados.map(([chave, g]) => {
          const soma = g.linhas.reduce((s, l) => s + l.valor, 0);
          const comNota = g.linhas.filter((l) => l.nfsePdfUrl || l.nfseStatus === "AUTHORIZED").length;
          return (
            <section key={chave} className="mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold capitalize text-slate-900">{g.titulo}</h2>
                  {g.subtitulo && <p className="text-xs text-slate-500">{g.subtitulo}</p>}
                </div>
                <p className="text-sm text-slate-600">
                  {g.linhas.length} pagamento{g.linhas.length > 1 ? "s" : ""} ·{" "}
                  <strong className="text-slate-800">{brl(soma)}</strong> · {comNota} nota
                  {comNota === 1 ? "" : "s"} emitida{comNota === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-3">
                <ListaNotasFiscais linhas={g.linhas} mostrarCliente={!porEmpresa} />
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function formatarCnpj(c: string) {
  const d = (c || "").replace(/\D/g, "");
  if (d.length !== 14) return c;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function Aba({
  href,
  ativa,
  icone,
  children,
}: {
  href: string;
  ativa: boolean;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        ativa
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icone}
      {children}
    </a>
  );
}

function Cartao({
  titulo,
  valor,
  detalhe,
  alerta,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        alerta ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Receipt className="h-4 w-4 text-slate-400" />
        {titulo}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>
    </div>
  );
}
