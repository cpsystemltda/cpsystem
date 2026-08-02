import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Eye,
  EyeOff,
  FolderTree,
} from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NOME_CALENDAR_CPS } from "@/lib/googleCalendar";
import { DesconectarGoogleForm } from "./DesconectarForm";

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; erro?: string }>;
}) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;

  const conta = await prisma.googleAccount.findUnique({
    where: { usuarioId: usuario.id },
    select: { googleEmail: true, criadoEm: true, calendarId: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--text)" }}>
          Integrações
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-soft)" }}>
          Conecte serviços externos pra automatizar o fluxo do CP System.
        </p>
      </header>

      {sp?.conectado === "1" && (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ background: "rgba(63,168,95,0.12)", color: "#2F8F4C", border: "0.5px solid rgba(63,168,95,0.3)" }}
        >
          ✓ Google Calendar conectado. Criamos a agenda &quot;{NOME_CALENDAR_CPS}&quot; no seu Google — só os eventos do CP vão pra lá.
        </div>
      )}

      {sp?.erro && (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ background: "rgba(251,113,133,0.12)", color: "#BE123C", border: "0.5px solid rgba(251,113,133,0.3)" }}
        >
          <AlertTriangle size={14} className="mr-1 inline" />
          Não foi possível conectar: {sp.erro.replace(/_/g, " ")}
        </div>
      )}

      {/* Google Calendar */}
      <section
        className="glass rounded-2xl px-6 py-6"
        style={{ border: "0.5px solid var(--hairline)" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(14,165,233,0.15)", color: "#0EA5E9" }}
          >
            <Calendar size={22} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
              Google Agenda
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
              Vencimentos de contratos, empenhos, prazos de entrega e faturas viram eventos
              na sua Google Agenda automaticamente.
            </p>

            {/* Callout: como funciona a separação de agendas — resposta direta
                ao pedido do Léo (30/07): ele temia que o CP misturasse eventos
                nas outras agendas dele (banda, escritório, família). */}
            {!conta && (
              <div
                className="mt-4 rounded-xl px-4 py-4"
                style={{
                  background: "rgba(14,165,233,0.06)",
                  border: "0.5px solid rgba(14,165,233,0.25)",
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#0369A1" }}>
                  Como a gente separa suas agendas
                </p>
                <ul className="mt-2 space-y-2 text-xs" style={{ color: "var(--text-soft)" }}>
                  <li className="flex gap-2">
                    <FolderTree size={14} className="mt-0.5 shrink-0 text-sky-600" />
                    <span>
                      Ao conectar, criamos uma <strong>agenda separada</strong> chamada
                      <em> &ldquo;{NOME_CALENDAR_CPS}&rdquo;</em> dentro do seu Google. Todos os eventos
                      do CP System vão pra lá — nada é misturado com suas outras agendas (pessoal,
                      trabalho, família).
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <EyeOff size={14} className="mt-0.5 shrink-0 text-sky-600" />
                    <span>
                      Você pode <strong>ocultar essa agenda a qualquer momento</strong> no Google
                      Calendar (basta desmarcar o checkbox dela na barra lateral) — os eventos somem
                      da sua tela sem serem apagados.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Shield size={14} className="mt-0.5 shrink-0 text-sky-600" />
                    <span>
                      Não lemos nem tocamos em nenhuma outra agenda sua. Nossa permissão é
                      restrita ao calendário criado pelo próprio CP System.
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {conta ? (
              <div className="mt-4 space-y-3">
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(63,168,95,0.08)",
                    border: "0.5px solid rgba(63,168,95,0.3)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 size={16} style={{ color: "#2F8F4C" }} />
                      <div>
                        <p className="font-bold" style={{ color: "var(--text)" }}>
                          Conectado como {conta.googleEmail}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                          desde {conta.criadoEm.toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <DesconectarGoogleForm />
                  </div>
                </div>

                {/* Detalhe: qual agenda está sendo usada + como ocultar */}
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(14,165,233,0.06)",
                    border: "0.5px solid rgba(14,165,233,0.25)",
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#0369A1" }}>
                    Agenda dedicada
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
                    Os eventos do CP System vão para a agenda{" "}
                    <strong>&ldquo;{NOME_CALENDAR_CPS}&rdquo;</strong>
                    {conta.calendarId ? "" : " (será criada no primeiro evento)"}.
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-sky-700 hover:underline">
                      <Eye size={12} className="mr-1 inline" />
                      Como ocultar/mostrar essa agenda no Google Calendar
                    </summary>
                    <ol className="mt-2 space-y-1 pl-5 text-xs" style={{ color: "var(--text-soft)" }}>
                      <li>1. Abra{" "}
                        <a
                          href="https://calendar.google.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-700 underline"
                        >
                          calendar.google.com
                        </a>
                      </li>
                      <li>
                        2. Na barra lateral esquerda, procure <em>&ldquo;Outros calendários&rdquo;</em>
                      </li>
                      <li>
                        3. Encontre <strong>&ldquo;{NOME_CALENDAR_CPS}&rdquo;</strong> e
                        marque/desmarque o checkbox ao lado do nome
                      </li>
                    </ol>
                  </details>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <a
                  href="/api/google/connect"
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)",
                    color: "#FFFFFF",
                    border: "0.5px solid rgba(2,132,199,1)",
                  }}
                >
                  <Calendar size={16} />
                  Conectar Google Agenda
                </a>
                <p className="mt-2 text-[11px]" style={{ color: "var(--text-mute)" }}>
                  Ao conectar, criamos uma agenda dedicada e não tocamos em nenhuma outra.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 text-center text-xs" style={{ color: "var(--text-mute)" }}>
        <Link href="/conta/assinatura" className="hover:underline">
          ← Voltar para a conta
        </Link>
      </div>
    </div>
  );
}
