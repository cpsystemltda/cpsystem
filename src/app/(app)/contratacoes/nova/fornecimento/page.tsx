import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Receipt,
  FilePen,
  ShoppingCart,
  Truck,
  Wrench,
} from "lucide-react";
import { INSTRUMENTOS } from "@/lib/instrumentoLabel";

// Seletor secundário: o usuário entra aqui ao clicar em "Fornecimento /
// Execução" no card 3 do seletor principal. Cada card abre o formulário
// correspondente em /contratacoes/nova/fornecimento/[slug].

const ICONES = {
  NOTA_EMPENHO: Receipt,
  CARTA_CONTRATO: FilePen,
  AUTORIZACAO_COMPRA: ShoppingCart,
  AUTORIZACAO_ENTREGA: Truck,
  ORDEM_SERVICO: Wrench,
} as const;

const SUBTITULOS: Record<(typeof INSTRUMENTOS)[number]["value"], string> = {
  NOTA_EMPENHO:
    "Reserva orçamentária do órgão. Documento mais comum de execução.",
  CARTA_CONTRATO:
    "Substitui o Termo de Contrato em contratações de menor vulto.",
  AUTORIZACAO_COMPRA:
    "Ordem do departamento emissor para aquisição já licitada.",
  AUTORIZACAO_ENTREGA:
    "Documento de remessa: define ponto de coleta e recebedor.",
  ORDEM_SERVICO:
    "Demanda específica de execução de serviço com fiscal nomeado.",
};

export default function SeletorFornecimentoPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-8 py-6">
      <Link
        href="/contratacoes/nova"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold"
        style={{ color: "var(--text-mute)" }}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <header className="glass mb-6 rounded-[24px] px-8 py-6">
        <div className="relative z-[1]">
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--primary-deep)" }}
          >
            Fornecimento / Execução
          </p>
          <h1
            className="mt-2 text-[32px] font-extrabold leading-none"
            style={{ color: "var(--text)", letterSpacing: "-0.04em" }}
          >
            Qual{" "}
            <em
              style={{
                fontStyle: "normal",
                background:
                  "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              instrumento contratual
            </em>
            ?
          </h1>
          <p
            className="mt-2 max-w-[680px] text-[14px]"
            style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
          >
            Instrumentos substitutivos do Termo de Contrato (art. 95, Lei
            14.133/2021). Cada um pede campos próprios — escolha agora para o
            registro ser nomeado corretamente em todas as listagens.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {INSTRUMENTOS.map((inst) => {
          const Icone = ICONES[inst.value];
          return (
            <Link
              key={inst.value}
              href={`/contratacoes/nova/fornecimento/${inst.slug}`}
              className="glass-tile t-lavender group relative block overflow-hidden rounded-[18px] px-5 py-5 transition"
              style={{ minHeight: "200px" }}
            >
              <div className="kpi-aura" />
              <div className="relative z-[1] flex h-full flex-col">
                <div
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[12px]"
                  style={{ background: "rgba(197, 180, 255, 0.20)" }}
                >
                  <Icone
                    className="h-5 w-5"
                    style={{ color: "#8E73E0", strokeWidth: 1.6 }}
                  />
                </div>
                <h2
                  className="mt-3 text-[17px] font-extrabold leading-tight"
                  style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
                >
                  {inst.label}
                </h2>
                <p
                  className="mt-2 text-[12px] leading-relaxed"
                  style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
                >
                  {SUBTITULOS[inst.value]}
                </p>
                <div
                  className="mt-auto flex items-center gap-1.5 pt-3 text-[12px] font-bold"
                  style={{ color: "#8E73E0", letterSpacing: "-0.005em" }}
                >
                  Cadastrar
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                    style={{ strokeWidth: 2 }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
