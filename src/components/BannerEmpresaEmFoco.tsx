import { Building2, Layers } from "lucide-react";
import { lerEmpresaSelecionada } from "@/lib/empresaContexto";
import { prisma } from "@/lib/prisma";

/**
 * Banner discreto no topo das páginas operacionais indicando se o usuário está
 * vendo dados de uma empresa específica ou da conta inteira.
 *
 * Renderiza nada (`null`) quando a conta tem apenas 1 empresa — não há decisão a comunicar.
 */
export async function BannerEmpresaEmFoco({ contaId }: { contaId: string }) {
  const totalEmpresas = await prisma.empresa.count({ where: { contaId } });
  if (totalEmpresas <= 1) return null;

  const empresaId = await lerEmpresaSelecionada();
  if (!empresaId) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        <Layers className="h-4 w-4 shrink-0" />
        <span>
          Visão consolidada de <strong>todas as {totalEmpresas} empresas</strong> da conta.
          Para focar em uma específica, use o seletor na barra lateral.
        </span>
      </div>
    );
  }

  const empresa = await prisma.empresa.findFirst({
    where: { id: empresaId, contaId },
    select: { id: true, nomeFantasia: true, razaoSocial: true, cnpj: true },
  });
  if (!empresa) return null;
  const nome = empresa.nomeFantasia || empresa.razaoSocial;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
      <Building2 className="h-4 w-4 shrink-0" />
      <span>
        Filtrando por <strong>{nome}</strong> · CNPJ {empresa.cnpj}.
        Trocar empresa ou voltar à visão consolidada pelo seletor na barra lateral.
      </span>
    </div>
  );
}
