import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { EnviosClient } from "./EnviosClient";
import { VERSAO_CONTRATO_ANALISTA } from "@/components/legal/ContratoAnalistaParceiro";

// Painel /admin/envios (Regina 13/07) — dispara envios avulsos por WA:
//   - Contrato de analista pro Igor revisar (PDF)
//   - Magic link de migração pro Léo (ou outro TRIAL antigo) concluir cadastro
// So super admin.

export default async function AdminEnviosPage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">Somente super admin.</p>
      </div>
    );
  }

  // Lista contas TRIAL EMPRESA sem subscription — candidatos naturais a receber
  // magic link de migração (Léo se enquadra).
  const trialsSemSubscription = await prisma.conta.findMany({
    where: {
      tipo: "EMPRESA",
      statusAssinatura: "TRIAL",
      gatewaySubscriptionId: null,
      usuarios: { none: { superAdmin: true } },
    },
    select: {
      id: true,
      trialAteEm: true,
      empresas: { select: { razaoSocial: true, cnpj: true }, take: 1 },
      usuarios: {
        select: { id: true, nome: true, email: true, telefoneWhatsApp: true },
        where: { perfil: "ADMIN" },
        take: 1,
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <PageHeader
        eyebrow="Admin · Envios"
        titulo="Disparos"
        destaque="por WhatsApp"
        subtitulo="Contrato de analista pra revisão do Igor + link de migração pro Léo (e outros trials antigos)."
      />
      <EnviosClient
        versaoContratoAnalista={VERSAO_CONTRATO_ANALISTA}
        candidatosMigracao={trialsSemSubscription.map((c) => ({
          contaId: c.id,
          trialAteEm: c.trialAteEm ? c.trialAteEm.toISOString() : null,
          razaoSocial: c.empresas[0]?.razaoSocial ?? "(sem empresa)",
          cnpj: c.empresas[0]?.cnpj ?? "",
          usuario: c.usuarios[0]
            ? {
                id: c.usuarios[0].id,
                nome: c.usuarios[0].nome,
                email: c.usuarios[0].email,
                telefone: c.usuarios[0].telefoneWhatsApp ?? "",
              }
            : null,
        }))}
      />
    </div>
  );
}
