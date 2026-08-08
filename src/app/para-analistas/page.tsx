import Link from "next/link";
import {
  LayoutGrid,
  FileSpreadsheet,
  Sparkles,
  BellRing,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { VideoInstitucional } from "@/components/VideoInstitucional";

// Landing publica do Analista Parceiro (Regina 08/08/2026).
//
// Por que existe separada de /seja-embaixador: sao publicos e propostas
// diferentes. O embaixador INDICA e ganha comissao; o analista ATUA dentro das
// empresas e precisa de ferramenta pra tocar a carteira. Misturar os dois numa
// pagina so confundia — o analista lia "programa de indicacao" e nao entendia
// que o sistema e ferramenta de trabalho dele.
//
// Ordem da argumentacao (definida na estrategia de aquisicao): primeiro a dor
// operacional DELE (uma planilha por cliente), depois o painel de carteira,
// depois a importacao por IA que derruba a objecao de migracao, e SO ENTAO a
// remuneracao. Falar de dinheiro antes faz soar como esquema de comissao.
//
// Visual: usa o mesmo sistema da landing (.glass, .section-dark-bleed,
// .btn-primary, .eyebrow e as vars de globals.css). Nao inventar tokens novos.

export const metadata = {
  title: "Para analistas de licitação — CP System",
  description:
    "Gerencie a carteira inteira de clientes num painel só. Suba sua planilha e a IA organiza tudo. R$ 29,90 por empresa vinculada, todo mês.",
};

export default function ParaAnalistasPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* topo */}
        <div className="mb-14 flex items-center justify-between">
          <Logo variant="sm" />
          <Link
            href="/"
            className="text-xs font-bold"
            style={{ color: "var(--primary-deep)" }}
          >
            ← Voltar pro site
          </Link>
        </div>

        {/* ---------- HERO ---------- */}
        <header className="mx-auto max-w-3xl text-center">
          <p className="eyebrow" style={{ color: "var(--primary-deep)" }}>
            Analista Parceiro · CP System
          </p>
          <h1
            className="mt-4 font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.035em", fontSize: "clamp(30px, 6vw, 46px)", lineHeight: 1.07 }}
          >
            Uma planilha por cliente.
            <br />
            <em
              className="not-italic"
              style={{
                background: "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Um painel para todos.
            </em>
          </h1>
          <p
            className="mx-auto mt-5 max-w-2xl  leading-relaxed"
            style={{ fontSize: "16px", color: "var(--text-soft)" }}
          >
            Se você assessora empresas em licitações, seu problema não é ganhar o pregão — é
            controlar o que vem depois. Prazo de entrega, saldo de ata, vencimento de contrato,
            reajuste na hora certa. De cada cliente. Ao mesmo tempo.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup?tipo=ANALISTA" className="btn-primary inline-flex items-center gap-2">
              Criar minha conta de analista
              <ArrowRight size={16} />
            </Link>
            <span className="" style={{ fontSize: "12px", color: "var(--text-mute)" }}>
              14 dias de teste · cancele quando quiser
            </span>
          </div>
        </header>

        {/* ---------- VÍDEO OFICIAL ---------- */}
        <section className="mt-16">
          <div className="mx-auto max-w-3xl">
            <VideoInstitucional />
            <p className="mt-3 text-center" style={{ fontSize: "12px", color: "var(--text-mute)" }}>
              Tour de 2 minutos pelo CP System
            </p>
          </div>
        </section>

        {/* ---------- O PAINEL ---------- */}
        <section className="mt-20">
          <h2
            className="text-center font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.03em", fontSize: "clamp(22px, 3.6vw, 28px)" }}
          >
            O que você passa a enxergar
          </h2>
          <p
            className="mx-auto mt-2 max-w-xl text-center"
            style={{ fontSize: "14px", color: "var(--text-soft)" }}
          >
            Um lugar só, com a carteira inteira. Sem abrir dez arquivos para responder uma pergunta.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Recurso
              icone={LayoutGrid}
              titulo="Carteira em uma tela"
              desc="Todos os clientes, com o que está em execução em cada um. Você abre e sabe onde pisar hoje."
            />
            <Recurso
              icone={BellRing}
              titulo="Alerta antes do prazo"
              desc="Aviso no WhatsApp de entrega chegando, ata vencendo e contrato acabando — de qualquer cliente da carteira."
            />
            <Recurso
              icone={FileSpreadsheet}
              titulo="Saldo de ata em tempo real"
              desc="Quanto já foi empenhado e quanto ainda resta, item por item. Sem recalcular à mão."
            />
            <Recurso
              icone={ShieldCheck}
              titulo="Lei 14.133 auditada"
              desc="Limite de aditivo, adesão e o momento certo de pedir reajuste — o sistema avisa antes de virar problema."
            />
          </div>
        </section>
      </div>

      {/* ---------- A OBJEÇÃO: migrar a planilha (seção escura) ---------- */}
      <section className="section-dark-bleed mt-6">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="eyebrow" style={{ color: "var(--primary)" }}>
            Você não vai redigitar nada
          </p>
          <h2
            className="mt-3 font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.03em", fontSize: "clamp(24px, 4.4vw, 32px)", lineHeight: 1.15 }}
          >
            Suba sua planilha. A gente organiza.
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl  leading-relaxed"
            style={{ fontSize: "15px", color: "var(--text-soft)" }}
          >
            Sabemos que sua carteira mora numa planilha construída ao longo de anos, do seu jeito.
            Você envia o arquivo e nossa inteligência artificial entende o que cada coluna
            significa — mesmo que você chame de &ldquo;Órgão&rdquo;, &ldquo;Cliente&rdquo; ou
            &ldquo;Contratante&rdquo;.
          </p>

          <div
            className="glass mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl px-5 py-4 text-left"
            style={{ border: "0.5px solid var(--hairline)" }}
          >
            <MessageSquare size={20} className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
            <p className="leading-relaxed" style={{ fontSize: "14px", color: "var(--text-soft)" }}>
              <strong style={{ color: "var(--text)" }}>E quando tiver dúvida, ela pergunta.</strong>{" "}
              Em vez de importar errado em silêncio, o sistema conversa com você:{" "}
              <em>
                &ldquo;encontrei datas nesta coluna — são prazos de entrega ou vencimentos de
                contrato?&rdquo;
              </em>{" "}
              Você responde uma vez, e ela aplica ao resto.
            </p>
          </div>

          <p className="mt-5" style={{ fontSize: "13px", color: "var(--text-mute)" }}>
            É a mesma tecnologia que já lê atas, contratos e empenhos em PDF e preenche o sistema
            sozinha.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6">
        {/* ---------- REMUNERAÇÃO ---------- */}
        <section className="mt-20">
          <h2
            className="text-center  font-extrabold"
            style={{ fontSize: "27px", color: "var(--text)", letterSpacing: "-0.03em" }}
          >
            E você ainda recebe por isso
          </h2>
          <p
            className="mx-auto mt-2 max-w-2xl text-center"
            style={{ fontSize: "14px", color: "var(--text-soft)" }}
          >
            Cada empresa que você traz e mantém no CP System paga a você{" "}
            <strong style={{ color: "var(--text)" }}>R$ 29,90 por mês</strong> — todo mês, enquanto
            ela continuar cliente. Não é comissão de venda única: é renda que se acumula com a
            carteira.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Faixa clientes="3" valor="89,70" />
            <Faixa clientes="10" valor="299,00" destaque />
            <Faixa clientes="20" valor="598,00" />
            <Faixa clientes="30" valor="897,00" />
          </div>
          <p className="mt-4 text-center" style={{ fontSize: "12px", color: "var(--text-mute)" }}>
            Valores mensais recorrentes, a partir da primeira fatura paga por cada empresa.
          </p>
        </section>

        {/* ---------- COMO COMEÇA ---------- */}
        <section className="mt-20">
          <h2
            className="text-center  font-extrabold"
            style={{ fontSize: "27px", color: "var(--text)", letterSpacing: "-0.03em" }}
          >
            Como começa
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Passo
              n="1"
              titulo="Crie sua conta"
              desc="Cadastro de analista em poucos minutos. 14 dias de teste, cancele quando quiser."
            />
            <Passo
              n="2"
              titulo="Suba sua planilha"
              desc="A IA organiza sua carteira e pergunta o que não ficar claro. Você não digita cliente por cliente."
            />
            <Passo
              n="3"
              titulo="Vincule seus clientes"
              desc="Cada empresa vinculada e ativa passa a render R$ 29,90 por mês para você."
            />
          </div>
        </section>

        {/* ---------- CTA FINAL ---------- */}
        <section className="mt-20">
          <div className="glass mx-auto max-w-2xl rounded-[22px] px-8 py-10 text-center"
            style={{ border: "0.5px solid var(--hairline)" }}>
            <Sparkles size={34} style={{ color: "var(--primary)" }} className="mx-auto" />
            <h2
              className="mt-4 font-extrabold"
              style={{ color: "var(--text)", letterSpacing: "-0.03em", fontSize: "clamp(21px, 3.4vw, 27px)" }}
            >
              Comece pelo cliente mais bagunçado
            </h2>
            <p
              className="mx-auto mt-3 max-w-lg  leading-relaxed"
              style={{ fontSize: "14px", color: "var(--text-soft)" }}
            >
              Escolhe aquele que mais te dá trabalho, coloca no sistema e vê a diferença em 14 dias.
              Se não fizer sentido, é só cancelar.
            </p>
            <Link
              href="/signup?tipo=ANALISTA"
              className="btn-primary mt-7 inline-flex items-center gap-2"
            >
              Criar minha conta de analista
              <ArrowRight size={16} />
            </Link>
            <p className="mt-4" style={{ fontSize: "12px", color: "var(--text-mute)" }}>
              Já tem conta?{" "}
              <Link href="/entrar" className="font-bold" style={{ color: "var(--primary-deep)" }}>
                Entrar
              </Link>
            </p>
          </div>
        </section>

        <footer className="mt-16 pb-10 text-center" style={{ fontSize: "11px", color: "var(--text-mute)" }}>
          CP System · Contratos Publicos System LTDA · CNPJ 67.266.466/0001-04
        </footer>
      </div>
    </div>
  );
}

