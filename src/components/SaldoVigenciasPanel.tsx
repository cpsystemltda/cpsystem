"use client";

import { brl } from "@/lib/validators";
import type {
  SaldoAta,
  SaldoContrato,
  SaldoVigencia,
  SaldoVigenciaContrato,
} from "@/lib/saldo";
import { IniciarNovaVigenciaModal } from "@/components/IniciarNovaVigenciaModal";
import { ItensAtaTab } from "@/components/abas/ItensAtaTab";
import { ItensContratoTab } from "@/components/abas/ItensContratoTab";

// Painel da aba "Saldo de itens" — mostra UMA tabela por vigência, em
// sequência (uma embaixo da outra), além do bloco "Histórico de
// vigências" no final quando há mais de uma. KPIs financeiros ficam no
// header da página (componente KpisSaldoVigencia), não aqui.
//
// Layout (decisão Regina):
//   [Botão "Iniciar nova vigência" — se podeIniciarManual]
//   Bloco da Vigência 1ª — header + tabela de itens
//   Bloco da Vigência 2ª — header + tabela de itens
//   ...
//   Tabela resumo "Histórico de vigências" (só quando >1 vig)

export function SaldoVigenciasPanel({
  saldo,
  tipoItens,
  contratoId,
  ataId,
  podeIniciarManual,
}: {
  saldo: SaldoAta | SaldoContrato;
  // Decide qual tabela renderizar internamente (em vez de receber função
  // do server component — Next 16 rejeita functions cruzando o boundary).
  tipoItens: "ATA" | "CONTRATO";
  contratoId?: string;
  ataId?: string;
  podeIniciarManual?: boolean;
}) {
  const temMultiplasVigencias = saldo.vigencias.length > 1;

  // Sugestão de datas pra modal: começa onde a última vigência acabou +1d,
  // termina +1 ano depois.
  const ultimaVigencia = saldo.vigencias.reduce<
    SaldoVigencia | SaldoVigenciaContrato | null
  >((a, b) => (!a || b.ordem > a.ordem ? b : a), null);
  const dataInicioSugerida = ultimaVigencia
    ? toIsoDate(addDays(ultimaVigencia.dataFim, 1))
    : toIsoDate(new Date());
  const dataFimSugerida = ultimaVigencia
    ? toIsoDate(addDays(addDays(ultimaVigencia.dataFim, 1), 365))
    : toIsoDate(addDays(new Date(), 365));
  const proximaOrdem = (ultimaVigencia?.ordem ?? 0) + 1;

  return (
    <div className="space-y-6">
      {/* Botão "Iniciar nova vigência" — sempre que houver permissão */}
      {podeIniciarManual && (contratoId || ataId) && (
        <div className="flex justify-end">
          <IniciarNovaVigenciaModal
            contratoId={contratoId}
            ataId={ataId}
            proximaOrdem={proximaOrdem}
            dataInicioSugerida={dataInicioSugerida}
            dataFimSugerida={dataFimSugerida}
            valorAtual={saldo.vigenciaAtual?.valorTotal ?? 0}
          />
        </div>
      )}

      {/* Tabelas empilhadas — uma por vigência */}
      {saldo.vigencias.map((v) => (
        <BlocoVigencia
          key={v.vigenciaId}
          vigencia={v}
          temMultiplas={temMultiplasVigencias}
          tipoItens={tipoItens}
        />
      ))}

      {/* Fallback pra documentos sem vigência (não deveria acontecer
          pós-backfill — mostra a tabela do saldo legado) */}
      {saldo.vigencias.length === 0 && <TabelaItens tipoItens={tipoItens} itens={saldo.itens} />}

      {/* Histórico de vigências (só quando >1) */}
      {temMultiplasVigencias && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Histórico de vigências
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Período</th>
                  <th className="px-4 py-2 text-right">Valor total</th>
                  <th className="px-4 py-2 text-right">Executado</th>
                  <th className="px-4 py-2 text-right">% usado</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-left">Origem</th>
                </tr>
              </thead>
              <tbody>
                {saldo.vigencias.map((v) => (
                  <tr key={v.vigenciaId} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-bold">{v.ordem}ª</td>
                    <td className="px-4 py-2 text-slate-600">
                      {formatarData(v.dataInicio)} → {formatarData(v.dataFim)}
                    </td>
                    <td className="px-4 py-2 text-right">{brl(v.valorTotal)}</td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {brl(v.valorUsado)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {v.percentualUsado.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusBadge status={v.status} grande />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {v.termoAditivoId ? "Termo Aditivo" : "Original"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: renderiza a tabela certa baseado no tipo (Ata ou Contrato).
// Ambas são client components — importadas no topo do arquivo, sem
// problema de cruzar Server↔Client boundary.
function TabelaItens({
  tipoItens,
  itens,
}: {
  tipoItens: "ATA" | "CONTRATO";
  itens: unknown[];
}) {
  if (tipoItens === "ATA") {
    return (
      <ItensAtaTab
        saldo={{ itens: itens as Parameters<typeof ItensAtaTab>[0]["saldo"]["itens"] }}
      />
    );
  }
  return (
    <ItensContratoTab
      saldo={{ itens: itens as Parameters<typeof ItensContratoTab>[0]["saldo"]["itens"] }}
    />
  );
}

// Bloco de uma vigência: header com ordem/período/status + valores
// específicos da vigência + tabela de itens correspondente ao tipo.
function BlocoVigencia({
  vigencia,
  temMultiplas,
  tipoItens,
}: {
  vigencia: SaldoVigencia | SaldoVigenciaContrato;
  temMultiplas: boolean;
  tipoItens: "ATA" | "CONTRATO";
}) {
  return (
    <section
      className="rounded-2xl border border-slate-200"
      style={{ background: "white" }}
    >
      {/* Header da vigência — só destaca quando há mais de uma. Com 1 só,
          o cabeçalho enxuto evita ruído visual em quem não usa prorrogação. */}
      {temMultiplas && (
        <header
          className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"
          style={{
            background:
              vigencia.status === "ATIVA"
                ? "rgba(16,185,129,0.04)"
                : vigencia.status === "ENCERRADA"
                  ? "rgba(100,116,139,0.03)"
                  : "rgba(245,158,11,0.04)",
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: "1rem",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider"
              style={{ background: "white", color: "var(--text)", border: "1px solid var(--hairline)" }}
            >
              {vigencia.ordem}ª vigência
            </span>
            <span className="text-xs text-slate-600">
              {formatarData(vigencia.dataInicio)} → {formatarData(vigencia.dataFim)}
            </span>
            <StatusBadge status={vigencia.status} grande />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>
              Contratado <strong className="text-slate-900">{brl(vigencia.valorTotal)}</strong>
            </span>
            <span>
              Executado <strong className="text-slate-900">{brl(vigencia.valorUsado)}</strong> ·{" "}
              {vigencia.percentualUsado.toFixed(1)}%
            </span>
            <span>
              A executar{" "}
              <strong style={{ color: "#047857" }}>{brl(vigencia.valorDisponivel)}</strong>
            </span>
            {vigencia.termoAditivoId && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
                via Aditivo
              </span>
            )}
          </div>
        </header>
      )}

      <div className="p-3">
        <TabelaItens tipoItens={tipoItens} itens={vigencia.itens} />
      </div>
    </section>
  );
}

function StatusBadge({
  status,
  grande = false,
}: {
  status: "ATIVA" | "ENCERRADA" | "FUTURA";
  grande?: boolean;
}) {
  const cor = {
    ATIVA: { bg: "rgba(16,185,129,0.18)", txt: "#065f46" },
    ENCERRADA: { bg: "rgba(100,116,139,0.18)", txt: "#475569" },
    FUTURA: { bg: "rgba(245,158,11,0.18)", txt: "#92400e" },
  }[status];
  return (
    <span
      className={`inline-flex items-center rounded-full ${grande ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[9px]"} font-bold uppercase`}
      style={{ background: cor.bg, color: cor.txt }}
    >
      {status === "ATIVA" ? "ativa" : status === "ENCERRADA" ? "encerrada" : "futura"}
    </span>
  );
}

function formatarData(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

function addDays(d: Date, dias: number): Date {
  const nova = new Date(d);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
