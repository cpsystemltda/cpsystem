import Link from "next/link";
import { FileText, ClipboardList, Receipt, ArrowRight } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NovaContratacaoPage() {
  const usuario = await exigirUsuario();
  const empresas = await prisma.empresa.count({ where: { contaId: usuario.contaId } });

  if (empresas === 0) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Cadastre uma empresa primeiro</h1>
        <p className="mt-2 text-sm text-slate-600">
          Para registrar contratações você precisa ter pelo menos uma empresa cadastrada.
        </p>
        <Link
          href="/empresas/nova"
          className="mt-6 inline-block rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white"
        >
          Cadastrar empresa
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <h1 className="text-3xl font-bold text-slate-900">Nova contratação</h1>
      <p className="mt-2 text-sm text-slate-600">
        Selecione o tipo de instrumento que você quer cadastrar.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card
          href="/contratacoes/nova/ata"
          icone={FileText}
          titulo="Ata de Registro de Preços"
          texto="SRP — registra preços e itens; depois pode gerar contratos e empenhos com abatimento automático de saldo."
          cor="blue"
        />
        <Card
          href="/contratacoes/nova/contrato"
          icone={ClipboardList}
          titulo="Contrato administrativo"
          texto="Contrato direto (não-SRP) ou derivado de uma Ata existente. Registra obrigações, prazos e itens."
          cor="emerald"
        />
        <Card
          href="/contratacoes/nova/empenho"
          icone={Receipt}
          titulo="Nota de Empenho"
          texto="Reserva orçamentária. Pode ser autônoma, derivada de Ata (SRP) ou de Contrato existente."
          cor="amber"
        />
      </div>
    </div>
  );
}

function Card({
  href,
  icone: Icone,
  titulo,
  texto,
  cor,
}: {
  href: string;
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
  cor: "blue" | "emerald" | "amber";
}) {
  const cores = {
    blue: { bg: "bg-blue-50", icon: "text-blue-700" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-700" },
    amber: { bg: "bg-amber-50", icon: "text-amber-700" },
  }[cor];

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-slate-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-md"
    >
      <div className={`grid h-10 w-10 place-items-center rounded-lg ${cores.bg}`}>
        <Icone className={`h-5 w-5 ${cores.icon}`} />
      </div>
      <h3 className="mt-4 font-semibold text-slate-900">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{texto}</p>
      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-blue-600">
        Cadastrar <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
