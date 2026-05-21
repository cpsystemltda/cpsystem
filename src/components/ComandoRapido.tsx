"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  Search,
  LayoutDashboard,
  Building2,
  FileText,
  ClipboardList,
  Truck,
  Scale,
  BarChart3,
  Bell,
  CreditCard,
  UserCheck,
  Users,
  ScrollText,
  Crown,
  Users2,
  Wallet,
  Activity,
  Settings,
  Sparkles,
  ArrowRight,
  CornerDownLeft,
  ChevronsUpDown,
} from "lucide-react";

type Visao = "EMPRESA" | "ANALISTA" | "ADMIN_PLATAFORMA";

type Rota = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  categoria: string;
  keywords: string[];
  // Quem vê a rota. Se omitido, todo mundo vê.
  visivelPara?: Visao[];
  apenasSuperAdmin?: boolean;
};

// Catálogo de rotas — labels + sinônimos pra fuzzy match.
// Mantém em sincronia com Sidebar.tsx (mesmas hrefs e labels visuais).
const ROTAS: Rota[] = [
  // Empresa
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, categoria: "Visão geral", keywords: ["inicio", "home", "principal", "painel"], visivelPara: ["EMPRESA"] },
  { label: "Empresas (CNPJs)", href: "/empresas", icon: Building2, categoria: "Visão geral", keywords: ["cnpj", "empresa", "filial", "matriz"], visivelPara: ["EMPRESA"] },
  { label: "Atas de Registro de Preços", href: "/atas", icon: FileText, categoria: "Módulos", keywords: ["ata", "atas", "arp", "srp", "registro", "preços", "preco"], visivelPara: ["EMPRESA"] },
  { label: "Contratos", href: "/contratos", icon: ClipboardList, categoria: "Módulos", keywords: ["contrato", "administrativo"], visivelPara: ["EMPRESA"] },
  { label: "Fornecimento / Execução", href: "/execucao", icon: Truck, categoria: "Módulos", keywords: ["empenho", "ne", "nota empenho", "execucao", "fornecimento", "logistica", "entrega"], visivelPara: ["EMPRESA"] },
  { label: "Consultoria jurídica", href: "/juridico", icon: Scale, categoria: "Módulos", keywords: ["juridico", "consultoria", "parecer", "advogado", "ia juridica"], visivelPara: ["EMPRESA"] },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3, categoria: "Módulos", keywords: ["relatorio", "report", "analytics", "graficos"], visivelPara: ["EMPRESA"] },
  { label: "Reajustes", href: "/reajustes", icon: Wallet, categoria: "Módulos", keywords: ["reajuste", "ipca", "inpc", "igpm", "indice"], visivelPara: ["EMPRESA"] },
  { label: "Notificações", href: "/notificacoes", icon: Bell, categoria: "Conta", keywords: ["notificacao", "alerta", "aviso", "prazo"] },
  { label: "Assinatura", href: "/conta/assinatura", icon: CreditCard, categoria: "Conta", keywords: ["plano", "premium", "basico", "cobranca", "pagamento", "fatura"], visivelPara: ["EMPRESA"] },
  { label: "Analista vinculado", href: "/vinculos", icon: UserCheck, categoria: "Conta", keywords: ["vinculo", "analista", "comissao"], visivelPara: ["EMPRESA"] },
  { label: "Equipe", href: "/equipe", icon: Users, categoria: "Conta", keywords: ["usuarios", "equipe", "perfil", "convite"] },
  { label: "Termos / LGPD", href: "/termos", icon: ScrollText, categoria: "Conta", keywords: ["lgpd", "privacidade", "termos", "politica"] },

  // Analista
  { label: "Painel do analista", href: "/painel-analista", icon: LayoutDashboard, categoria: "Analista", keywords: ["analista", "painel", "dashboard"], visivelPara: ["ANALISTA", "ADMIN_PLATAFORMA"] },
  { label: "Honorários / Comissões", href: "/honorarios", icon: Sparkles, categoria: "Analista", keywords: ["honorario", "comissao", "saas"], visivelPara: ["ANALISTA"] },

  // Super admin
  { label: "Adm CP System — Visão geral", href: "/admin-plataforma", icon: Crown, categoria: "Plataforma", keywords: ["admin", "plataforma", "po", "visao geral"], apenasSuperAdmin: true },
  { label: "Adm CP System — Clientes", href: "/admin-plataforma/clientes", icon: Users2, categoria: "Plataforma", keywords: ["clientes", "contas", "espionagem", "ver como"], apenasSuperAdmin: true },
  { label: "Adm CP System — Analistas", href: "/admin-plataforma/analistas", icon: UserCheck, categoria: "Plataforma", keywords: ["analistas", "rede", "comissoes"], apenasSuperAdmin: true },
  { label: "Adm CP System — Financeiro / MRR", href: "/admin-plataforma/financeiro", icon: Wallet, categoria: "Plataforma", keywords: ["mrr", "arr", "financeiro", "receita", "assinaturas"], apenasSuperAdmin: true },
  { label: "Adm CP System — Atividade", href: "/admin-plataforma/atividade", icon: Activity, categoria: "Plataforma", keywords: ["atividade", "auditoria", "logs", "historico"], apenasSuperAdmin: true },
  { label: "Adm CP System — Painel do PO", href: "/admin", icon: Settings, categoria: "Plataforma", keywords: ["po", "painel", "interno"], apenasSuperAdmin: true },
  { label: "Adm CP System — Gateway de pagamento", href: "/admin/gateway", icon: CreditCard, categoria: "Plataforma", keywords: ["gateway", "asaas", "stripe", "pagamento", "cobranca"], apenasSuperAdmin: true },
];

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function filtrarRotas(query: string, visao: Visao, superAdmin: boolean): Rota[] {
  // Lista o que o usuário pode ver
  const acessiveis = ROTAS.filter((r) => {
    if (r.apenasSuperAdmin && !superAdmin) return false;
    if (r.visivelPara && !r.visivelPara.includes(visao)) {
      // super admin vê tudo
      if (!superAdmin) return false;
    }
    return true;
  });
  if (!query.trim()) return acessiveis;
  const q = normalizar(query);
  return acessiveis.filter((r) => {
    if (normalizar(r.label).includes(q)) return true;
    if (normalizar(r.categoria).includes(q)) return true;
    return r.keywords.some((k) => normalizar(k).includes(q));
  });
}

