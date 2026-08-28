"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { marcarTodasLidasAction } from "@/app/actions/notificacoesSistema";

export type AvisoResumo = {
  id: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  quando: string;
};

/**
 * Sino de avisos — fixo no alto da tela, pisca enquanto houver aviso não lido.
 *
 * Regina 28/08: "coloca um sininho com avisos, fica piscando até a pessoa clicar
 * nele e ver a notificação".
 *
 * Já existia um contador dentro do menu lateral, mas ele só aparece pra quem já
 * está olhando o menu — e aviso que só quem procura encontra não é aviso. Aqui o
 * sino fica visível em qualquer tela, e a animação só para quando a pessoa abre.
 *
 * A animação respeita `prefers-reduced-motion`: quem configurou o sistema pra
 * não animar continua vendo o ponto vermelho, sem o pulso.
 */
export function SinoNotificacoes({
  avisos,
  naoLidas,
}: {
  avisos: AvisoResumo[];
  naoLidas: number;
}) {
  const [aberto, setAberto] = useState(false);
  // O sino vai pro <body> por portal. Sem isso ele nasce dentro do container da
  // aplicação, que usa efeito de vidro (backdrop-filter) — e qualquer ancestral
  // com filtro ou transform faz `position: fixed` passar a se medir por ELE, não
  // pela janela. Na prática o sino ia parar no canto esquerdo, embaixo do menu.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const [pendente, startTransition] = useTransition();
  const [contador, setContador] = useState(naoLidas);
  const caixa = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // O servidor é a fonte da verdade: quando a página recarrega com um número
  // novo, o sino acompanha (senão ele ficaria mudo depois de um aviso novo).
  useEffect(() => setContador(naoLidas), [naoLidas]);

  // Fecha ao clicar fora ou apertar Esc — comportamento que todo mundo espera
  // de um painel desses, e cuja falta irrita mais que a ausência do painel.
  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function abrir() {
    const abrindo = !aberto;
    setAberto(abrindo);
    if (abrindo && contador > 0) {
      // Para de piscar assim que ela abre — a leitura acontece aqui, na lista.
      setContador(0);
      startTransition(async () => {
        await marcarTodasLidasAction();
        router.refresh();
      });
    }
  }

  const temNaoLida = contador > 0;

  if (!montado) return null;

  return createPortal(
    // Posição por estilo direto, não por classe: as utilitárias `right-5` e
    // `z-[80]` não estavam sendo geradas neste projeto, e o sino ia parar no
    // canto esquerdo, embaixo do menu. Estilo direto não depende disso.
    <div ref={caixa} style={{ position: "fixed", top: 16, right: 20, zIndex: 80 }}>
      <button
        type="button"
        onClick={abrir}
        aria-label={temNaoLida ? `${contador} aviso(s) não lido(s)` : "Avisos"}
        aria-expanded={aberto}
        className={`relative grid h-11 w-11 place-items-center rounded-full border bg-white shadow-md transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
          temNaoLida ? "border-amber-300" : "border-slate-200"
        }`}
      >
        <Bell className={`h-5 w-5 ${temNaoLida ? "text-amber-600 sino-balanca" : "text-slate-500"}`} />
        {temNaoLida && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[19px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white sino-pulsa">
            {contador > 99 ? "99+" : contador}
          </span>
        )}
      </button>

      {aberto && (
        <div
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          style={{ position: "absolute", right: 0, marginTop: 8, width: "min(92vw, 380px)" }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Avisos</p>
            {pendente && <span className="text-[11px] text-slate-400">marcando como lidos…</span>}
          </div>

          {avisos.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Nenhum aviso por aqui. Quando algo precisar da sua atenção, ele aparece neste sino.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
              {avisos.map((a) => {
                const Conteudo = (
                  <>
                    <div className="flex items-start gap-2">
                      {!a.lida && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                      )}
                      <div className={a.lida ? "ps-4" : ""}>
                        <p className="text-sm font-semibold leading-snug text-slate-900">{a.titulo}</p>
                        {a.descricao && (
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{a.descricao}</p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400">{a.quando}</p>
                      </div>
                    </div>
                  </>
                );
                return (
                  <li key={a.id}>
                    {a.link ? (
                      <Link
                        href={a.link}
                        onClick={() => setAberto(false)}
                        className="block px-4 py-3 transition hover:bg-slate-50"
                      >
                        {Conteudo}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{Conteudo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/notificacoes"
            onClick={() => setAberto(false)}
            className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-3 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
          >
            <Check className="h-3.5 w-3.5" />
            Ver todos os avisos
          </Link>
        </div>
      )}

      <style jsx>{`
        .sino-balanca {
          animation: balanca 2.4s ease-in-out infinite;
          transform-origin: top center;
        }
        .sino-pulsa {
          animation: pulsa 2.4s ease-in-out infinite;
        }
        @keyframes balanca {
          0%, 60%, 100% { transform: rotate(0deg); }
          65% { transform: rotate(14deg); }
          70% { transform: rotate(-12deg); }
          75% { transform: rotate(9deg); }
          80% { transform: rotate(-6deg); }
          85% { transform: rotate(3deg); }
        }
        @keyframes pulsa {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55); }
          50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sino-balanca, .sino-pulsa { animation: none; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
