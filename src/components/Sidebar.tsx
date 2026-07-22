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
  Plug,
  Banknote,
  ShieldCheck,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { SeletorVisao } from "@/components/SeletorVisao";
import { SeletorEmpresa, type EmpresaOpcao } from "@/components/SeletorEmpresa";
import { HelpButtonsInline } from "@/components/HelpButtonsInline";
import { Logo } from "@/components/Logo";
import type { Visao } from "@/lib/visao";
import { Crown, Users2, Activity, Gift, Ticket, Send, UserCog, MessageCircle } from "lucide-react";

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
      { href: "/execucao", label: "Fornecimento/Execução", icon: Truck },
      { href: "/juridico", label: "Consultoria jurídica", icon: Scale },
      { href: "/conciliacao", label: "Conciliação bancária", icon: Banknote },
      { href: "/honorarios", label: "Honorários do analista", icon: Sparkles },
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
      { href: "/conta/perfil", label: "Meus dados", icon: UserCog },
      { href: "/conta/seguranca", label: "Segurança", icon: ShieldCheck },
      { href: "/notificacoes", label: "Notificações", icon: Bell },
      { href: "/conta/notificacoes", label: "Notificações WhatsApp", icon: Bell },
      { href: "/conta/assinatura", label: "Assinatura", icon: CreditCard },
      { href: "/conta/integracoes", label: "Integrações", icon: Plug },
      { href: "/conta/indicar", label: "Indique e ganhe", icon: Gift },
      { href: "/vinculos", label: "Analista vinculado", icon: UserCheck },
      { href: "/equipe", label: "Equipe", icon: Users },
      { href: "/termos", label: "Termos / LGPD", icon: ScrollText },
    ],
  },
  // Grupo "Admin" (Painel do PO + Gateway) movido para fora — essas rotas
  // exigem superAdmin, então só fazem sentido em GRUPOS_ADMIN_PLATAFORMA.
];

