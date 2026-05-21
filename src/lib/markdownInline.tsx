import type { ReactNode } from "react";

// Parser minimalista de markdown pra mensagens do chat IAsystem.
// Cobre: **negrito**, *itálico*, `código inline`, listas com "- "/ "* "/ "1. ",
// linhas em branco como quebra de parágrafo. Sem dependência externa (mantém
// o bundle leve). NÃO suporta links/imagens/blocos de código.

type Token =
  | { tipo: "texto"; conteudo: string }
  | { tipo: "negrito"; conteudo: string }
  | { tipo: "italico"; conteudo: string }
  | { tipo: "codigo"; conteudo: string };

// Tokeniza uma linha — captura **bold**, *italic*, `code` (não-aninhados).
function tokenizarLinha(linha: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let buffer = "";
  function flush() {
    if (buffer) {
      out.push({ tipo: "texto", conteudo: buffer });
      buffer = "";
    }
  }
  while (i < linha.length) {
    if (linha[i] === "*" && linha[i + 1] === "*") {
      const fim = linha.indexOf("**", i + 2);
      if (fim !== -1) {
        flush();
        out.push({ tipo: "negrito", conteudo: linha.slice(i + 2, fim) });
        i = fim + 2;
        continue;
      }
    } else if (linha[i] === "*") {
      const fim = linha.indexOf("*", i + 1);
      if (fim !== -1 && linha[fim - 1] !== " ") {
        flush();
        out.push({ tipo: "italico", conteudo: linha.slice(i + 1, fim) });
        i = fim + 1;
        continue;
      }
    } else if (linha[i] === "`") {
      const fim = linha.indexOf("`", i + 1);
      if (fim !== -1) {
        flush();
        out.push({ tipo: "codigo", conteudo: linha.slice(i + 1, fim) });
        i = fim + 1;
        continue;
      }
    }
    buffer += linha[i];
    i++;
  }
  flush();
  return out;
}

function renderTokens(tokens: Token[]): ReactNode[] {
  return tokens.map((t, idx) => {
    if (t.tipo === "negrito") return <strong key={idx}>{t.conteudo}</strong>;
    if (t.tipo === "italico") return <em key={idx}>{t.conteudo}</em>;
    if (t.tipo === "codigo") {
      return (
        <code
          key={idx}
          className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] font-mono text-slate-800"
        >
          {t.conteudo}
        </code>
      );
    }
    return <span key={idx}>{t.conteudo}</span>;
  });
}

export function MarkdownInline({ texto }: { texto: string }) {
  // Quebra em "blocos" separados por linhas em branco
  const linhas = texto.split("\n");
  const blocos: ReactNode[] = [];
  let listaCorrente: string[] | null = null;
  let chaveLista = 0;

  function flushLista() {
    if (listaCorrente && listaCorrente.length > 0) {
      blocos.push(
        <ul key={`ul-${chaveLista++}`} className="my-1.5 ml-4 list-disc space-y-0.5">
          {listaCorrente.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderTokens(tokenizarLinha(item))}
            </li>
          ))}
        </ul>,
      );
    }
    listaCorrente = null;
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const stripped = linha.trimStart();
    const matchLista = stripped.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
    if (matchLista) {
      if (!listaCorrente) listaCorrente = [];
      listaCorrente.push(matchLista[1]);
      continue;
    }
    flushLista();
    if (linha.trim() === "") {
      // espaço — bloco em branco
      blocos.push(<div key={`gap-${i}`} className="h-1.5" />);
      continue;
    }
    blocos.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderTokens(tokenizarLinha(linha))}
      </p>,
    );
  }
  flushLista();

  return <div className="space-y-1">{blocos}</div>;
}
