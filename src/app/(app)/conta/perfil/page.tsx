import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { PerfilForm } from "./PerfilForm";

// Regina 14/07: usuario edita proprios dados pessoais.
// EMPRESA: dados de Usuario + Empresa principal.
// ANALISTA: dados de Usuario + Analista (PIX, banco, endereco, etc).
// Sempre com confirmacao da senha atual.
export default async function PerfilPage() {
  const usuario = await exigirUsuario();

  const [usuarioFull, empresa, analista] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { nome: true, email: true, telefoneWhatsApp: true, cpf: true, cargo: true, dataNascimento: true },
    }),
    usuario.conta.tipo === "EMPRESA"
      ? prisma.empresa.findFirst({
          where: { contaId: usuario.contaId },
          orderBy: { criadoEm: "asc" },
          select: { razaoSocial: true, cnpj: true, endereco: true, cep: true, telefones: true, email: true },
        })
      : Promise.resolve(null),
    usuario.conta.tipo === "ANALISTA"
      ? prisma.analista.findUnique({
          where: { contaId: usuario.contaId },
          select: {
            nomeCompleto: true, telefone: true, endereco: true, cep: true, complemento: true,
            pix: true, banco: true, agencia: true, contaCorrente: true,
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Perfil"
        titulo="Editar meus"
        destaque="dados"
        subtitulo="Atualize seus dados de contato, pessoais e (se analista) dados de pagamento. Todas as alterações exigem confirmação da sua senha atual."
      />
      <div className="mt-6">
        <PerfilForm
          tipo={usuario.conta.tipo as "EMPRESA" | "ANALISTA"}
          usuario={{
            nome: usuarioFull?.nome ?? "",
            email: usuarioFull?.email ?? "",
            telefoneWhatsApp: usuarioFull?.telefoneWhatsApp ?? "",
            cpf: usuarioFull?.cpf ?? "",
            cargo: usuarioFull?.cargo ?? "",
            dataNascimento: usuarioFull?.dataNascimento ? usuarioFull.dataNascimento.toISOString().slice(0, 10) : "",
          }}
          empresa={empresa ? {
            razaoSocial: empresa.razaoSocial,
            cnpj: empresa.cnpj,
            endereco: empresa.endereco,
            cep: empresa.cep ?? "",
            telefones: empresa.telefones,
            email: empresa.email,
          } : undefined}
          analista={analista ? {
            nomeCompleto: analista.nomeCompleto,
            telefone: analista.telefone,
            endereco: analista.endereco,
            cep: analista.cep ?? "",
            complemento: analista.complemento ?? "",
            pix: analista.pix ?? "",
            banco: analista.banco ?? "",
            agencia: analista.agencia ?? "",
            contaCorrente: analista.contaCorrente ?? "",
          } : undefined}
        />
      </div>
    </div>
  );
}
