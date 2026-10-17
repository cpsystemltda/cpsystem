import { redirect } from "next/navigation";
import { Receipt, CircleAlert } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ListaNotasFiscais } from "@/components/ListaNotasFiscais";

/**
 * Todas as notas fiscais emitidas pelo CP System.
 *
 * Regina, 15/10/2026: *"a gente como administrador e superadministrador, eu e
 * o Igor, também temos que ter acesso a todas as notas fiscais emitidas
 * dentro do sistema."*
 *
 * Até aqui só existia a última nota de cada cliente, numa coluna da lista de
 * clientes. Para responder "quantas notas saíram este mês?" ou "a do fulano
 * foi emitida?" era preciso abrir o Asaas.
 *
 * A tela mostra também o que **não** saiu: pagamento recebido sem nota é
 * problema fiscal, e é justamente o que some quando a lista só traz o que deu
 * certo.
 */
export const dynamic = "force-dynamic";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function NotasFiscaisPage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) redirect("/dashboard");

  const cobrancas = await prisma.cobranca.findMany({
    where: { status: "PAGA" },
    orderBy: [{ pagaEm: "desc" }],
    take: 300,
    select: {
      id: true, competencia: true, valor: true, pagaEm: true,
      nfseNumero: true, nfseStatus: true, nfsePdfUrl: true,
      conta: {
        select: {
          empresas: { select: { razaoSocial: true, nomeFantasia: true }, take: 1 },
          analista: { select: { nomeCompleto: true } },
        },
      },
    },
  });

  const linhas = cobrancas.map((c) => ({
    id: c.id,
    competencia: c.competencia,
    valor: c.valor,
    pagaEm: c.pagaEm,
    nfseNumero: c.nfseNumero,
    nfseStatus: c.nfseStatus,
    nfsePdfUrl: c.nfsePdfUrl,
    cliente:
      c.conta.empresas[0]?.nomeFantasia ||
      c.conta.empresas[0]?.razaoSocial ||
      c.conta.analista?.nomeCompleto ||
      "—",
  }));

  const emitidas = linhas.filter((l) => l.nfsePdfUrl || l.nfseStatus === "AUTHORIZED");
  const emEmissao = linhas.filter(
    (l) => !l.nfsePdfUrl && l.nfseStatus && ["SCHEDULED", "SYNCHRONIZED"].includes(l.nfseStatus),
  );
  const comFalha = linhas.filter((l) => l.nfseStatus === "ERROR");
  // Pagamento recebido e nenhuma nota sequer começou: o caso que precisa de
  // gente olhando. Dá uma folga de 24h, que é o tempo de o provedor emitir.
  const ontem = new Date(Date.now() - 24 * 3600_000);
  const semNota = linhas.filter((l) => !l.nfseStatus && l.pagaEm && l.pagaEm < ontem);
  const aguardando = linhas.filter((l) => !l.nfseStatus && l.pagaEm && l.pagaEm >= ontem);

  const faturado = linhas.reduce((s, l) => s + l.valor, 0);

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
          Operação interna
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
          Notas fiscais
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Todas as notas da assinatura emitidas pelo CP System, e os pagamentos que ainda não
          geraram nota.
        </p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Cartao titulo="Pagamentos recebidos" valor={`${linhas.length}`} detalhe={brl(faturado)} />
        <Cartao titulo="Notas emitidas" valor={`${emitidas.length}`} detalhe="com PDF disponível" />
        <Cartao
          titulo="Em emissão"
          valor={`${emEmissao.length + aguardando.length}`}
          detalhe="aguardando o provedor"
        />
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
                Vale conferir no painel do Asaas — dinheiro recebido sem nota é pendência fiscal.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Todas as notas</h2>
        <div className="mt-4">
          <ListaNotasFiscais linhas={linhas} mostrarCliente />
        </div>
      </section>
    </div>
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
