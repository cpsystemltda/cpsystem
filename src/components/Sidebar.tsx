"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Truck,
  BarChart3,
  Scale,
  Settings,
  LogOut,
  Building2,
  Users,
  ScrollText,
  CreditCard,
  UserCheck,
  Bell,
  Sparkles,
  Wallet,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { SeletorVisao } from "@/components/SeletorVisao";
import { SeletorEmpresa, type EmpresaOpcao } from "@/components/SeletorEmpresa";
import { HelpButtons } from "@/components/HelpButtons";
import type { Visao } from "@/lib/visao";
import { Crown, Users2, Activity } from "lucide-react";

type Item = { href: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> };
type Grupo = { titulo: string; itens: Item[] };

// === Visão EMPRESA com empresa em foco ===
// Reorganizado em 3 grupos: Visão geral / Módulos / Conta (briefing aprovado)
const GRUPOS_EMPRESA_OPERACAO: Grupo[] = [
  {
    titulo: "Visão geral",
    itens: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/empresas", label: "Empresas (CNPJs)", icon: Building2 },
    ],
  },
  {
    titulo: "Módulos",
    itens: [
      { href: "/atas", label: "Atas de Registro de Preços", icon: FileText },
      { href: "/contratos", label: "Contratos", icon: ClipboardList },
      { href: "/execucao", label: "Empenhos / Fornecimentos / Execuções", icon: Truck },
      { href: "/juridico", label: "Consultoria", icon: Scale },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
];

// Versão "consolidada" — sem operação por empresa.
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
      { href: "/vinculos", label: "Analista vinculado", icon: UserCheck },
      { href: "/equipe", label: "Equipe", icon: Users },
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
      { href: "/painel-analista", label: "Dashboard", icon: LayoutDashboard },
      { href: "/painel-analista?tab=empresas", label: "Empresas vinculadas", icon: Wallet },
      { href: "/honorarios", label: "Comissões SaaS", icon: Sparkles },
      { href: "/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    titulo: "Conta",
    itens: [
      { href: "/equipe", label: "Equipe", icon: Users },
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
          ? [...GRUPOS_EMPRESA_CONSOLIDADO, ...GRUPOS_EMPRESA_CONTA]
          : [...GRUPOS_EMPRESA_OPERACAO, ...GRUPOS_EMPRESA_CONTA];
  const inicial = nomeUsuario.trim().charAt(0).toUpperCase();

  return (
    <aside className="glass relative m-[18px] flex h-[calc(100vh-36px)] w-[260px] flex-col overflow-hidden">
      {/* Logo / Brand */}
      <div className="relative border-b border-white/10 px-6 py-7 text-center">
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
          <div
            className="font-serif text-[40px] leading-none"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 500,
              letterSpacing: "-0.06em",
              background: "linear-gradient(180deg, #FFF 0%, var(--primary-bright) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            CP
          </div>
          <div className="mt-1.5 text-[9px] font-semibold uppercase" style={{ letterSpacing: "0.5em", color: "var(--primary)" }}>
            CP&nbsp;System
          </div>
        </Link>
        <div
          className="absolute bottom-0 left-[28%] right-[28%] h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
        />
      </div>

      {/* Seletor de visão (super admin) */}
      {superAdmin && (
        <div className="border-b border-white/10 px-3 py-3">
          <SeletorVisao visaoAtual={visao} />
        </div>
      )}

      {/* Seletor de empresa */}
      {visao === "EMPRESA" && empresas.length > 0 && (
        <div className="border-b border-white/10 px-3 py-3">
          <SeletorEmpresa empresas={empresas} empresaIdAtual={empresaIdSelecionada} />
        </div>
      )}

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {grupos.map((grupo, gi) => (
          <div key={grupo.titulo} className={gi > 0 ? "mt-5" : ""}>
            <h3
              className="px-3 pb-2 text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.26em", color: "var(--text-faint)" }}
            >
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
                  className="group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium leading-tight transition"
                  style={
                    ativo
                      ? {
                          background: "linear-gradient(135deg, var(--primary-bright), var(--primary))",
                          color: "#0A0A0A",
                          fontWeight: 700,
                          boxShadow: "0 4px 24px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.4)",
                        }
                      : { color: "var(--text-soft)", letterSpacing: "-0.01em" }
                  }
                >
                  <Icon
                    className="h-[17px] w-[17px] shrink-0"
                    style={{
                      color: ativo ? "#0A0A0A" : "var(--primary)",
                      strokeWidth: 1.7,
                    }}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {mostrarBadge && (
                    <span
                      className="grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold"
                      style={
                        ativo
                          ? { background: "rgba(255,255,255,0.4)", color: "#0A0A0A" }
                          : {
                              background: "var(--coral)",
                              color: "#fff",
                              boxShadow: "0 0 12px var(--coral-glow)",
                            }
                      }
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
      <div className="border-t border-white/10 px-3 py-3">
        <HelpButtons />
      </div>

      {/* Usuário + sair */}
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg p-2">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold"
            style={{
              background: "linear-gradient(135deg, var(--primary-bright), var(--primary))",
              color: "#0A0A0A",
              letterSpacing: "-0.04em",
              boxShadow: "0 0 18px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            {inicial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
              {nomeUsuario}
            </p>
            <p className="truncate text-[10px]" style={{ color: "var(--text-mute)" }}>
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
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-white/5"
            style={{ color: "var(--text-mute)" }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
