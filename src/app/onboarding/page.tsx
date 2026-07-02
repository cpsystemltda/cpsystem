import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DadosPessoaisForm } from "./DadosPessoaisForm";

export default async function OnboardingDadosPage() {
  const usuario = await exigirUsuario();
  const dados = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: {
      nome: true, cpf: true, cargo: true, telefoneWhatsApp: true, dataNascimento: true,
    },
  });

  return (
    <div>
      <WizardIndicator etapa={1} />
      <h1 className="mt-6 text-3xl font-extrabold" style={{ color: "var(--text)" }}>
        Bem-vindo ao CP System 👋
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
        Antes de acessar o sistema, complete seus dados pessoais. Leva 2 minutos.
      </p>

      <div className="mt-8">
        <DadosPessoaisForm
          nome={dados?.nome ?? ""}
          cpf={dados?.cpf ?? ""}
          cargo={dados?.cargo ?? ""}
          telefone={dados?.telefoneWhatsApp ?? ""}
          dataNascimento={dados?.dataNascimento?.toISOString().slice(0, 10) ?? ""}
        />
      </div>
    </div>
  );
}

export function WizardIndicator({ etapa }: { etapa: 1 | 2 | 3 }) {
  const passos = [
    { n: 1, label: "Seus dados" },
    { n: 2, label: "Sua empresa" },
    { n: 3, label: "Pagamento" },
  ];
  return (
    <ol className="flex items-center gap-3">
      {passos.map((p) => {
        const ativo = etapa === p.n;
        const concluido = etapa > p.n;
        return (
          <li key={p.n} className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-extrabold"
              style={{
                background: concluido
                  ? "rgba(63,168,95,0.9)"
                  : ativo
                    ? "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)"
                    : "rgba(15,14,12,0.06)",
                color: concluido || ativo ? "#0A0A0A" : "var(--text-mute)",
                border: concluido || ativo ? "0.5px solid rgba(168,137,71,0.5)" : "0.5px solid var(--hairline)",
              }}
            >
              {concluido ? "✓" : p.n}
            </span>
            <span className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.14em", color: ativo ? "var(--text)" : "var(--text-mute)" }}>
              {p.label}
            </span>
            {p.n < 3 && <span className="mx-1" style={{ color: "var(--text-mute)" }}>›</span>}
          </li>
        );
      })}
    </ol>
  );
}
