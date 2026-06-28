import Link from "next/link";
import { Calendar, CheckCircle2, AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    select: { googleEmail: true, criadoEm: true },
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
          ✓ Google Calendar conectado. Novas execuções vão sincronizar automaticamente.
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
              Quando você cadastra uma execução com data e horário, ela aparece automaticamente
              na sua Google Agenda. Edições e exclusões sincronizam de mão dupla.
            </p>

            {conta ? (
              <div className="mt-4 rounded-xl px-4 py-3" style={{ background: "rgba(63,168,95,0.08)", border: "0.5px solid rgba(63,168,95,0.3)" }}>
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
                  Permissão solicitada: criar/editar eventos na sua agenda. Não acessamos contatos
                  nem outros calendários.
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
