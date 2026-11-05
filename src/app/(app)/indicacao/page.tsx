import Link from "next/link";
import { AlertTriangle, Gift, Users, Clock, BadgeCheck, Coins, Wallet, CalendarCheck, Trophy, Megaphone } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { COMISSAO_FIXA_POR_VINCULO } from "@/lib/comissaoEmbaixador";
import { resumoDaIndicacao, mensagensProntas, type SituacaoIndicada } from "@/lib/indicacao";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { CupomIndicacaoCard } from "@/components/CupomIndicacaoCard";
import { MensagensProntas } from "@/components/MensagensProntas";

export const dynamic = "force-dynamic";

const ROTULO_SITUACAO: Record<SituacaoIndicada, { texto: string; cor: string }> = {
  TESTE: { texto: "Em teste", cor: "bg-amber-100 text-amber-800" },
  AGUARDANDO_PAGAMENTO: { texto: "Aguardando 1ª fatura", cor: "bg-sky-100 text-sky-800" },
  ASSINANTE: { texto: "Assinante · rende R$ 29,90", cor: "bg-emerald-100 text-emerald-800" },
  INADIMPLENTE: { texto: "Pagamento atrasado", cor: "bg-red-100 text-red-800" },
  CANCELADA: { texto: "Cancelada", cor: "bg-slate-100 text-slate-700" },
};

const METAS = [3, 5, 10, 20, 50];

