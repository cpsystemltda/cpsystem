import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TwoFactorConfig } from "./_components/TwoFactorConfig";

export const dynamic = "force-dynamic";

export default async function SegurancaPage() {
  const usuario = await exigirUsuario();

  const u = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { totpAtivadoEm: true, email: true },
  });

  const recoveryCodesRestantes = await prisma.recoveryCode2FA.count({
    where: { usuarioId: usuario.id, usadoEm: null },
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Segurança</h1>
        <p className="mt-1 text-sm text-slate-600">
          Camadas extras pra proteger sua conta contra acessos indevidos.
        </p>
      </header>

      <TwoFactorConfig
        ativo={!!u?.totpAtivadoEm}
        ativadoEm={u?.totpAtivadoEm ?? null}
        emailConta={u?.email ?? ""}
        recoveryCodesRestantes={recoveryCodesRestantes}
      />

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Outras proteções ativas</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>✓ Rate limit no login (bloqueia após 5 tentativas falhas em 15 min)</li>
          <li>✓ Alerta WhatsApp em login de dispositivo novo</li>
          <li>✓ Senhas guardadas com bcrypt (padrão OWASP)</li>
          <li>✓ Validação de senha forte + bloqueio de senhas vazadas (HIBP)</li>
          <li>✓ Sessão criptografada em cookie HttpOnly + Secure</li>
          <li>✓ HTTPS forçado, tráfego criptografado</li>
        </ul>
      </section>
    </div>
  );
}
