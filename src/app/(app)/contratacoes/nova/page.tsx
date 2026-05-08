import Link from "next/link";
import { FileText, ClipboardList, Receipt, ArrowRight, Building2 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NovaContratacaoPage() {
  const usuario = await exigirUsuario();
  const empresas = await prisma.empresa.count({ where: { contaId: usuario.contaId } });

  if (empresas === 0) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <div
          className="glass mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "rgba(212, 175, 55, 0.15)" }}
        >
          <Building2 className="h-8 w-8" style={{ color: "var(--primary-bright)" }} />
        </div>
        <h1
          className="mt-6 text-3xl font-extrabold"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          Cadastre uma empresa primeiro
        </h1>
        <p
          className="mx-auto mt-3 max-w-md text-base"
          style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
        >
          Para registrar contratações você precisa ter pelo menos uma empresa cadastrada.
        </p>
        <Link href="/empresas/nova" className="btn-primary mt-8 inline-flex">
          Cadastrar empresa
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-8">
      {/* Header */}
      <header className="glass mb-8 rounded-[28px] px-10 py-9">
        <div className="relative z-[1]">
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--primary)" }}
          >
            Nova contratação
          </p>
          <h1
            className="mt-2 text-[44px] font-extrabold leading-none"
            style={{ color: "var(--text)", letterSpacing: "-0.045em" }}
          >
            Selecione o{" "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-bright), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              instrumento
            </em>
          </h1>
          <p
            className="mt-3 max-w-[640px] text-[15px]"
            style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
          >
            Escolha qual instrumento você quer cadastrar. Cada um tem regras específicas pela
            Lei 14.133/2021.
          </p>
        </div>
      </header>

      {/* 3 cards grandes */}
      <div className="grid gap-5 md:grid-cols-3">
        <Card
          href="/contratacoes/nova/ata"
          icone={FileText}
          titulo="Ata de Registro de Preços"
          descricao="Sistema de Registro de Preços"
          textoSecundario="SRP — registra preços e itens; depois pode gerar contratos e empenhos com abatimento automático de saldo."
          tone="primary"
        />
        <Card
          href="/contratacoes/nova/contrato"
          icone={ClipboardList}
          titulo="Contrato administrativo"
          descricao="Derivado ou não de uma Ata de Registro de Preços"
          textoSecundario="Registra obrigações, prazos e itens. Pode ser independente ou abater saldo de Ata existente."
          tone="mint"
        />
        <Card
          href="/contratacoes/nova/empenho"
          icone={Receipt}
          titulo={
            <>
              Nota de Empenho
              <span
                className="block text-[15px] font-semibold"
                style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
              >
                Carta-Contrato · Autorização de Compra · Ordem de Serviço
              </span>
            </>
          }
          descricao="Derivado ou não de uma Ata de Registro de Preços"
          textoSecundario={
            <>
              Reserva orçamentária. Pode ser autônoma, derivada de Ata (SRP) ou de Contrato existente.
              <span className="mt-2 block text-[12px]" style={{ color: "var(--text-mute)" }}>
                Lei 14.133/2021, art. 95 — substitui o Termo de Contrato em hipóteses específicas.
              </span>
            </>
          }
          tone="lavender"
        />
      </div>
    </div>
  );
}

type Tone = "primary" | "mint" | "lavender";

const ICON_TINT: Record<Tone, { bg: string; color: string }> = {
  primary: { bg: "rgba(212, 175, 55, 0.18)", color: "var(--primary-bright)" },
  mint: { bg: "rgba(93, 216, 182, 0.18)", color: "var(--mint)" },
  lavender: { bg: "rgba(197, 180, 255, 0.18)", color: "var(--lavender)" },
};

function Card({
  href,
  icone: Icone,
  titulo,
  descricao,
  textoSecundario,
  tone,
}: {
  href: string;
  icone: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  titulo: React.ReactNode;
  descricao: string;
  textoSecundario: React.ReactNode;
  tone: Tone;
}) {
  const tint = ICON_TINT[tone];
  return (
    <Link
      href={href}
      className={`glass-tile t-${tone} group relative block overflow-hidden rounded-[24px] px-8 py-8 transition`}
      style={{ minHeight: "320px" }}
    >
      <div className="kpi-aura" />
      <div className="relative z-[1] flex h-full flex-col">
        {/* Ícone grande */}
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-[16px]"
          style={{ background: tint.bg }}
        >
          <Icone
            className="h-7 w-7"
            style={{ color: tint.color, strokeWidth: 1.6 }}
          />
        </div>

        {/* Título grande */}
        <h2
          className="mt-6 text-[24px] font-extrabold leading-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          {titulo}
        </h2>

        {/* Descrição em destaque (eyebrow secundário) */}
        <p
          className="mt-3 text-[13px] font-bold uppercase"
          style={{
            letterSpacing: "0.16em",
            color: tint.color,
          }}
        >
          {descricao}
        </p>

        {/* Texto explicativo */}
        <div
          className="mt-3 text-[14px] leading-relaxed"
          style={{ color: "var(--text-soft)", letterSpacing: "-0.005em" }}
        >
          {textoSecundario}
        </div>

        {/* CTA */}
        <div
          className="mt-auto flex items-center gap-2 pt-6 text-[14px] font-bold"
          style={{ color: tint.color, letterSpacing: "-0.005em" }}
        >
          Cadastrar
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            style={{ strokeWidth: 2 }}
          />
        </div>
      </div>
    </Link>
  );
}
