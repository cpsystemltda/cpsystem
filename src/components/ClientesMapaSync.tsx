"use client";

import { useState, type ReactNode } from "react";
import { type DadosUf } from "@/components/MapaBrasil";
import {
  MapaPinsBrasil,
  type PinMapa,
  type PinEntregaMapa,
  type PinEmpresaMapa,
} from "@/components/MapaPinsBrasil";
import { brl } from "@/lib/validators";

type Cliente = {
  nome: string;
  valor: number;
  uf: string | null;
  cnpj?: string;
};

/**
 * Envolve a tabela de clientes e o mapa para que hovers em um destaquem o
 * outro (sync lista↔mapa pedido na spec do dashboard). KPI de "Órgãos
 * atendidos" entra como children (slot) pra manter o layout existente.
 */
export function ClientesMapaSync({
  clientes,
  dadosUf,
  pins,
  pinsEntregas,
  pinsEmpresas,
  kpiSlot,
  mapaTitle,
  mapaSubtitle,
}: {
  clientes: Cliente[];
  dadosUf: DadosUf[];
  // Quando há pins geocodificados, usamos MapaPinsBrasil (Leaflet) com
  // marcadores reais por órgão. Sem pins, fallback no choropleth SVG.
  pins?: PinMapa[];
  // Pins adicionais de locais de entrega — habilita toggle "Sedes/Entregas"
  // no canto do mapa quando fornecidos.
  pinsEntregas?: PinEntregaMapa[];
  // Sedes das EMPRESAS da fornecedora (CNPJs cadastrados na conta).
  pinsEmpresas?: PinEmpresaMapa[];
  kpiSlot: ReactNode;
  mapaTitle?: string;
  mapaSubtitle?: string;
}) {
  const [ufDestaque, setUfDestaque] = useState<string | null>(null);
  const [cnpjDestaque, setCnpjDestaque] = useState<string | null>(null);
  // dadosUf vem como prop por compat com chamadores existentes, mas não
  // alimenta mais o choropleth (que foi removido). Mantemos só pra não
  // quebrar callsite — ufDestaque continua sendo usado pra hover sync.
  void dadosUf;

  // Numero do pin pra cada cnpj de pin de orgao. A ordem dos pins eh
  // ja vinda do servidor ordenada por valor (ver coletarPinsOrgaos).
  // Mostrar o mesmo numero do mapa na tabela ao lado pra a Regina
  // localizar visualmente (pedido 01/06).
  const numeroPorCnpj = new Map<string, number>();
  pins?.forEach((p, idx) => {
    if (p.cnpj) numeroPorCnpj.set(p.cnpj, idx + 1);
  });

  return (
    <>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 2fr" }}>
        {kpiSlot}
        <div className="glass-tile relative overflow-hidden rounded-[20px]">
          <table className="table-glass">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Órgão</th>
                <th className="num">Valor contratado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    style={{ textAlign: "center", color: "var(--text-mute)" }}
                  >
                    Sem dados ainda.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => {
                  const numero = c.cnpj ? numeroPorCnpj.get(c.cnpj) : undefined;
                  return (
                    <tr
                      key={c.nome}
                      onMouseEnter={() => {
                        setUfDestaque(c.uf);
                        if (c.cnpj) setCnpjDestaque(c.cnpj);
                      }}
                      onMouseLeave={() => {
                        setUfDestaque(null);
                        // Mantem cnpjDestaque ate o proximo click — assim o mapa
                        // permanece centrado no pin escolhido depois do hover.
                      }}
                      onClick={() => {
                        if (c.cnpj) setCnpjDestaque(c.cnpj);
                      }}
                      style={{
                        cursor: c.uf || c.cnpj ? "pointer" : "default",
                        background:
                          (c.uf && ufDestaque === c.uf) ||
                          (c.cnpj && cnpjDestaque === c.cnpj)
                            ? "rgba(212,175,55,0.10)"
                            : undefined,
                        transition: "background 120ms",
                      }}
                      title={
                        c.cnpj
                          ? "Clique para centrar o mapa neste órgão"
                          : c.uf
                            ? `Passe o mouse para destacar ${c.uf} no mapa`
                            : "Sem geocode"
                      }
                    >
                      <td className="num">
                        {numero != null ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 22,
                              height: 22,
                              padding: "0 6px",
                              background:
                                c.cnpj && cnpjDestaque === c.cnpj
                                  ? "#A88947"
                                  : "#7a5c1a",
                              color: "white",
                              borderRadius: 11,
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {numero}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-mute)" }}>—</span>
                        )}
                      </td>
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
                  );
                })
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
              {mapaTitle ?? "Órgãos atendidos no mapa"}
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>
              {mapaSubtitle ??
                "Cada pin tem um número (1, 2, 3…) que aparece também na lista ao lado. Clique numa linha da lista para o mapa centrar no pin correspondente."}
            </p>
          </header>
          {/* Sempre usa o MapaPinsBrasil (Leaflet com satélite). Quando
              ainda não há pins geocodificados, o componente mostra o mapa
              do Brasil vazio com mensagem informativa — nunca cai no
              choropleth SVG (decisão Regina: o choropleth é feio). */}
          <MapaPinsBrasil
            pins={pins ?? []}
            pinsEntregas={pinsEntregas}
            pinsEmpresas={pinsEmpresas}
            cnpjDestaque={cnpjDestaque}
          />
        </section>
      </div>
    </>
  );
}
