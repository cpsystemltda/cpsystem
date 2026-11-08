import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { podeEditarColaboradores, podeVerDadosColaboradores } from "@/lib/lgpd";
import { buscarColaborador } from "@/lib/colaboradoresServer";
import { adendoAceito } from "@/lib/lgpdServer";
import { ColaboradorDetalhe } from "./ColaboradorDetalhe";

export default async function ColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  const podeVer = podeVerDadosColaboradores(usuario) && adendoAceito(usuario.conta);
  if (!podeVer) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-8">
        <Link href="/colaboradores" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ChevronLeft className="h-4 w-4" /> Colaboradores
        </Link>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>A ficha do colaborador tem dado pessoal (nome, CPF). Ela só abre para Admin, RH do contrato ou quem tem a permissão “Dados de colaboradores” — e com o adendo LGPD aceito.</p>
        </div>
      </div>
    );
  }
  const c = await buscarColaborador(id, usuario.contaId, true, usuario.id);
  if (!c) notFound();
  const hojeIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return <ColaboradorDetalhe c={c} podeEditar={podeEditarColaboradores(usuario)} ehAdmin={usuario.perfil === "ADMIN"} hojeIso={hojeIso} />;
}
