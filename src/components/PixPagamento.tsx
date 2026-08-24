"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { QrCode, Copy, Check, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { obterPixDaCobrancaAction, type ResultadoPix } from "@/app/actions/pagamento";

/**
 * Bloco de pagamento por PIX (Regina 24/08: "todos os pagamentos devem ter o
 * PIX principalmente").
 *
 * O código já era gerado, mas só existia no banco — o cliente com fatura em
 * aberto tinha que sair pro site do gateway pra tentar pagar. Aqui o QR e o
 * copia-e-cola aparecem na tela, e a busca acontece sob demanda pra não pedir
 * código ao gateway em toda renderização de página.
 */

type Props = {
  cobrancaId: string;
  /** Carrega o PIX assim que o bloco aparece — usado logo depois do checkout. */
  autoCarregar?: boolean;
  /** Link da fatura no gateway, como caminho alternativo. */
  invoiceUrl?: string | null;
};

export function PixPagamento({ cobrancaId, autoCarregar = false, invoiceUrl }: Props) {
  const [estado, setEstado] = useState<"parado" | "carregando" | "pronto" | "erro">("parado");
  const [pix, setPix] = useState<{ qrCodeBase64: string | null; copiaCola: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [linkFatura, setLinkFatura] = useState<string | null>(invoiceUrl ?? null);
  const [copiado, setCopiado] = useState(false);

  async function carregar() {
    setEstado("carregando");
    setErro(null);
    const r: ResultadoPix = await obterPixDaCobrancaAction(cobrancaId);
    if (r.ok) {
      setPix({ qrCodeBase64: r.qrCodeBase64, copiaCola: r.copiaCola });
      setLinkFatura(r.invoiceUrl);
      setEstado("pronto");
    } else {
      setErro(r.erro);
      setLinkFatura(r.invoiceUrl);
      setEstado("erro");
    }
  }

  useEffect(() => {
    if (autoCarregar) void carregar();
    // Só na montagem: recarregar sozinho geraria consulta repetida ao gateway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copiar() {
    if (!pix?.copiaCola) return;
    try {
      await navigator.clipboard.writeText(pix.copiaCola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Navegador sem permissão de área de transferência: o código está
      // visível na tela e pode ser selecionado na mão.
    }
  }

  if (estado === "parado") {
    return (
      <button
        type="button"
        onClick={carregar}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        <QrCode size={16} /> Pagar com PIX
      </button>
    );
  }

  if (estado === "carregando") {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
        <Loader2 className="animate-spin" size={16} /> Gerando o código PIX…
      </p>
    );
  }

  if (estado === "erro") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
          <AlertCircle size={15} /> {erro}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={carregar}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Tentar de novo
          </button>
          {linkFatura && (
            <a
              href={linkFatura}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-800 underline"
            >
              Abrir a fatura <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
        <QrCode size={16} /> Pague por PIX
      </p>
      <p className="mt-1 text-xs text-emerald-900">
        Escaneie o QR code no app do seu banco ou use o código copia e cola. A confirmação é
        automática — em segundos a assinatura é liberada.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {pix?.qrCodeBase64 && (
          <Image
            src={pix.qrCodeBase64}
            alt="QR code para pagamento por PIX"
            width={176}
            height={176}
            unoptimized
            className="h-44 w-44 shrink-0 rounded-lg border border-emerald-200 bg-white p-2"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            PIX copia e cola
          </p>
          <p className="mt-1 max-h-24 overflow-y-auto break-all rounded-lg border border-emerald-200 bg-white p-2 font-mono text-[11px] text-slate-700">
            {pix?.copiaCola}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copiar}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {copiado ? <Check size={15} /> : <Copy size={15} />}
              {copiado ? "Código copiado" : "Copiar código"}
            </button>
            {linkFatura && (
              <a
                href={linkFatura}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
              >
                Ver a fatura <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
