import { Bell, MessageCircle } from "lucide-react";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PreferenciasWhatsAppForm } from "./PreferenciasWhatsAppForm";
import { TesteWhatsAppPanel } from "./TesteWhatsAppPanel";

export default async function NotificacoesPage() {
  const usuario = await exigirUsuario();

  const dados = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { telefoneWhatsApp: true, optInWhatsApp: true },
  });

  const ultimasNotificacoes = await prisma.notificacaoWhatsApp.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 10,
    select: {
      id: true,
      tipo: true,
      mensagem: true,
      status: true,
      enviadaEm: true,
      criadoEm: true,
      erro: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--text)" }}>
          Notificações
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-soft)" }}>
          Escolha como quer receber avisos importantes do CP System.
        </p>
      </header>

      {/* WhatsApp */}
      <section
        className="glass rounded-2xl px-6 py-6"
        style={{ border: "0.5px solid var(--hairline)" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(63,168,95,0.15)", color: "#2F8F4C" }}
          >
            <MessageCircle size={22} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
              WhatsApp
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
              Receba alertas de <strong>vencimento de empenho</strong>, <strong>entregas do dia</strong>,{" "}
              <strong>vencimento do plano</strong> e um <strong>relatório semanal</strong> da sua
              conta direto no WhatsApp.
            </p>

            <PreferenciasWhatsAppForm
              telefone={dados?.telefoneWhatsApp || ""}
              optIn={!!dados?.optInWhatsApp}
            />
          </div>
        </div>
      </section>

      {/* Historico */}
      {ultimasNotificacoes.length > 0 && (
        <section className="mt-6">
          <h3
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
          >
            Últimas notificações enviadas
          </h3>
          <div className="mt-2 space-y-1.5">
            {ultimasNotificacoes.map((n) => (
              <div
                key={n.id}
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  border: "0.5px solid var(--hairline)",
                  background: n.status === "FALHOU" ? "rgba(251,113,133,0.05)" : "rgba(63,168,95,0.05)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-bold"
                    style={{
                      color: n.status === "FALHOU" ? "#BE123C" : "#2F8F4C",
                    }}
                  >
                    {n.tipo.replaceAll("_", " ")}
                  </span>
                  <span style={{ color: "var(--text-mute)" }}>
                    {(n.enviadaEm ?? n.criadoEm).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 truncate" style={{ color: "var(--text-soft)" }}>
                  {n.mensagem}
                </p>
                {n.erro && (
                  <p className="mt-0.5 text-[10px]" style={{ color: "#BE123C" }}>
                    Erro: {n.erro}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Painel de teste — SO super admin */}
      {usuario.superAdmin && (
        <TesteWhatsAppPanel />
      )}

      <div className="mt-6 text-center text-xs" style={{ color: "var(--text-mute)" }}>
        <Link href="/conta/assinatura" className="hover:underline">
          ← Voltar para a conta
        </Link>
      </div>
    </div>
  );
}
