"use client";

import { useState, useTransition } from "react";
import { classificarSaidaAction } from "@/app/actions/dre";

const OPCOES: [string, string][] = [
  ["INFRAESTRUTURA", "Infraestrutura"],
  ["IA", "IA"],
  ["FERRAMENTAS", "Ferramentas e telefonia"],
  ["MARKETING", "Marketing"],
  ["CONTABILIDADE", "Contabilidade"],
  ["IMPOSTOS", "Impostos e taxas"],
  ["PESSOAL", "Pessoal e serviços"],
  ["OUTROS", "Outros"],
  ["RETIRADA_SOCIO", "Retirada/reembolso de sócio (fora do resultado)"],
  ["IGNORAR", "Não é da empresa (ignorar)"],
];

export function SeletorClasse({ id, classe }: { id: string; classe: string }) {
  const [valor, setValor] = useState(classe);
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={valor}
        disabled={pendente}
        onChange={(e) => {
          const novo = e.target.value;
          setValor(novo);
          start(async () => {
            const r = await classificarSaidaAction(id, novo);
            if (r?.erro) setErro(r.erro);
          });
        }}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
      >
        {OPCOES.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
      {pendente && <span className="text-[10px] text-slate-500">salvando…</span>}
      {erro && <span className="text-[10px] text-red-700">{erro}</span>}
    </span>
  );
}