const GRUPOS_ANALISTA: Grupo[] = [
  {
    titulo: "Painel",
    itens: [
      { href: "/painel-analista", label: "Dashboard", icon: LayoutDashboard },
      { href: "/painel-analista/empresas-vinculadas", label: "Empresas vinculadas", icon: Wallet },
      { href: "/honorarios", label: "Comissões SaaS", icon: Sparkles },
      { href: "/notificacoes", label: "Notificações", icon: Bell },
    ],
  },
  {
    titulo: "Conta",
    itens: [
      { href: "/conta/perfil", label: "Meus dados", icon: UserCog },
      { href: "/conta/seguranca", label: "Segurança", icon: ShieldCheck },
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
      { href: "/admin-plataforma/analistas", label: "Analistas", icon: UserCheck },
      { href: "/painel-analista", label: "Painel do analista", icon: LayoutDashboard },
      { href: "/admin-plataforma/financeiro", label: "Financeiro · MRR", icon: Wallet },
      { href: "/admin-plataforma/atividade", label: "Atividade", icon: Activity },
      { href: "/admin/cupons", label: "Cupons promocionais", icon: Ticket },
    ],
  },
  {
    titulo: "Operação interna",
    itens: [
      { href: "/admin", label: "Painel do PO", icon: Settings },
      { href: "/admin/gateway", label: "Gateway de pagamento", icon: CreditCard },
      { href: "/admin/suporte", label: "Suporte (chamados IA)", icon: MessageCircle },
      { href: "/admin/envios", label: "Envios WA (contrato / migração)", icon: Send },
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

  // Empresa "em foco": cookie selecionou OU só existe 1 empresa cadastrada
  // (nesse caso, não faz sentido tela "consolidada" — toda operação é dela).
  const temEmpresaEmFoco = !!empresaIdSelecionada || empresas.length === 1;

  const grupos =
    visao === "ADMIN_PLATAFORMA"
      ? GRUPOS_ADMIN_PLATAFORMA
      : visao === "ANALISTA"
        ? GRUPOS_ANALISTA
        : !temEmpresaEmFoco
          ? [...GRUPOS_EMPRESA_CONSOLIDADO, ...GRUPOS_EMPRESA_CONTA]
          : [...GRUPOS_EMPRESA_OPERACAO, ...GRUPOS_EMPRESA_CONTA];
  const inicial = nomeUsuario.trim().charAt(0).toUpperCase();

  const subtituloFooter =
    tipoConta === "ANALISTA"
      ? "Analista de licitações"
      : empresaIdSelecionada
        ? `Em foco: ${empresas.find((x) => x.id === empresaIdSelecionada)?.nome ?? "?"}`
        : empresas.length > 0
          ? `Consolidado · ${empresas.length} empresa${empresas.length > 1 ? "s" : ""}`
          : "Sem empresa cadastrada";

  return (
    <aside className="glass sidebar-cp relative m-[18px] flex h-[calc(100vh-36px)] w-[290px] flex-col overflow-hidden">
      {/* Header sticky — logo + seletores */}
      <div className="shrink-0 border-b border-[color:var(--hairline)]">
        <div className="relative px-6 py-3">
          <Link
            href={
              visao === "ADMIN_PLATAFORMA"
                ? "/admin-plataforma"
                : visao === "ANALISTA"
                  ? "/painel-analista"
                  : "/dashboard"
            }
            className="flex items-center justify-center transition hover:opacity-80"
          >
            <Logo variant="sm" mode="brand" onDark priority />
          </Link>
          <div
            className="absolute bottom-0 left-[28%] right-[28%] h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--primary), transparent)",
            }}
          />
        </div>
        {superAdmin && (
          <div className="border-t border-[color:var(--hairline)] px-3 py-2.5">
            <SeletorVisao visaoAtual={visao} />
          </div>
        )}
        {visao === "EMPRESA" && empresas.length > 0 && (
          <div className="border-t border-[color:var(--hairline)] px-3 py-2.5">
            <SeletorEmpresa empresas={empresas} empresaIdAtual={empresaIdSelecionada} />
          </div>
        )}
      </div>

      {/* Navegação central — scroll inteligente, scrollbar invisível default */}
      <nav className="sidebar-nav flex-1 overflow-y-auto px-3 py-3">
        {grupos.map((grupo, gi) => (
          <div key={grupo.titulo} className={gi > 0 ? "mt-4" : ""}>
            <h3
              className="px-3 pb-1.5 text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.26em", color: "var(--text-faint)" }}
            >
              {grupo.titulo}
            </h3>
            {grupo.itens.map((item) => {
              const ativo =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              const mostrarBadge =
                item.href === "/notificacoes" && qtdNotificacoesNaoLidas > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium leading-tight transition hover:bg-[rgba(212,175,55,0.08)]"
                  style={
                    ativo
                      ? {
                          background:
                            "linear-gradient(135deg, var(--primary-bright), var(--primary))",
                          color: "#0A0A0A",
                          fontWeight: 700,
                          boxShadow:
                            "0 4px 24px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.4)",
                        }
                      : { color: "var(--text-soft)", letterSpacing: "-0.01em" }
                  }
                >
                  <Icon
                    className="h-[18px] w-[18px] shrink-0 transition group-hover:scale-110"
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

      {/* Footer sticky compacto — avatar + nome + ícones de ação */}
      <div className="shrink-0 border-t border-[color:var(--hairline)] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
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
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[13px] font-semibold leading-tight"
              style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
            >
              {nomeUsuario}
            </p>
            <p
              className="truncate text-[10px] leading-tight"
              style={{ color: "var(--text-mute)" }}
            >
              {subtituloFooter}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1 border-t border-[color:var(--hairline)] pt-2">
          <HelpButtonsInline />
          <form action={logoutAction} className="ml-auto">
            <button
              type="submit"
              title="Sair"
              aria-label="Sair"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Scrollbar custom: invisível padrão, fina e elegante no hover */}
      <style jsx>{`
        .sidebar-nav::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar-nav::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-nav::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 999px;
        }
        .sidebar-cp:hover .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(15, 14, 12, 0.15);
        }
        .sidebar-cp:hover .sidebar-nav::-webkit-scrollbar-thumb:hover {
          background: rgba(15, 14, 12, 0.3);
        }
      `}</style>
    </aside>
  );
}
