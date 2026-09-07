"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCopy,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Receipt,
  UploadCloud,
  X,
} from "lucide-react";
import {
  emitirNotaFiscalAction,
  consultarNotaFiscalAction,
  cancelarNotaFiscalAction,
  type ResultadoEmissao,
} from "@/app/actions/notaFiscal";
import {
  registrarNotaEmitidaAction,
  informarNumeroNotaAction,
  excluirNotaRegistradaAction,
  type ResultadoNotaRegistrada,
} from "@/app/actions/notaRegistrada";

export type NotaDoEmpenho = {
  id: string;
  provedor?: "FOCUS_NFE" | "DEMO" | "EXTERNA";
  status: "PROCESSANDO" | "AUTORIZADA" | "ERRO" | "CANCELADA";
  numero: string | null;
  ambiente: "HOMOLOGACAO" | "PRODUCAO";
  pdfUrl: string | null;
  linkPrefeitura: string | null;
  mensagemErro: string | null;
  valorServicos: number;
  criadoEm: string;
};

/**
 * "Emitir NF" na etapa de nota fiscal do empenho.
 *
 * Fica ao LADO do registro manual, não no lugar dele: quem emite a nota por
 * fora (contabilidade, sistema próprio) continua podendo só anexar o arquivo e
 * marcar a data. Tirar esse caminho seria obrigar todo mundo a contratar casa
 * fiscal pra continuar usando o que já usava.
 */