function data(d: Date | null): string {
  return d ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

/**
 * Minha indicação — a página do indicador e do analista parceiro
 * (Regina 02/11/2026): cupom, quantas empresas entraram por ele, em que
 * ponto cada uma está, quanto rende por mês, quando o dinheiro entra, o
 * histórico do que já foi pago e as mensagens prontas para compartilhar.
 *
 * "Quando o dinheiro entra" não é um dia do mês: a comissão sai por PIX
 * assim que o pagamento da empresa cai em conta — PIX no mesmo dia, cartão
 * quando a operadora libera (~32 dias). Regina 05/11/2026, ao ver "dia 20"
 * aqui: *"Que coisa ridícula. É sempre no PIX, cai na hora."*
 */
export default async function IndicacaoPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;

  const conta = await prisma.conta.findUnique({ where: { id: usuario.contaId }, select: { tipo: true } });
  if (conta?.tipo !== "ANALISTA") {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <Gift className="mx-auto h-10 w-10" style={{ color: "var(--text-mute)" }} />
        <h1 className="mt-4 text-2xl font-bold" style={{ color: "var(--text)" }}>Programa de Indicação</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
          O cupom de indicação é de pessoa, não de empresa. Para indicar o CP System e receber R$ 29,90 por mês por empresa, crie o seu cadastro de indicador.
        </p>
        <Link href="/indicar" className="mt-5 inline-flex rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-6 py-2.5 text-sm font-bold text-white">
          Conhecer o programa
        </Link>
      </div>
    );
  }

  const r = await resumoDaIndicacao(usuario.contaId, usuario.id);
  if (!r) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center text-sm" style={{ color: "var(--text-soft)" }}>
        Não encontrei o seu cadastro de analista. Fale com a gente pelo WhatsApp da CP System.
      </div>
    );
  }

  const { analista, cupom, empresas, placar, comissoes } = r;
  const primeiro = analista.nomeCompleto.split(" ")[0] || analista.nomeCompleto;
  const proximaMeta = METAS.find((m) => m > placar.assinantes) ?? null;
  const mensagens = mensagensProntas(analista.nomeCompleto, cupom.codigo);
  const pctTeste = placar.cadastradas ? Math.round((placar.emTeste / placar.cadastradas) * 100) : 0;
  const pctAssinantes = placar.cadastradas ? Math.round((placar.assinantes / placar.cadastradas) * 100) : 0;
  const pr = placar.proximoRepasse;

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow={analista.indicador ? "Programa de Indicação" : "Programa de Indicação · Analista Parceiro"}
        titulo="Minha indicação"
        destaque={primeiro}
        subtitulo="Seu cupom, quem entrou por ele e quanto isso rende todo mês."
      />

      {sp.novo === "1" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-bold">Bem-vindo ao programa, {primeiro}. Seu cupom já está pronto.</p>
          <p className="mt-1">
            Mande o código ou o link para a primeira empresa hoje: as mensagens prontas estão logo abaixo. Quando ela se cadastrar, aparece aqui na mesma hora.
          </p>
        </div>
      )}

      {!analista.pix && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Sem chave PIX cadastrada.</strong> É por ela que a comissão entra.{" "}
            <Link href="/conta/perfil" className="font-bold underline">Cadastrar agora</Link>.
          </p>
        </div>
      )}

      <div className="mt-6">
        <CupomIndicacaoCard codigo={cupom.codigo} link={cupom.link} diasTrial={cupom.diasTrial} nome={analista.nomeCompleto} />
      </div>

      {/* Placar */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={Users} titulo="Cadastradas pelo cupom" valor={String(placar.cadastradas)} sub={`${cupom.usosAtuais} uso${cupom.usosAtuais === 1 ? "" : "s"} do código`} />
        <Card icon={Clock} titulo="Em teste" valor={String(placar.emTeste)} sub={`${placar.aguardandoPagamento} aguardando a 1ª fatura`} cor="amber" />
        <Card icon={BadgeCheck} titulo="Assinantes ativas" valor={String(placar.assinantes)} sub={placar.canceladas ? `${placar.canceladas} cancelada${placar.canceladas > 1 ? "s" : ""} ou em atraso` : "nenhuma cancelada"} cor="emerald" />
        <Card icon={Coins} titulo="Rende por mês" valor={brl(placar.comissaoMensal)} sub={`${brl(COMISSAO_FIXA_POR_VINCULO)} × ${placar.assinantes}`} cor="emerald" />
        <Card icon={Wallet} titulo="A receber" valor={brl(placar.aReceber)} sub={`${comissoes.filter((c) => !c.paga).length} comissão${comissoes.filter((c) => !c.paga).length === 1 ? "" : "ões"} em aberto`} cor="amber" />
        <Card
          icon={CalendarCheck}
          titulo="Próximo repasse"
          valor={pr.situacao === "LIBERADA" ? "Liberado" : pr.situacao === "PREVISTA" ? data(pr.em) : pr.situacao === "AGUARDANDO_CLIENTE" ? "Aguardando" : "—"}
          sub={
            pr.situacao === "LIBERADA"
              ? `${brl(pr.valor)} saem no repasse automático por PIX`
              : pr.situacao === "PREVISTA"
              ? `${brl(pr.valor)} quando a operadora do cartão liberar`
              : pr.situacao === "AGUARDANDO_CLIENTE"
              ? `${brl(pr.valor)} assim que a empresa pagar a fatura`
              : "nada a pagar ainda"
          }
          cor={pr.situacao === "LIBERADA" ? "emerald" : undefined}
        />
        <Card icon={Trophy} titulo="Já recebido" valor={brl(placar.recebido)} sub={`${comissoes.filter((c) => c.paga).length} pagamento${comissoes.filter((c) => c.paga).length === 1 ? "" : "s"}`} />
        <Card
          icon={Megaphone}
          titulo="Próxima meta"
          valor={proximaMeta ? `${proximaMeta} assinantes` : "Topo"}
          sub={proximaMeta ? `faltam ${proximaMeta - placar.assinantes} → ${brl(proximaMeta * COMISSAO_FIXA_POR_VINCULO)}/mês` : `${brl(placar.comissaoMensal)} todo mês`}
        />
      </div>

      {/* Funil */}
      <section className="glass mt-6 rounded-[20px] px-6 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Funil das suas indicações</h2>
        {placar.cadastradas === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Ninguém se cadastrou com o seu cupom ainda. A primeira indicação é a mais importante: use uma das mensagens prontas abaixo hoje.
          </p>
        ) : (
          <div className="mt-4 space-y-2.5">
            <Barra rotulo="Cadastradas" n={placar.cadastradas} pct={100} cor="bg-slate-400" />
            <Barra rotulo="Em teste" n={placar.emTeste} pct={pctTeste} cor="bg-amber-400" />
            <Barra rotulo="Assinantes (rendem comissão)" n={placar.assinantes} pct={pctAssinantes} cor="bg-emerald-500" />
          </div>
        )}
      </section>

      {/* Empresas */}
      <section className="glass mt-6 rounded-[20px] px-6 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Empresas que entraram pelo seu cupom ({empresas.length})</h2>
        {empresas.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhuma ainda.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Cadastro</th>
                <th className="px-3 py-2 text-left">Situação</th>
                <th className="px-3 py-2 text-left">Desde</th>
                <th className="px-3 py-2 text-right">Rende/mês</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => {
                const s = ROTULO_SITUACAO[e.situacao];
                return (
                  <tr key={e.contaId} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-900">{e.nome}</span>
                      <span className="block text-xs text-slate-500">{e.responsavel}{e.viaCupom ? "" : " · pelo link pessoal"}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{data(e.cadastradaEm)}</td>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${s.cor}`}>{s.texto}</span></td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {e.situacao === "TESTE" ? `teste até ${data(e.trialAteEm)}` : e.primeiraFaturaPagaEm ? `1ª fatura em ${data(e.primeiraFaturaPagaEm)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{e.comissaoMensal ? brl(e.comissaoMensal) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Mensagens prontas */}
      <section className="glass mt-6 rounded-[20px] px-6 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mensagens prontas com o seu cupom</h2>
        <p className="mt-1 text-[13px] text-slate-600">
          Falam do problema da empresa, não do programa. Copie, ajuste o nome e mande.
        </p>
        <div className="mt-4">
          <MensagensProntas mensagens={mensagens} />
        </div>
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-[13px] text-slate-800">
          <strong>Como apresentar em 30 segundos:</strong> “Empresa que vende para o governo perde dinheiro em cinco lugares: prazo de prorrogação que passa, entrega que atrasa e vira multa, entrega sem nota, nota que ninguém encaminha e saldo de ata que sobra. O CP System avisa no WhatsApp antes de virar problema. Testa 14 dias sem cartão com o meu código {cupom.codigo}.”
        </div>
      </section>

      {/* Comissões */}
      <section className="glass mt-6 rounded-[20px] px-6 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico de comissões ({comissoes.length})</h2>
        {comissoes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            A primeira comissão aparece aqui no mês em que uma empresa indicada paga a primeira fatura. O repasse é por PIX, assim que o pagamento dela entra em conta: PIX no mesmo dia; cartão em cerca de 32 dias, que é o prazo de liberação da operadora.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Competência</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-left">Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {comissoes.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{c.competencia}</td>
                  <td className="px-3 py-2">{c.cliente}</td>
                  <td className="px-3 py-2 text-right font-medium">{brl(c.valor)}</td>
                  <td className="px-3 py-2">
                    {c.paga ? (
                      <span className="text-xs text-emerald-700">Pago em {data(c.pagaEm)}</span>
                    ) : c.liberacao?.situacao === "LIBERADA" ? (
                      <span className="text-xs text-emerald-700">Liberada · sai no próximo repasse por PIX</span>
                    ) : c.liberacao?.situacao === "PREVISTA" ? (
                      <span className="text-xs text-amber-700">Prevista para {data(c.liberacao.em)} (pagamento no cartão)</span>
                    ) : (
                      <span className="text-xs text-amber-700">Aguardando o pagamento da empresa</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-8 text-[12px] text-slate-400">
        Regra do programa: R$ 29,90 por mês por empresa indicada com assinatura ativa, a partir da primeira fatura paga, enquanto ela for cliente. Repasse por PIX assim que o pagamento da empresa entra em conta. Contrato em{" "}
        <Link href="/termos?tipo=analista" className="underline">Termos</Link>. Dados de recebimento em{" "}
        <Link href="/conta/perfil" className="underline">Meus dados</Link>.
      </p>
    </div>
  );
}

function Card({ icon: Icon, titulo, valor, sub, cor }: { icon: React.ComponentType<{ className?: string }>; titulo: string; valor: string; sub: string; cor?: "amber" | "emerald" }) {
  const corCls = cor === "amber" ? "text-amber-700" : cor === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="glass-tile rounded-[18px] px-5 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {titulo}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${corCls}`}>{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Barra({ rotulo, n, pct, cor }: { rotulo: string; n: number; pct: number; cor: string }) {
  return (
    <div>
      <div className="flex justify-between text-[12.5px] text-slate-700">
        <span>{rotulo}</span>
        <span className="font-semibold tabular-nums">{n} · {pct}%</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.max(pct, n ? 4 : 0)}%` }} />
      </div>
    </div>
  );
}
