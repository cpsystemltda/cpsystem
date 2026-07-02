import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EmpresaForm } from "./EmpresaForm";
import { WizardIndicator } from "../page";

export default async function OnboardingEmpresaPage() {
  const usuario = await exigirUsuario();
  const empresa = await prisma.empresa.findFirst({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: {
      id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, endereco: true,
      cep: true, email: true, telefones: true, responsavel: true,
    },
  });
  if (!empresa) redirect("/onboarding");

  return (
    <div>
      <WizardIndicator etapa={2} />
      <h1 className="mt-6 text-3xl font-extrabold" style={{ color: "var(--text)" }}>
        Confirme sua empresa
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-soft)" }}>
        Dados que já estão no sistema. Ajuste se necessário e siga.
      </p>

      <div className="mt-6 rounded-2xl px-5 py-4 text-xs" style={{ background: "rgba(212,175,55,0.06)", border: "0.5px solid rgba(212,175,55,0.3)", color: "var(--text)" }}>
        <p><strong>CNPJ:</strong> {empresa.cnpj}</p>
        <p><strong>Endereço:</strong> {empresa.endereco}</p>
        <p><strong>CEP:</strong> {empresa.cep}</p>
      </div>

      <div className="mt-6">
        <EmpresaForm
          razaoSocial={empresa.razaoSocial}
          nomeFantasia={empresa.nomeFantasia ?? ""}
          email={empresa.email}
          telefones={empresa.telefones ?? ""}
          responsavel={empresa.responsavel ?? ""}
        />
      </div>
    </div>
  );
}