export function EmitirNotaFiscal({
  empenhoId,
  emissaoLigada,
  valorTotal,
  notas,
  podeCancelar,
  blocoContabilidade,
  notaMarcadaEm,
}: {
  empenhoId: string;
  emissaoLigada: boolean;
  valorTotal: number;
  notas: NotaDoEmpenho[];
  podeCancelar: boolean;
  /** Texto pronto pra mandar pra contabilidade pedindo a nota. */
  blocoContabilidade: string;
  /** Data da nota já marcada à mão no fluxo antigo, sem número registrado. */
  notaMarcadaEm?: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, emitir, emitindo] = useActionState<ResultadoEmissao | null, FormData>(
    emitirNotaFiscalAction,
    null,
  );
  const [estadoConsulta, consultar, consultando] = useActionState<ResultadoEmissao | null, FormData>(
    consultarNotaFiscalAction,
    null,
  );
  const [cancelando, setCancelando] = useState(false);
  const [informar, informarAcao, informando] = useActionState<
    ResultadoNotaRegistrada | null,
    FormData
  >(informarNumeroNotaAction, null);
  const [copiado, setCopiado] = useState(false);
  const [registrar, registrarAcao, registrando] = useActionState<
    ResultadoNotaRegistrada | null,
    FormData
  >(registrarNotaEmitidaAction, null);
  const [estadoCancel, cancelar, pendenteCancel] = useActionState<ResultadoEmissao | null, FormData>(
    cancelarNotaFiscalAction,
    null,
  );

  const autorizada = notas.find((n) => n.status === "AUTORIZADA");
  // Notas já guardadas neste empenho — quantas forem.
  const notasRegistradas = notas.filter(
    (n) => n.status === "AUTORIZADA" || n.status === "PROCESSANDO",
  );

  // Nota marcada à mão no fluxo antigo: existe a data, falta o número — que é
  // justamente o dado que se usa pra conferir com o banco e falar com o órgão
  // (Igor, 28/08). Pedir o PDF de novo só pra recuperar um número que a pessoa
  // tem na mão seria atrito à toa: aqui ela digita.
  const faltaNumero = !!notaMarcadaEm && !autorizada && !informar?.ok;
  if (faltaNumero) {
    return (
      <form action={informarAcao} className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
        <input type="hidden" name="empenhoId" value={empenhoId} />
        <p className="text-xs font-semibold text-amber-900">Falta o número da nota</p>
        <p className="mt-0.5 text-xs text-amber-800">
          A nota está marcada como emitida em {notaMarcadaEm}, mas sem o número registrado.
          Informe abaixo — é o dado usado pra conferir com o banco e cobrar o órgão.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-slate-700">
            Número
            <input
              name="numeroNota"
              required
              maxLength={30}
              placeholder="ex.: 1042"
              className="mt-1 block w-32 rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Série <span className="font-normal text-slate-500">(opcional)</span>
            <input
              name="serieNota"
              maxLength={10}
              className="mt-1 block w-20 rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>
          <button
            type="submit"
            disabled={informando}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {informando ? "Salvando…" : "Salvar número"}
          </button>
        </div>
        {informar?.erro && <p className="mt-1.5 text-xs text-red-600">{informar.erro}</p>}
      </form>
    );
  }
  const processando = notas.find((n) => n.status === "PROCESSANDO");
  const ultimoErro = notas.find((n) => n.status === "ERRO");

  // ── Nota autorizada ───────────────────────────────────────────────────────
  // Só a NFS-e emitida PELO sistema encerra o painel: ela tem consulta,
  // cancelamento e link da prefeitura. Nota externa (anexada) segue no fluxo
  // normal, para caber outra ao lado — Igor 07/09.
  if (autorizada && autorizada.provedor !== "EXTERNA") {
    return (
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            NFS-e {autorizada.numero ?? ""} autorizada
          </span>
          {autorizada.ambiente === "HOMOLOGACAO" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              HOMOLOGAÇÃO · sem valor fiscal
            </span>
          )}
          {autorizada.pdfUrl && (
            <a
              href={autorizada.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </a>
          )}
          {autorizada.linkPrefeitura && (
            <a
              href={autorizada.linkPrefeitura}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ver na prefeitura
            </a>
          )}
          {podeCancelar && !cancelando && (
            <button
              type="button"
              onClick={() => setCancelando(true)}
              className="ms-auto text-xs text-slate-500 hover:text-red-700"
            >
              Cancelar nota
            </button>
          )}
        </div>

        {cancelando && (
          <form action={cancelar} className="mt-3 space-y-2 border-t border-emerald-200 pt-3">
            <input type="hidden" name="notaId" value={autorizada.id} />
            <label className="block text-xs font-semibold text-slate-700">
              Justificativa do cancelamento
              <textarea
                name="justificativa"
                rows={2}
                minLength={15}
                required
                placeholder="A prefeitura exige ao menos 15 caracteres explicando o motivo."
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />
            </label>
            {estadoCancel?.erro && <p className="text-xs text-red-600">{estadoCancel.erro}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={pendenteCancel}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pendenteCancel && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirmar cancelamento
              </button>
              <button
                type="button"
                onClick={() => setCancelando(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Voltar
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // ── Em processamento na prefeitura ────────────────────────────────────────
  if (processando) {
    return (
      <form action={consultar} className="mt-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
        <input type="hidden" name="notaId" value={processando.id} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-900">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Nota enviada — a prefeitura está processando.
          </span>
          <button
            type="submit"
            disabled={consultando}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${consultando ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
        {estadoConsulta?.mensagem && (
          <p className="mt-1.5 text-xs text-blue-900">{estadoConsulta.mensagem}</p>
        )}
        {estadoConsulta?.erro && <p className="mt-1.5 text-xs text-red-600">{estadoConsulta.erro}</p>}
      </form>
    );
  }

  // ── Sem nota ainda: pedir à contabilidade e depois anexar a que voltar ────
  //
  // Regina 28/08: o CP System não emite a nota — cuida de tudo em volta. Aqui a
  // pessoa copia os dados prontos pra contabilidade e, quando a nota volta,
  // anexa: o sistema lê número, data e valor.
  //
  // Igor 31/08: o texto dizia que o prazo do órgão passava a correr a partir da
  // nota anexada. Não é. O relógio do órgão só começa quando a NF é
  // ENCAMINHADA a ele — registrar a emissão aqui não cobra ninguém. Emitir e
  // esquecer de encaminhar é justamente o buraco caro que o sistema existe pra
  // fechar, e o texto antigo dava a entender que já estava resolvido.
  const painelDoCliente = (
    <div className="mt-2 space-y-2.5">
      {/* Igor 07/09: um empenho pode ter várias notas. A lista fica em cima e o
          campo de anexo continua disponível embaixo, para acrescentar mais. */}
      <ListaDeNotas notas={notas} podeCancelar={podeCancelar} />
      {notasRegistradas.length === 0 && (
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <p className="text-xs font-semibold text-slate-800">Ainda sem nota registrada</p>
        <p className="mt-0.5 text-xs text-slate-600">
          Peça a nota à sua contabilidade e anexe aqui quando ela voltar. Depois é só encaminhar
          a nota ao órgão e registrar esse envio — <strong>é dele que o prazo de pagamento
          começa a correr</strong>, não da emissão.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(blocoContabilidade);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              } catch {
                setCopiado(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-violet-400 hover:text-violet-700"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            {copiado ? "Copiado!" : "Copiar dados pra contabilidade"}
          </button>
        </div>
      </div>
      )}

      <form action={registrarAcao} className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
        <input type="hidden" name="empenhoId" value={empenhoId} />
        <p className="text-xs font-semibold text-slate-700">Anexar a nota emitida</p>
        <SoltarNotas registrando={registrando} />
        <p className="mt-1.5 text-[11px] text-slate-500">
          O sistema lê número, data e valor de cada nota sozinho. O que não conseguir ler fica em
          branco pra você completar — nota fiscal não se adivinha.
        </p>
        {registrar?.erro && <p className="mt-1.5 text-xs text-red-600">{registrar.erro}</p>}
        {registrar?.aviso && <p className="mt-1.5 text-xs text-amber-700">{registrar.aviso}</p>}
        <button
          type="submit"
          disabled={registrando}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {registrando && <Loader2 className="h-3 w-3 animate-spin" />}
          {registrando ? "Lendo as notas…" : "Registrar nota"}
        </button>
      </form>
    </div>
  );

  if (!emissaoLigada) return painelDoCliente;

  // ── Pronto pra emitir (só administração da plataforma) ────────────────────
  return (
    <div className="mt-2">
      {painelDoCliente}
      {(ultimoErro || estado?.erro) && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <div className="text-xs text-red-800">
            <p className="font-semibold">A nota não foi autorizada.</p>
            <p className="mt-0.5 whitespace-pre-wrap">
              {estado?.erro || ultimoErro?.mensagemErro}
            </p>
            <p className="mt-1 text-[11px] text-red-700">
              Recusa quase sempre é cadastro: confira item da lista de serviço, inscrição
              municipal e alíquota em{" "}
              <Link href="/conta/fiscal" className="font-semibold underline">
                Dados fiscais
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
        >
          <Receipt className="h-3.5 w-3.5" />
          {ultimoErro ? "Tentar emitir de novo" : "Emitir NF"}
        </button>
      ) : (
        <form action={emitir} className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
          <input type="hidden" name="empenhoId" value={empenhoId} />
          <p className="text-xs text-slate-700">
            Valor da nota:{" "}
            <strong>
              {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </strong>{" "}
            — somado dos itens do empenho.
          </p>

          <label className="block text-xs font-semibold text-slate-700">
            Descrição do serviço
            <textarea
              name="descricao"
              rows={3}
              placeholder="Deixe em branco pra usar o texto padrão + os itens do empenho."
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-700">
              Alíquota ISS (%)
              <input
                name="aliquotaIss"
                inputMode="decimal"
                placeholder="padrão"
                className="mt-1 w-24 rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            <label className="inline-flex items-center gap-2 pb-1.5 text-xs text-slate-700">
              <input
                type="checkbox"
                name="issRetido"
                className="h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              ISS retido pelo órgão
            </label>
          </div>

          {estado?.ok && estado.mensagem && (
            <p className="text-xs font-medium text-emerald-700">{estado.mensagem}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={emitindo}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {emitindo && <Loader2 className="h-3 w-3 animate-spin" />}
              {emitindo ? "Emitindo…" : "Confirmar e emitir"}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Campo de anexo das notas: arrastar e soltar, vários arquivos, e cada um
 * removível antes de enviar.
 *
 * Igor 07/09, três pedidos que são o mesmo campo:
 *   · "voltar o arrastar e soltar" — a função existia no anexo da etapa, mas
 *     aqui, no painel de notas, nunca houve: era um <input type="file"> cru;
 *   · "aceitar vários arquivos, sem limite" — entrega parcelada gera uma nota
 *     por entrega;
 *   · "poder retirar um arquivo já anexado" — errar o PDF acontece.
 *
 * O <input> real fica escondido e é alimentado por DataTransfer, para o form
 * continuar enviando os arquivos por `name="arquivo"` sem JavaScript de envio.
 * Assim o botão "Registrar nota" segue sendo um submit comum.
 */
function SoltarNotas({ registrando }: { registrando: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [recusados, setRecusados] = useState<string[]>([]);

  const TIPOS = ["application/pdf", "image/jpeg", "image/png"];
  const MAX = 25 * 1024 * 1024;

  function sincronizar(lista: File[]) {
    setArquivos(lista);
    if (inputRef.current) {
      const dt = new DataTransfer();
      for (const f of lista) dt.items.add(f);
      inputRef.current.files = dt.files;
    }
  }

  function acrescentar(novos: FileList | null) {
    if (!novos?.length) return;
    const recusa: string[] = [];
    const aceitos: File[] = [];
    for (const f of Array.from(novos)) {
      if (!TIPOS.includes(f.type)) { recusa.push(`${f.name} — só PDF, JPG ou PNG`); continue; }
      if (f.size > MAX) { recusa.push(`${f.name} — passa de 25 MB`); continue; }
      // Mesmo arquivo arrastado duas vezes não vira nota duplicada.
      if (arquivos.some((a) => a.name === f.name && a.size === f.size)) continue;
      aceitos.push(f);
    }
    setRecusados(recusa);
    if (aceitos.length) sincronizar([...arquivos, ...aceitos]);
  }

  function remover(i: number) {
    sincronizar(arquivos.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mt-1.5">
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); acrescentar(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-md border border-dashed px-3 py-3 transition ${
          arrastando
            ? "border-violet-500 bg-violet-100/70"
            : "border-violet-300 bg-white/70 hover:border-violet-400 hover:bg-violet-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <UploadCloud className={`h-4 w-4 shrink-0 ${arrastando ? "text-violet-700" : "text-violet-400"}`} />
          <p className="text-[11px] text-slate-600">
            {arrastando ? (
              <span className="font-medium text-violet-700">Solte as notas aqui</span>
            ) : (
              <>
                Arraste as notas <span className="text-slate-400">ou</span>{" "}
                <span className="font-medium text-violet-700">clique pra selecionar</span>
                <span className="ml-1 text-slate-400">· PDF, JPG ou PNG · até 25 MB cada</span>
              </>
            )}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="arquivo"
        multiple
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => acrescentar(e.target.files)}
      />

      {arquivos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {arquivos.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md border border-violet-200 bg-white px-2.5 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                <span className="truncate text-[11px] font-medium text-slate-800">{f.name}</span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {(f.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </span>
              <button
                type="button"
                disabled={registrando}
                onClick={(ev) => { ev.stopPropagation(); remover(i); }}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                title="Tirar este arquivo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li className="pt-0.5 text-[10px] text-slate-500">
            {arquivos.length} {arquivos.length === 1 ? "nota selecionada" : "notas selecionadas"}
          </li>
        </ul>
      )}

      {recusados.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {recusados.map((r) => (
            <li key={r} className="text-[11px] text-red-600">⚠ {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * As notas já guardadas no empenho, cada uma com o PDF e a opção de remover.
 *
 * Igor 07/09: "adicionar opção de retirar/remover um arquivo já anexado".
 * A remoção vale só para nota anexada (provedor EXTERNA). NFS-e emitida pelo
 * sistema existe na prefeitura — some daqui e o sistema passa a mostrar coisa
 * diferente do que o fisco tem. Essa se cancela, com justificativa.
 */
function ListaDeNotas({
  notas,
  podeCancelar,
}: {
  notas: NotaDoEmpenho[];
  podeCancelar: boolean;
}) {
  const [excluir, excluirAcao, excluindo] = useActionState<
    ResultadoNotaRegistrada | null,
    FormData
  >(excluirNotaRegistradaAction, null);

  const guardadas = notas.filter(
    (n) => n.status === "AUTORIZADA" || n.status === "PROCESSANDO",
  );
  if (guardadas.length === 0) return null;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
      <p className="text-xs font-semibold text-emerald-900">
        {guardadas.length === 1 ? "Nota registrada" : `${guardadas.length} notas registradas`}
      </p>
      <ul className="mt-2 space-y-1.5">
        {guardadas.map((n) => (
          <li
            key={n.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {n.numero ? `Nota nº ${n.numero}` : "Nota sem número informado"}
            </span>
            <span className="text-[11px] text-slate-500">
              {n.valorServicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            {n.ambiente === "HOMOLOGACAO" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                HOMOLOGAÇÃO · sem valor fiscal
              </span>
            )}
            {n.pdfUrl && (
              <a
                href={n.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </a>
            )}
            {n.linkPrefeitura && (
              <a
                href={n.linkPrefeitura}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Ver na prefeitura
              </a>
            )}
            {n.provedor === "EXTERNA" ? (
              <form
                action={excluirAcao}
                className="ms-auto"
                onSubmit={(e) => {
                  if (
                    !window.confirm(
                      "Remover esta nota do empenho? O arquivo anexado deixa de aparecer aqui.",
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="notaId" value={n.id} />
                <button
                  type="submit"
                  disabled={excluindo}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                  title="Remover esta nota"
                >
                  <X className="h-3.5 w-3.5" /> Remover
                </button>
              </form>
            ) : (
              podeCancelar && (
                <span className="ms-auto text-[10px] text-slate-400">
                  emitida pelo sistema — use “Cancelar nota”
                </span>
              )
            )}
          </li>
        ))}
      </ul>
      {excluir?.erro && <p className="mt-1.5 text-xs text-red-600">{excluir.erro}</p>}
    </div>
  );
}
