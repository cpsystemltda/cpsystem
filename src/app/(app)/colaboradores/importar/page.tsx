import Link from "next/link";
import { ChevronLeft, Download, Upload } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { podeEditarColaboradores } from "@/lib/lgpd";
import { adendoAceito } from "@/lib/lgpdServer";
import { acessoDaConta } from "@/lib/faixasTerceirizacaoServer";
import { ImportarClient } from "./ImportarClient";

export default async function ImportarColaboradoresPage() {
  const usuario = await exigirUsuario();
  const pode = podeEditarColaboradores(usuario) && adendoAceito(usuario.conta) && (await acessoDaConta(usuario.conta)) === "LIBERADO";
  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <Link href="/colaboradores" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Colaboradores
      </Link>
      <div className="mt-4 flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-violet-50">
          <Upload className="h-6 w-6 text-violet-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Importar colaboradores</h1>
          <p className="mt-1 text-sm text-slate-600">Baixe a planilha-modelo, preencha uma linha por colaborador e envie. CPF inválido, repetido ou já cadastrado é rejeitado e aparece no relatório com o motivo.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href="/api/colaboradores/modelo" className="btn-secondary inline-flex">
          <Download className="h-4 w-4" /> Baixar planilha-modelo (.xlsx)
        </a>
      </div>
      {pode ? (
        <ImportarClient />
      ) : (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">Importar exige o plano Premium (ou o período de teste), a permissão “Dados de colaboradores” e o adendo LGPD aceito pelo administrador.</p>
      )}
    </div>
  );
}
