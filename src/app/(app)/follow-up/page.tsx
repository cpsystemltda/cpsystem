import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { temAcessoInterno } from "@/lib/acessoInterno";
import {
  listarClientesParaFollowUp,
  listarFeedbacks,
  MARCOS_INICIAIS,
  INTERVALO_TRIMESTRAL,
} from "@/lib/followUpClientes";
import { ListaFollowUp, type ClienteNaTela } from "@/components/ListaFollowUp";
import { HeartHandshake, Target, MessageSquare, Lightbulb, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Follow-up proativo de clientes — a carteira de quem paga, com o diagnóstico
 * de uso de cada um e o registro de cada conversa.
 *
 * Igor, 30/10/2026: manter contato com a base para evitar churn; ver onde o
 * cliente está falhando no uso (alimentando errado, deixando de alimentar,
 * funcionalidades ociosas); orientar; colher feedback para melhorar o
 * sistema. Cadência 30/60/90/180 dias e, depois, a cada trimestre.
 *
 * Acesso: equipe do CP System, mesma regra da prospecção.
 */
export default async function FollowUpPage() {
  const usuario = await exigirUsuario();
  if (!(await temAcessoInterno(usuario))) redirect("/dashboard");

  const [clientes, feedbacks] = await Promise.all([listarClientesParaFollowUp(), listarFeedbacks(50)]);

  const naTela: ClienteNaTela[] = clientes.map((c) => ({
    contaId: c.contaId,
    nome: c.nome,
    plano: c.plano,
    statusAssinatura: c.statusAssinatura,
    titular: c.titular,
    cadencia: {
      clienteDesde: c.cadencia.clienteDesde.toISOString(),
      diasComoCliente: c.cadencia.diasComoCliente,
      marco: c.cadencia.marco,
      previstoPara: c.cadencia.previstoPara.toISOString(),
      situacao: c.cadencia.situacao,
      diasDeDesvio: c.cadencia.diasDeDesvio,
      retornarEm: c.cadencia.retornarEm?.toISOString() ?? null,
    },
    diagnostico: {
      documentos: c.diagnostico.documentos,
      ultimaMovimentacaoEm: c.diagnostico.ultimaMovimentacaoEm?.toISOString() ?? null,
      ultimoAcessoEm: c.diagnostico.ultimoAcessoEm?.toISOString() ?? null,
      usuarios: c.diagnostico.usuarios,
      pontos: c.diagnostico.pontos,
    },
    tentativasDesdeUltimo: c.tentativasDesdeUltimo,
    historico: c.historico.map((h) => ({
      id: h.id,
      marcoDias: h.marcoDias,
      resultado: h.resultado,
      canal: h.canal,
      contatoNome: h.contatoNome,
      resumo: h.resumo,
      orientacoes: h.orientacoes,
      feedback: h.feedback,
      retornarEm: h.retornarEm?.toISOString() ?? null,
      realizadoEm: h.realizadoEm.toISOString(),
      realizadoPorNome: h.realizadoPorNome,
    })),
  }));

  const atrasados = clientes.filter((c) => c.cadencia.situacao === "ATRASADO" || c.cadencia.situacao === "RETORNO_PEDIDO").length;
  const naJanela = clientes.filter((c) => c.cadencia.situacao === "NA_JANELA").length;
  const emDia = clientes.filter((c) => c.cadencia.situacao === "EM_DIA").length;
  const comPontoGrave = clientes.filter((c) => c.diagnostico.pontos.some((p) => p.gravidade === "alta")).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Uso interno · Relacionamento</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Follow-up de clientes</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">
        Quem paga recebe uma conversa nossa com cadência marcada — não para vender, para{" "}
        <strong>evitar que vá embora</strong>. O sistema diz quem está na vez, o que a empresa está
        deixando de usar e o que orientar. A ligação é sua; o registro fica aqui.
      </p>

      {/* Placar */}
      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        {[
          ["Clientes", clientes.length, "text-blue-700"],
          ["Atrasados", atrasados, atrasados ? "text-red-600" : "text-slate-400"],
          ["Esta semana", naJanela, naJanela ? "text-amber-600" : "text-slate-400"],
          ["Em dia", emDia, "text-emerald-700"],
          ["Com ponto grave", comPontoGrave, comPontoGrave ? "text-red-600" : "text-slate-400"],
        ].map(([rot, n, cor]) => (
          <div key={String(rot)} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className={`text-2xl font-extrabold tabular-nums ${cor}`}>{n as number}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rot as string}</p>
          </div>
        ))}
      </div>

      {/* ── 1 · A rotina ─────────────────────────────────────────────── */}
      <Secao icone={<CalendarClock className="h-4 w-4" />} titulo="1 · A cadência">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-[13.5px] text-slate-700">
            <p className="font-bold text-slate-900">Quando falar</p>
            <p className="mt-1">
              Aos <strong>{MARCOS_INICIAIS.join(", ")} dias</strong> de cliente e, depois, a cada{" "}
              <strong>{INTERVALO_TRIMESTRAL} dias</strong>. É o mínimo: a cada trimestre todo cliente
              ouviu a nossa voz. “Cliente desde” é a data da primeira fatura paga.
            </p>
            <p className="mt-2 text-[12.5px] text-slate-500">
              A tela mostra o marco <em>da idade</em> do cliente. Quem virou cliente há 100 dias e nunca
              foi contatado está no marco de 90 — o contato registrado leva direto ao de 180, sem
              cobrar três conversas seguidas.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-[13.5px] text-slate-700">
            <p className="font-bold text-slate-900">Para que serve a conversa</p>
            <ul className="mt-1 space-y-1">
              <li>▸ <strong>Manter o contato</strong> com quem paga — cliente que conversa não cancela em silêncio.</li>
              <li>▸ <strong>Ver onde está falhando</strong>: alimentando errado, deixando de alimentar, recurso parado.</li>
              <li>▸ <strong>Orientar</strong> o caminho na tela — ele faz, com você na linha.</li>
              <li>▸ <strong>Colher feedback</strong> — o que ele pediu vira lista de melhoria, no fim desta página.</li>
            </ul>
            <p className="mt-2 text-[12.5px] text-slate-500">
              Toda segunda-feira o grupo da equipe recebe quem está na vez. “Tentei e não falei” fica
              registrado e o marco continua na vez; “Falei” cumpre o marco.
            </p>
          </div>
        </div>
      </Secao>

      {/* ── 2 · Roteiro ──────────────────────────────────────────────── */}
      <Secao icone={<MessageSquare className="h-4 w-4" />} titulo="2 · O roteiro da conversa">
        <p className="text-sm text-slate-700">
          Não é pesquisa de satisfação nem cobrança. É uma conversa curta de quem olhou a conta
          antes de ligar — e o card de cada cliente abaixo é exatamente isso: o que olhar antes.
        </p>
        <Fala titulo="Abertura (20 segundos)">
          Olá, [nome], aqui é [seu nome], da CP System. Não é cobrança nem venda: faço um
          acompanhamento com cada cliente de tempos em tempos para garantir que o sistema está
          trabalhando para vocês. Tem cinco minutos?
        </Fala>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Bloco titulo="Como está a operação" cor="slate">
            <li>• O que mudou desde a última vez: contrato novo, prorrogação, equipe?</li>
            <li>• Quem está operando o sistema hoje no dia a dia?</li>
            <li>• Os avisos de WhatsApp estão chegando para a pessoa certa?</li>
          </Bloco>
          <Bloco titulo="Onde está falhando (use o diagnóstico)" cor="amber">
            <li>• “Vi aqui que há [N] entregas sem nota registrada — a nota já saiu?”</li>
            <li>• “O último lançamento foi em [data]; entrou algo novo desde então?”</li>
            <li>• “Vocês têm a conciliação no plano e nunca mandaram um extrato — quer que eu mostre?”</li>
          </Bloco>
          <Bloco titulo="Orientar (ele faz, você guia)" cor="blue">
            <li>• Um ponto por vez, o mais grave primeiro. Cada card traz o caminho da tela.</li>
            <li>• Peça para ele abrir a tela enquanto fala; registrar junto leva um minuto.</li>
            <li>• Nunca “me manda que eu cadastro” — o objetivo é ele saber fazer.</li>
          </Bloco>
          <Bloco titulo="Colher feedback" cor="violet">
            <li>• “O que o sistema ainda não faz e deveria?”</li>
            <li>• “Teve alguma tela que deu trabalho ou confundiu?”</li>
            <li>• “Se pudesse mudar uma coisa, o que seria?” — anote literalmente.</li>
          </Bloco>
        </div>
        <Fala titulo="Fechamento">
          Vou deixar registrado o que conversamos. Volto a falar com você em [próximo marco] — e se
          precisar antes, é só responder no WhatsApp da CP System.
        </Fala>
      </Secao>

      {/* ── 3 · A carteira ───────────────────────────────────────────── */}
      <Secao icone={<HeartHandshake className="h-4 w-4" />} titulo="3 · A carteira">
        <p className="mb-4 text-[13.5px] text-slate-600">
          Em ordem de urgência. Cada card mostra o uso em números, os pontos de atenção com a
          orientação pronta, o histórico e o botão para registrar a conversa.
        </p>
        <ListaFollowUp clientes={naTela} />
      </Secao>

      {/* ── 4 · Feedbacks ────────────────────────────────────────────── */}
      <Secao icone={<Lightbulb className="h-4 w-4" />} titulo="4 · Feedbacks colhidos">
        <p className="mb-3 text-[13.5px] text-slate-600">
          Tudo o que os clientes pediram ou criticaram nas conversas, do mais recente para o mais
          antigo. É a lista de melhoria do sistema falada por quem paga.
        </p>
        {feedbacks.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Nenhum feedback registrado ainda. Ele aparece aqui assim que for preenchido no registro
            de um contato.
          </p>
        ) : (
          <ul className="space-y-2">
            {feedbacks.map((f) => (
              <li key={f.id} className="rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3">
                <p className="text-[12px] text-slate-500">
                  <strong className="text-slate-800">{f.cliente}</strong> · {f.realizadoEm.toLocaleDateString("pt-BR")}
                  {f.realizadoPorNome ? ` · anotado por ${f.realizadoPorNome}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-line text-[13.5px] text-slate-800">{f.feedback}</p>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <p className="mt-10 flex items-center gap-2 text-[12px] text-slate-400">
        <Target className="h-3.5 w-3.5" /> Trial não entra aqui: quem está no teste é acompanhado pela rotina de ativação.
      </p>
    </div>
  );
}

function Secao({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        {icone} {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fala({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border-l-4 border-blue-400 bg-blue-50/60 p-3">
      <p className="mb-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-blue-700">{titulo}</p>
      <p className="text-[14px] leading-relaxed text-slate-800">{children}</p>
    </div>
  );
}

const COR_BLOCO: Record<string, string> = {
  slate: "border-slate-200 bg-white",
  amber: "border-amber-200 bg-amber-50/60",
  blue: "border-blue-200 bg-blue-50/50",
  violet: "border-violet-200 bg-violet-50/50",
};

function Bloco({ titulo, cor, children }: { titulo: string; cor: keyof typeof COR_BLOCO; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 ${COR_BLOCO[cor]}`}>
      <p className="text-[13.5px] font-bold text-slate-900">{titulo}</p>
      <ul className="mt-1.5 space-y-1 text-[13px] text-slate-700">{children}</ul>
    </div>
  );
}
