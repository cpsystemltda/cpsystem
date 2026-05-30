"use client";

import { Printer } from "lucide-react";

// Botao simples que abre o dialogo de impressao do browser. O usuario
// escolhe "Salvar como PDF" no diretorio de destino. Funciona em qualquer
// pagina sem precisar de rota dedicada de impressao — usado no header da
// aba Relatorio de Ata/Contrato/Empenho. Para Contrato existe tambem a
// rota dedicada /contratos/[id]/imprimir com template mais formal.
export function BotaoImprimirRelatorio() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-secondary inline-flex"
      title="Abre o dialogo de impressao do navegador (escolha 'Salvar como PDF' para gerar arquivo)"
    >
      <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
    </button>
  );
}
