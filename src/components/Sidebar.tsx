"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  ClipboardList,
  Truck,
  TrendingUp,
  BarChart3,
  Scale,
  Settings,
  LogOut,
  Building2,
  Sparkles,
  Wallet,
  Users,
  ShieldCheck,
  ScrollText,
  CreditCard,
  UserCheck,
  Bell,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { SeletorVisao } from "@/components/SeletorVisao";
import { SeletorEmpresa, type EmpresaOpcao } from "@/components/SeletorEmpresa";
import { HelpButtons } from "@/components/HelpButtons";
import type { Visao } from "@/lib/visao";
import { Crown, Users2, Activity, Workflow } from "lucide-react";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Grupo = { titulo: string; itens: Item[] };

// Itens operacionais — só fazem sentido com uma empresa em foco. No modo "Todas as
// empresas" (consolidado) só aparecem o Dashboard e os menus de configuração da conta.
const GRUPOS_EMPRESA_OPERACAO: Grupo[] = [
  {
    titulo: "Operação",
    itens: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/operacao", label: "Operação", icon: Workflow },
      { href: "/contratacoes/nova", label: "Cadastrar", icon: PlusCircle },
      { href: "/atas", label: "Atas (SRP)", icon: FileText },
      { href: "/contratos", label: "Contratos", icon: ClipboardList },
      { href: "/execucao", label: "Execução", icon: Truck },
      { href: "/reajustes", label: "Reajustes", icon: TrendingUp },
    ],
  },
  {
    titulo: "Insights",
    itens: [
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { href: "/juridico", label: "Jurídico", icon: Scale },
    ],
  },
];

// Versão "consolidada" — sem operação por empresa. Cliente só vê Dashboard agregado
// e o menu pra adicionar empresas (CNPJs).
const GRUPOS_EMPRESA_CONSOLIDADO: Grupo[] = [
  {
    titulo: "Visão geral",
    itens: [
      { href: "/dashboard", label: "Dashboard consolidado", icon: LayoutDashboard },
      { href: "/empresas", label: "Empresas (CNPJs)", icon: Building2 },
    ],
  },
];

