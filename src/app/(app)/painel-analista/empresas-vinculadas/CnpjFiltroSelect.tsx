"use client";

// Dropdown de filtro por CNPJ na tela de Empresas vinculadas. Server
// component nao suporta onChange interativo — entao isolado aqui.
export function CnpjFiltroSelect({
  cnpjs,
  valor,
}: {
  cnpjs: { cnpj: string; nome: string }[];
  valor: string;
}) {
  return (
    <select
      defaultValue={valor}
      onChange={(e) => {
        const url = new URL(window.location.href);
        if (e.target.value) url.searchParams.set("cnpj", e.target.value);
        else url.searchParams.delete("cnpj");
        window.location.href = url.toString();
      }}
      className="rounded-[10px] px-3 py-1.5 text-xs"
    >
      <option value="">Todos os CNPJs</option>
      {cnpjs.map((c) => {
        const cnpjFormat = c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
        return (
          <option key={c.cnpj} value={c.cnpj}>
            {c.nome} ({cnpjFormat})
          </option>
        );
      })}
    </select>
  );
}
