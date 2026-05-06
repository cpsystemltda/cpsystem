import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resetarCadastrosTeste } from "./actions";
import { BotaoReset } from "./BotaoReset";

export const dynamic = "force-dynamic";

export default async function ResetCadastrosPage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) redirect("/dashboard");

  // Snapshot do que existe e do que vai sumir
  const [contasTotal, usuariosTotal, empresas, atas, contratos, empenhos, analistas, cobrancas, vinculos] =
    await Promise.all([
      prisma.conta.count(),
      prisma.usuario.count(),
      prisma.empresa.count(),
      prisma.ata.count(),
      prisma.contrato.count(),
      prisma.empenho.count(),
      prisma.analista.count(),
      prisma.cobranca.count(),
      prisma.vinculoAnalista.count(),
    ]);

  const superAdmins = await prisma.usuario.findMany({
    where: { superAdmin: true },
    select: { id: true, nome: true, email: true, contaId: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Resetar cadastros de teste</h1>
        <p className="mt-2 text-sm text-slate-600">
          Apaga todas as contas, usuários, empresas, atas, contratos, empenhos, vínculos, comissões,
          cobranças, notificações e auditoria — <strong>exceto as contas dos super admins</strong>. Use
          quando quiser limpar dados de teste sem reseed.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <Stat label="Contas" valor={contasTotal} />
        <Stat label="Usuários" valor={usuariosTotal} />
        <Stat label="Empresas" valor={empresas} />
        <Stat label="Atas" valor={atas} />
        <Stat label="Contratos" valor={contratos} />
        <Stat label="Empenhos" valor={empenhos} />
        <Stat label="Analistas" valor={analistas} />
        <Stat label="Cobranças" valor={cobrancas} />
        <Stat label="Vínculos analista" valor={vinculos} />
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-sm font-semibold text-emerald-900">
          Super admins que serão preservados ({superAdmins.length})
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-emerald-800">
          {superAdmins.map((u) => (
            <li key={u.id}>
              ✓ <strong>{u.nome}</strong> ({u.email})
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-semibold text-amber-900">⚠ Atenção</h2>
        <p className="mt-2 text-sm text-amber-800">
          Essa ação <strong>não pode ser desfeita</strong>. Todos os cadastros que NÃO são super admins
          serão apagados, incluindo o cadastro de teste do Igor (analista + empresa criados pelo signup).
          As contas dos super admins serão mantidas mas terão suas sessões invalidadas (relogin necessário).
        </p>
      </div>

      <BotaoReset acao={resetarCadastrosTeste} />
    </div>
  );
}

function Stat({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p>
    </div>
  );
}
