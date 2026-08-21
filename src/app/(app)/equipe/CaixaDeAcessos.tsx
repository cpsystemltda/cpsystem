"use client";

import { useState } from "react";
import { MODULOS } from "@/lib/modulosAcesso";

/**
 * A "caixa de opções" que o titular usa pra dizer onde o colaborador entra
 * (Regina 21/08). Fica em componente próprio porque aparece em dois lugares —
 * no cadastro de um colaborador novo e na edição de quem já existe.
 *
 * Regra da UI: marcar "acesso completo" desliga as caixinhas em vez de
 * escondê-las, pra pessoa enxergar o que está abrindo mão de controlar.
 */
export function CaixaDeAcessos({
  idPrefixo,
  restritoInicial,
  modulosIniciais,
}: {
  idPrefixo: string;
  restritoInicial: boolean;
  modulosIniciais: string[];
}) {
  const [completo, setCompleto] = useState(!restritoInicial);

  return (
    <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--hairline)" }}>
      <p className="text-xs font-bold uppercase" style={{ letterSpacing: "0.14em", color: "var(--primary-deep)" }}>
        Onde essa pessoa pode entrar
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
        O perfil define o que ela <em>faz</em> (cria, edita ou só lê). Aqui você define <em>onde</em> ela entra.
      </p>

      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="acessoCompleto"
          value="1"
          checked={completo}
          onChange={(e) => setCompleto(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong>Acesso completo</strong>
          <span className="block text-xs" style={{ color: "var(--text-soft)" }}>
            Enxerga o sistema inteiro, igual a você — inclusive o financeiro.
          </span>
        </span>
      </label>

      <div className={`mt-3 grid gap-2 sm:grid-cols-2 ${completo ? "opacity-40" : ""}`}>
        {MODULOS.map((m) => (
          <label key={m.chave} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="modulos"
              value={m.chave}
              defaultChecked={modulosIniciais.includes(m.chave)}
              disabled={completo}
              id={`${idPrefixo}-${m.chave}`}
              className="mt-0.5"
            />
            <span>
              {m.label}
              <span className="block text-[11px] leading-snug" style={{ color: "var(--text-mute)" }}>
                {m.descricao}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