export function ComandoRapido({
  visao,
  superAdmin,
}: {
  visao: Visao;
  superAdmin: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const resultados = useMemo(() => filtrarRotas(query, visao, superAdmin), [query, visao, superAdmin]);

  // Atalho global: Cmd+K / Ctrl+K
  useEffect(() => {
    function handler(ev: KeyboardEvent) {
      const isComboK = (ev.metaKey || ev.ctrlKey) && (ev.key === "k" || ev.key === "K");
      if (isComboK) {
        const ativo = document.activeElement;
        // Se está digitando num input/textarea fora do nosso modal, NÃO captura
        // (evita conflito com formulários do app). Cmd+K ainda funciona se a
        // pessoa estiver em uma área não-editável.
        const dentroDoModal = listaRef.current?.contains(ativo);
        const ehEditavel =
          ativo instanceof HTMLInputElement ||
          ativo instanceof HTMLTextAreaElement ||
          (ativo instanceof HTMLElement && ativo.isContentEditable);
        if (ehEditavel && !dentroDoModal && !aberto) return;
        ev.preventDefault();
        setAberto((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [aberto]);

  // Foca input quando abre + reset state
  useEffect(() => {
    if (aberto) {
      setQuery("");
      setIdx(0);
      // requestAnimationFrame pra garantir que o input está mounted
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [aberto]);

  // ESC fecha + setas navegam + Enter abre
  useEffect(() => {
    if (!aberto) return;
    function nav(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        setAberto(false);
        return;
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setIdx((i) => Math.min(i + 1, resultados.length - 1));
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        const escolhido = resultados[idx];
        if (escolhido) {
          router.push(escolhido.href);
          setAberto(false);
        }
      }
    }
    window.addEventListener("keydown", nav);
    return () => window.removeEventListener("keydown", nav);
  }, [aberto, resultados, idx, router]);

  // Scroll do item selecionado pra dentro
  useEffect(() => {
    if (!aberto) return;
    const el = listaRef.current?.querySelector(`[data-idx="${idx}"]`);
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [idx, aberto]);

  function escolher(rota: Rota) {
    router.push(rota.href);
    setAberto(false);
  }

  if (!aberto) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
        onClick={() => setAberto(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Busca rápida"
        className="fixed left-1/2 top-[100px] z-[71] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl bg-white shadow-2xl"
        style={{
          boxShadow:
            "0 24px 48px -8px rgba(15, 14, 12, 0.30), 0 8px 16px -4px rgba(15, 14, 12, 0.10)",
        }}
      >
        {/* Header com input */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setIdx(0);
            }}
            placeholder="Buscar… (digite ata, contrato, empenho, financeiro…)"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
            aria-autocomplete="list"
          />
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Lista de resultados */}
        <div
          ref={listaRef}
          className="max-h-[60vh] overflow-y-auto px-2 py-2"
        >
          {resultados.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Nada encontrado pra "<strong>{query}</strong>".
            </p>
          ) : (
            <>
              {agrupar(resultados).map(([categoria, lista]) => (
                <div key={categoria} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {categoria}
                  </p>
                  {lista.map((r) => {
                    const indice = resultados.indexOf(r);
                    const ativo = indice === idx;
                    const Icone = r.icon;
                    return (
                      <button
                        key={r.href}
                        type="button"
                        data-idx={indice}
                        onMouseEnter={() => setIdx(indice)}
                        onClick={() => escolher(r)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                          ativo
                            ? "bg-violet-600 text-white"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Icone
                          className={`h-4 w-4 shrink-0 ${ativo ? "text-white" : "text-violet-600"}`}
                        />
                        <span className="flex-1 truncate font-medium">{r.label}</span>
                        {ativo && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-80" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer com keybind hints */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <Command className="h-3 w-3" />
            <span>+</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold">K</kbd>
            <span className="ml-1">abre/fecha</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <ChevronsUpDown className="h-3 w-3" /> navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> abrir
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> {resultados.length} resultado
              {resultados.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function agrupar(resultados: Rota[]): [string, Rota[]][] {
  const mapa = new Map<string, Rota[]>();
  for (const r of resultados) {
    const arr = mapa.get(r.categoria) ?? [];
    arr.push(r);
    mapa.set(r.categoria, arr);
  }
  return Array.from(mapa.entries());
}
