"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function brl(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

export function VencimentosPorMesChart({ dados }: { dados: number[] }) {
  const data = MESES.map((m, i) => ({ mes: m, qtd: dados[i] || 0 }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-vencimento" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f4c81" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#0f4c81" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "#0f4c81", fillOpacity: 0.05 }}
          contentStyle={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            fontSize: 12,
            boxShadow: "0 8px 24px -8px rgba(15, 76, 129, 0.2)",
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: number) => [`${v} contrato(s)`, "Vencimentos"]) as any}
        />
        <Bar dataKey="qtd" fill="url(#grad-vencimento)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TiposObjetoChart({
  dados,
}: {
  dados: { tipo: string; qtd: number }[];
}) {
  const cores = ["#0f4c81", "#2c7da0", "#61a5c2", "#a9d6e5", "#168aad", "#52b69a", "#76c893", "#99d98c"];
  const data = dados.map((d) => ({ ...d, label: d.tipo.replace(/_/g, " ") }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 24, bottom: 5 }}>
        <XAxis type="number" hide />
        <YAxis
          dataKey="label"
          type="category"
          tick={{ fontSize: 11, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          cursor={{ fill: "#0f4c81", fillOpacity: 0.05 }}
          contentStyle={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            fontSize: 12,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: number) => [`${v}`, "Quantidade"]) as any}
        />
        <Bar dataKey="qtd" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={cores[i % cores.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusExecucaoChart({
  dados,
}: {
  dados: { status: string; qtd: number; cor: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="qtd"
          nameKey="status"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={88}
          paddingAngle={2}
        >
          {dados.map((d, i) => (
            <Cell key={i} fill={d.cor} stroke="#fff" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            fontSize: 12,
          }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ValorAcumuladoChart({
  pago,
  pendente,
  carteira,
}: {
  pago: number;
  pendente: number;
  carteira: number;
}) {
  const data = [
    { categoria: "Pago", valor: pago, fill: "#10b981" },
    { categoria: "Pendente", valor: pendente, fill: "#f59e0b" },
    { categoria: "Em carteira", valor: carteira, fill: "#0f4c81" },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="categoria" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => brl(v)}
        />
        <Tooltip
          cursor={{ fill: "#0f4c81", fillOpacity: 0.05 }}
          contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 12 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: number) =>
            v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })) as any}
        />
        <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
