import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getUsuarioAtual } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { AdendoLgpd } from "@/components/legal/AdendoLgpd";
import { AceiteAdendoLgpd } from "@/components/AceiteAdendoLgpd";
import { adendoAceito, ultimoAceiteAdendo } from "@/lib/lgpdServer";
import { formatarCnpj } from "@/lib/cnpj";
import { prisma } from "@/lib/prisma";

/**
 * Adendo de tratamento de dados pessoais (ESP-007 RN08) — leitura pública;
 * logado, mostra o aceite da conta (ou o botão para o ADMIN aceitar).
 */
export default async function AdendoLgpdPage() {
  const usuario = await getUsuarioAtual();
  const empresa = usuario ? await prisma.empresa.findFirst({ where: { contaId: usuario.contaId }, orderBy: { criadoEm: "asc" }, select: { razaoSocial: true, cnpj: true } }) : null;
  const aceito = usuario ? adendoAceito(usuario.conta) : false;
  const aceite = usuario && aceito ? await ultimoAceiteAdendo(usuario.contaId) : null;
  const quem = aceite?.usuarioId ? await prisma.usuario.findUnique({ where: { id: aceite.usuarioId }, select: { nome: true, email: true } }) : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <Link href={usuario ? "/conta/privacidade" : "/termos"} className="text-sm text-slate-600 hover:underline">
          {usuario ? "Privacidade e LGPD" : "Termos de uso"}
        </Link>
      </div>
      <div className="mt-6 flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-violet-50">
          <ShieldCheck className="h-6 w-6 text-violet-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Adendo de tratamento de dados pessoais</h1>
          <p className="text-sm text-slate-600">Módulo Terceirização · CP System como operadora, sua empresa como controladora.</p>
        </div>
      </div>

      {usuario && (
        <div className="mt-6">
          {aceito ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Aceito pela sua empresa em {aceite?.aceitoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              {quem ? ` por ${quem.nome ?? quem.email}` : ""}
              {aceite?.ip ? ` (IP ${aceite.ip})` : ""}.
            </p>
          ) : (
            <AceiteAdendoLgpd ehAdmin={usuario.perfil === "ADMIN"} />
          )}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8">
        <AdendoLgpd contratante={empresa ? { razaoSocial: empresa.razaoSocial, cnpj: formatarCnpj(empresa.cnpj) } : null} />
      </div>
    </div>
  );
}
