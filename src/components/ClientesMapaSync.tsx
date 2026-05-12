"use client";

import { useState, type ReactNode } from "react";
import { MapaBrasil, type DadosUf } from "@/components/MapaBrasil";
import { brl } from "@/lib/validators";

type Cliente = {
  nome: string;
  valor: number;
  uf: string | null;
};

/**
 * Envolve a tabela de clientes e o mapa para que hovers em um destaquem o
 * outro (sync lista↔mapa pedido na spec do dashboard). KPI de "Órgãos
 * atendidos" entra como children (slot) pra manter o layout existente.
 */
export function ClientesMapaSync({
  clientes,
  dadosUf,
  kpiSlot,
  mapaTitle,
  mapaSubtitle,
}: {
  clientes: Cliente[];
  dadosUf: DadosUf[];
  kpiSlot: ReactNode;
  mapaTitle?: string;
  mapaSubtitle?: string;
}) {
  const [ufDestaque, setUfDestaque] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 2fr" }}>
        {kpiSlot}
        <div className="glass-tile relative overflow-hidden rounded-[20px]">
          <table className="table-glass">
            <thead>
              <tr>
                <th>Órgão</th>
                <th className="num">Valor contratado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    style={{ textAlign: "center", color: "var(--text-mute)" }}
                  >
                    Sem dados ainda.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr
                    key={c.nome}
                    onMouseEnter={() => setUfDestaque(c.uf)}
                    onMouseLeave={() => setUfDestaque(null)}
                    style={{
                      cursor: c.uf ? "pointer" : "default",
                      background:
                        c.uf && ufDestaque === c.uf
                          ? "rgba(212,175,55,0.10)"
                          : undefined,
                      transition: "background 120ms",
                    }}
                    title={
                      c.uf
                        ? `Passe o mouse para destacar ${c.uf} no mapa`
                        : "UF não identificada"
                    }
                  >
                    <td className="strong">
                      {c.nome}
                      {c.uf && (
                        <span
                          className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                          style={{
                            background: "rgba(15,14,12,0.06)",
                            color: "var(--text-soft)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {c.uf}
                        </span>
                      )}
                    </td>
                    <td className="num strong">{brl(c.valor)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3.5">
        <section
          className="glass overflow-hidden rounded-[20px] px-5 py-5"
          style={{ border: "0.5px solid var(--hairline)" }}
        >
          <header className="mb-3">
            <h3
              className="text-[12px] font-bold uppercase"
              style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
            >
              {mapaTitle ?? "Mapa de operações por estado"}
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>
              {mapaSubtitle ??
                "Passe o mouse sobre uma linha da lista para destacar o estado no mapa."}
            </p>
          </header>
          <MapaBrasil dados={dadosUf} ufDestaque={ufDestaque} />
        </section>
      </div>
    </>
  );
}