function Recurso({
  icone: Icone,
  titulo,
  desc,
}: {
  icone: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  titulo: string;
  desc: string;
}) {
  return (
    <div className="glass rounded-[20px] p-6" style={{ border: "0.5px solid var(--hairline)" }}>
      <div
        className="mb-3 grid h-11 w-11 place-items-center rounded-xl"
        style={{ background: "rgba(212,175,55,0.12)" }}
      >
        <Icone size={20} style={{ color: "var(--primary-deep)" }} />
      </div>
      <h3 className="font-extrabold" style={{ fontSize: "15px", color: "var(--text)" }}>
        {titulo}
      </h3>
      <p className="mt-1.5  leading-relaxed" style={{ fontSize: "13.5px", color: "var(--text-soft)" }}>
        {desc}
      </p>
    </div>
  );
}

function Faixa({ clientes, valor, destaque }: { clientes: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className="glass rounded-[20px] p-5 text-center"
      style={
        destaque
          ? { border: "1.5px solid var(--primary)", boxShadow: "0 10px 30px -12px rgba(212,175,55,0.35)" }
          : { border: "0.5px solid var(--hairline)" }
      }
    >
      <p className="eyebrow" style={{ color: "var(--text-mute)" }}>
        {clientes} clientes
      </p>
      <p className="mt-3  uppercase" style={{ fontSize: "11px", letterSpacing: "0.14em", color: "var(--primary-deep)" }}>
        R$
      </p>
      <p
        className="font-extrabold"
        style={{ color: "var(--text)", letterSpacing: "-0.03em", fontSize: "26px", lineHeight: 1 }}
      >
        {valor}
      </p>
      <p className="mt-1  uppercase" style={{ fontSize: "10px", letterSpacing: "0.14em", color: "var(--text-mute)" }}>
        /mês
      </p>
    </div>
  );
}

function Passo({ n, titulo, desc }: { n: string; titulo: string; desc: string }) {
  return (
    <div className="glass rounded-[20px] p-6" style={{ border: "0.5px solid var(--hairline)" }}>
      <span
        className="grid h-8 w-8 place-items-center rounded-full  font-extrabold"
        style={{ fontSize: "13px", background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
          color: "#1A1A1F",
        }}
      >
        {n}
      </span>
      <h3 className="mt-3  font-extrabold" style={{ fontSize: "15px", color: "var(--text)" }}>
        {titulo}
      </h3>
      <p className="mt-1.5  leading-relaxed" style={{ fontSize: "13.5px", color: "var(--text-soft)" }}>
        {desc}
      </p>
    </div>
  );
}
