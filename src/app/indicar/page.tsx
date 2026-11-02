import type { Metadata } from "next";
import Link from "next/link";
import {
  Gift, ArrowRight, Ticket, Share2, Coins, Briefcase, Calculator, Scale, Handshake, Building2, UserCheck,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { BotaoWhatsAppSite } from "@/components/BotaoWhatsAppSite";
import { SimuladorGanhos } from "./SimuladorGanhos";
import { FormIndicador } from "./FormIndicador";

export const metadata: Metadata = {
  title: "Indique o CP System e ganhe R$ 29,90 por mês por empresa",
  description:
    "Programa de Indicação CP System: você não precisa ser analista. Cadastre-se, receba seu cupom e ganhe R$ 29,90 por mês por cada empresa indicada que assinar, enquanto ela for cliente.",
};

/**
 * Página pública do Programa de Indicação (Regina 02/11/2026).
 *
 * Para quem NÃO é analista de licitação, mas conhece empresas que vendem ao
 * governo. A pessoa cadastra o nome, recebe o cupom e compartilha. A regra de
 * dinheiro é a mesma do analista parceiro: R$ 29,90 por mês por empresa
 * indicada que paga, enquanto pagar.
 */
export default function IndicarPage() {
  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#FAF6EC] via-white to-[#FFF8E1]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-[#D4AF37]/10 blur-3xl" />
          <div className="absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-[#9C7A2D]/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-10">
          <div className="mb-10 flex items-center justify-between">
            <Logo variant="md" />
            <div className="flex items-center gap-4 text-xs font-semibold text-[#9C7A2D]">
              <Link href="/login" className="hover:text-[#7a5c1a]">Já tenho cupom</Link>
              <Link href="/" className="hover:text-[#7a5c1a]">← Site</Link>
            </div>
          </div>

          {/* Hero */}
          <header className="mx-auto max-w-3xl text-center">
            <div
              className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl"
              style={{ background: "linear-gradient(135deg, #D4AF37, #9C7A2D)", boxShadow: "0 12px 36px rgba(212,175,55,0.4)" }}
            >
              <Gift className="h-8 w-8 text-white" />
            </div>
            <p className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.24em", color: "#9C7A2D" }}>
              Programa de Indicação · CP System
            </p>
            <h1 className="mt-4 text-[42px] font-extrabold leading-[1.05] text-[#2D3340]" style={{ letterSpacing: "-0.04em" }}>
              Conhece quem vende para o governo?
              <br />
              <span style={{ background: "linear-gradient(135deg, #B8860B, #D4AF37)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Indique e ganhe R$ 29,90 por mês.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-[#3D434C]">
              Você não precisa ser analista de licitação nem entender de Lei 14.133. Cadastre o seu nome, receba um{" "}
              <strong>cupom pessoal</strong> e compartilhe. Cada empresa que assinar com o seu cupom rende{" "}
              <strong>R$ 29,90 todo mês</strong>, enquanto ela for cliente. Sem teto, sem meta, sem custo.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#cadastro"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#B8860B] to-[#D4AF37] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
              >
                Quero meu cupom <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#como-funciona" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-[#2D3340] hover:bg-slate-50">
                Como funciona
              </a>
            </div>
          </header>

          {/* Como funciona */}
          <section id="como-funciona" className="mt-20 grid gap-5 md:grid-cols-3">
            <Passo n="1" icon={Ticket} titulo="Cadastre-se e receba o cupom" desc="Leva dois minutos. Você sai com um código pessoal, tipo MARIA-7K2P, e um link pronto para compartilhar." />
            <Passo n="2" icon={Share2} titulo="Compartilhe com quem precisa" desc="Mande o código ou o link para a empresa. Ela se cadastra no CP System informando o seu cupom e ganha 14 dias de teste, sem cartão." />
            <Passo n="3" icon={Coins} titulo="Receba todo dia 20" desc="A partir da primeira fatura paga pela empresa, R$ 29,90 caem na sua chave PIX todo mês. Enquanto ela continuar cliente." />
          </section>

          {/* Simulador */}
          <section className="mt-20">
            <Titulo eyebrow="Faça a conta" titulo="Dez empresas são R$ 3.588 por ano. Sem fazer nada depois." />
            <div className="mx-auto mt-8 max-w-3xl">
              <SimuladorGanhos />
            </div>
          </section>

          {/* Para quem é */}
          <section className="mt-20">
            <Titulo eyebrow="Para quem é" titulo="Quem já está perto de quem vende para o governo" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Persona icon={Calculator} titulo="Contador" desc="Você sabe quais clientes faturam contra prefeitura, estado ou União. Eles perdem prazo todo ano." />
              <Persona icon={Scale} titulo="Advogado ou consultor de licitação" desc="Você ganha a licitação com o cliente. O CP System cuida do que vem depois, que é onde o dinheiro vaza." />
              <Persona icon={Briefcase} titulo="Representante comercial" desc="Sua carteira é de fornecedores. Cada um com ata ou contrato público é uma indicação." />
              <Persona icon={Building2} titulo="Cliente do CP System" desc="Você já usa. Conhece outros fornecedores do mesmo órgão. Indique e a sua experiência vira renda." />
              <Persona icon={UserCheck} titulo="Servidor ou ex-servidor" desc="Quem passou por compras públicas conhece fornecedores que vivem de empenho e nota." />
              <Persona icon={Handshake} titulo="Qualquer pessoa com rede" desc="Associação comercial, sindicato, grupo de WhatsApp de fornecedores. Onde há quem vende para o governo, há indicação." />
            </div>
          </section>

          {/* O que você vai indicar */}
          <section className="mt-20 rounded-[28px] border border-[#E8D9A8] bg-white/70 p-8 backdrop-blur">
            <Titulo eyebrow="O que você vai indicar" titulo="Um sistema que evita os cinco jeitos de perder dinheiro depois da licitação" />
            <ol className="mx-auto mt-6 max-w-3xl space-y-2.5 text-[14.5px] text-[#2D3340]">
              <li><strong>1. O prazo de prorrogação passa</strong> e a empresa precisa disputar tudo de novo, do zero.</li>
              <li><strong>2. A entrega atrasa</strong> e vira multa de até 10% do contrato.</li>
              <li><strong>3. A entrega é feita e a nota não sai.</strong> Dinheiro entregue que não pode ser cobrado.</li>
              <li><strong>4. A nota sai e ninguém encaminha ao órgão.</strong> O prazo de pagamento nem começou a contar.</li>
              <li><strong>5. Sobra saldo na ata.</strong> Receita disponível que ninguém executou.</li>
            </ol>
            <p className="mx-auto mt-5 max-w-3xl text-[14px] text-[#5D6470]">
              O CP System acompanha atas, contratos e empenhos e <strong>avisa no WhatsApp antes de virar problema</strong>. A empresa não precisa lembrar de nada nem abrir o sistema para ser protegida. É isso que você indica.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-20">
            <Titulo eyebrow="Perguntas diretas" titulo="O que todo mundo pergunta antes de se cadastrar" />
            <div className="mx-auto mt-8 grid max-w-4xl gap-3 md:grid-cols-2">
              <Faq p="Preciso ser analista de licitação?" r="Não. O programa é para quem conhece empresas que vendem ao governo. Quem é analista também pode indicar, pelo mesmo cupom." />
              <Faq p="Quanto eu ganho?" r="R$ 29,90 por mês por cada empresa indicada com assinatura ativa. Cinco empresas são R$ 149,50 por mês; vinte são R$ 598,00. Vitalício enquanto a empresa pagar." />
              <Faq p="Quando o dinheiro entra?" r="A comissão nasce na primeira fatura paga pela empresa e é paga por PIX no dia 20 do mês seguinte, na chave que você cadastrar." />
              <Faq p="A empresa que uso meu cupom ganha o quê?" r="O teste gratuito de 14 dias, sem cartão, e a certeza de que a indicação é sua. O cupom identifica você no cadastro dela." />
              <Faq p="Tem custo ou meta?" r="Nenhum custo e nenhuma meta. Você se cadastra de graça e indica quantas empresas quiser." />
              <Faq p="E se a empresa cancelar?" r="A comissão daquela empresa para no mês em que ela deixa de pagar. As outras continuam." />
              <Faq p="Como acompanho minhas indicações?" r="No seu painel: quantas empresas se cadastraram com o cupom, quantas estão em teste, quantas assinaram, quanto entra por mês e o histórico de pagamentos." />
              <Faq p="Posso indicar um cliente que já conhece o CP System?" r="Pode, desde que a empresa ainda não tenha conta. O cupom é informado no momento do cadastro dela." />
            </div>
          </section>

          {/* Cadastro */}
          <section id="cadastro" className="mt-20 rounded-[28px] border border-[#E8D9A8] bg-white p-8 shadow-sm">
            <Titulo eyebrow="Cadastro" titulo="Crie o seu cupom agora" />
            <p className="mx-auto mt-3 max-w-2xl text-center text-[14px] text-[#5D6470]">
              Gratuito. Pedimos só o que o programa precisa: quem você é, por onde falamos e em qual chave PIX a comissão entra.
            </p>
            <div className="mx-auto mt-8 max-w-3xl">
              <FormIndicador />
            </div>
            <p className="mt-6 text-center text-[12.5px] text-[#5D6470]">
              É analista de licitação e quer o programa completo, com carteira de clientes?{" "}
              <Link href="/seja-embaixador" className="font-semibold text-[#9C7A2D] underline">Conheça o Analista Parceiro</Link>.
            </p>
          </section>

          <footer className="mt-16 text-center text-[12px] text-[#8A8F99]">
            CP System · Contratos Públicos System Ltda · contato@cpsystem.app.br ·{" "}
            <Link href="/termos?tipo=analista" className="underline">Contrato do programa</Link>
          </footer>
        </div>
      </div>
      <BotaoWhatsAppSite />
    </>
  );
}

function Titulo({ eyebrow, titulo }: { eyebrow: string; titulo: string }) {
  return (
    <>
      <p className="text-center text-[11px] font-bold uppercase" style={{ letterSpacing: "0.22em", color: "#9C7A2D" }}>{eyebrow}</p>
      <h2 className="mx-auto mt-3 max-w-3xl text-center text-[30px] font-extrabold leading-tight text-[#2D3340]" style={{ letterSpacing: "-0.03em" }}>{titulo}</h2>
    </>
  );
}

function Passo({ n, icon: Icon, titulo, desc }: { n: string; icon: React.ComponentType<{ className?: string }>; titulo: string; desc: string }) {
  return (
    <div className="rounded-[22px] border border-[#E8D9A8] bg-white/80 p-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#B8860B] to-[#D4AF37] text-sm font-extrabold text-white">{n}</span>
        <Icon className="h-5 w-5 text-[#9C7A2D]" />
      </div>
      <h3 className="mt-4 text-[16px] font-bold text-[#2D3340]">{titulo}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5D6470]">{desc}</p>
    </div>
  );
}

function Persona({ icon: Icon, titulo, desc }: { icon: React.ComponentType<{ className?: string }>; titulo: string; desc: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-5">
      <Icon className="h-5 w-5 text-[#9C7A2D]" />
      <h3 className="mt-3 text-[15px] font-bold text-[#2D3340]">{titulo}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-[#5D6470]">{desc}</p>
    </div>
  );
}

function Faq({ p, r }: { p: string; r: string }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-5">
      <p className="text-[14px] font-bold text-[#2D3340]">{p}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5D6470]">{r}</p>
    </div>
  );
}