const GRUPOS_EMPRESA_CONTA: Grupo[] = [
  {
    titulo: "Conta",
    itens: [
      { href: "/notificacoes", label: "Notificações", icon: Bell },
      { href: "/conta/assinatura", label: "Assinatura", icon: CreditCard },
      { href: "/empresas", label: "Empresas (CNPJs)", icon: Building2 },
      { href: "/vinculos", label: "Analista vinculado", icon: UserCheck },
      { href: "/equipe", label: "Equipe", icon: Users },
      { href: "/embaixadores", label: "Embaixadores", icon: Sparkles },
      { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
      { href: "/termos", label: "Termos / LGPD", icon: ScrollText },
    ],
  },
  {
    titulo: "Admin",
    itens: [
      { href: "/admin", label: "Painel do PO", icon: Settings },
      { href: "/admin/gateway", label: "Gateway de pagamento", icon: CreditCard },
    ],
  },
];

const GRUPOS_ANALISTA: Grupo[] = [
  {
    titulo: "Painel",
    itens: [
      { href: "/painel-analista", label: "Empresas e comissões", icon: Wallet },
      { href: "/honorarios", label: "Comissões SaaS", icon: Sparkles },
      { href: "/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    titulo: "Conta",
    itens: [
      { href: "/equipe", label: "Equipe", icon: Users },
      { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
      { href: "/termos", label: "Termos / LGPD", icon: ScrollText },
    ],
  },
];

const GRUPOS_ADMIN_PLATAFORMA: Grupo[] = [
  {
    titulo: "Plataforma",
    itens: [
      { href: "/admin-plataforma", label: "Visão geral", icon: Crown },
      { href: "/admin-plataforma/clientes", label: "Clientes", icon: Users2 },
      { href: "/admin-plataforma/financeiro", label: "Financeiro · MRR", icon: Wallet },
      { href: "/admin-plataforma/atividade", label: "Atividade", icon: Activity },
    ],
  },
  {
    titulo: "Operação interna",
    itens: [
      { href: "/admin", label: "Painel do PO", icon: Settings },
      { href: "/admin/gateway", label: "Gateway de pagamento", icon: CreditCard },
      { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
      { href: "/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
];

export function Sidebar({
  nomeUsuario,
  nomeConta,
  tipoConta,
  visao,
  superAdmin = false,
  qtdNotificacoesNaoLidas = 0,
  empresas = [],
  empresaIdSelecionada = null,
}: {
  nomeUsuario: string;
  nomeConta: string;
  tipoConta: "EMPRESA" | "ANALISTA";
  visao: Visao;
  superAdmin?: boolean;
  qtdNotificacoesNaoLidas?: number;
  empresas?: EmpresaOpcao[];
  empresaIdSelecionada?: string | null;
}) {
  const pathname = usePathname();
  const grupos =
    visao === "ADMIN_PLATAFORMA"
      ? GRUPOS_ADMIN_PLATAFORMA
      : visao === "ANALISTA"
        ? GRUPOS_ANALISTA
        : !empresaIdSelecionada
          ? // Nenhuma empresa selecionada (visão consolidada) → só Dashboard agregado + Conta
            [...GRUPOS_EMPRESA_CONSOLIDADO, ...GRUPOS_EMPRESA_CONTA]
          : // Empresa específica em foco → menu operacional completo
            [...GRUPOS_EMPRESA_OPERACAO, ...GRUPOS_EMPRESA_CONTA];
  const inicial = nomeUsuario.trim().charAt(0).toUpperCase();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex items-center justify-center border-b border-slate-100 px-5 py-4">
        <Link
          href={
            visao === "ADMIN_PLATAFORMA"
              ? "/admin-plataforma"
              : visao === "ANALISTA"
              ? "/painel-analista"
              : "/dashboard"
          }
          className="block transition hover:opacity-80"
        >
          <Logo variant="sm" priority />
        </Link>
      </div>

      {/* Seletor de visão (super admin) */}
      {superAdmin && (
        <div className="border-b border-slate-100 px-3 py-3">
          <SeletorVisao visaoAtual={visao} />
        </div>
      )}

      {/* Seletor de empresa (só visão EMPRESA, e quando há ao menos uma empresa) */}
      {visao === "EMPRESA" && empresas.length > 0 && (
        <div className="border-b border-slate-100 px-3 py-3">
          <SeletorEmpresa empresas={empresas} empresaIdAtual={empresaIdSelecionada} />
        </div>
      )}

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {grupos.map((grupo, gi) => (
          <div key={grupo.titulo} className={gi > 0 ? "mt-5" : ""}>
            <h3 className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {grupo.titulo}
            </h3>
            {grupo.itens.map((item) => {
              const ativo =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              const mostrarBadge = item.href === "/notificacoes" && qtdNotificacoesNaoLidas > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    ativo
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      ativo ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {mostrarBadge && (
                    <span
                      className={`grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold ${
                        ativo ? "bg-white text-slate-900" : "bg-red-500 text-white"
                      }`}
                    >
                      {qtdNotificacoesNaoLidas > 99 ? "99+" : qtdNotificacoesNaoLidas}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Help buttons */}
      <div className="border-t border-slate-100 px-3 py-3">
        <HelpButtons />
      </div>

      {/* Usuário + sair */}
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg p-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-bold text-white">
            {inicial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{nomeUsuario}</p>
            <p className="truncate text-[11px] text-slate-500">
              {tipoConta === "ANALISTA"
                ? "Analista de licitações"
                : empresaIdSelecionada
                  ? `Em foco: ${empresas.find((x) => x.id === empresaIdSelecionada)?.nome ?? "?"}`
                  : empresas.length > 0
                    ? `Visão consolidada · ${empresas.length} empresa${empresas.length > 1 ? "s" : ""}`
                    : "Sem empresa cadastrada"}
            </p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
