import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "API do CP System — documentação" };

/**
 * Documentação pública da API v1 do CP System (pedido do Léo/Green,
 * 06/11/2026). Escrita para quem vai programar a integração.
 */

function Bloco({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{children}</pre>;
}

function Endpoint({ metodo, caminho, escopo, children }: { metodo: string; caminho: string; escopo: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="font-mono text-base font-bold text-slate-900">
        <span className={`mr-2 rounded px-2 py-0.5 text-xs text-white ${metodo === "GET" ? "bg-emerald-600" : "bg-violet-600"}`}>{metodo}</span>
        {caminho}
      </h3>
      <p className="mt-1 text-xs text-slate-500">Escopo: {escopo}</p>
      <div className="mt-3 space-y-3 text-sm text-slate-700">{children}</div>
    </section>
  );
}

export default function DesenvolvedoresPage() {
  const base = "https://cpsystem.app.br/api/v1";
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <Link href="/" className="text-sm text-slate-600 hover:underline">
          cpsystem.app.br
        </Link>
      </div>
      <h1 className="mt-8 text-3xl font-bold text-slate-900">API do CP System</h1>
      <p className="mt-2 text-slate-600">Versão 1. Para o sistema interno da sua empresa ler as execuções e a agenda de eventos e registrar os pagamentos recebidos.</p>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Autenticação</h2>
      <p className="mt-2 text-sm text-slate-700">
        O administrador da conta gera o token em <strong>Conta › Integrações › API do CP System</strong>. Envie-o em todas as chamadas no cabeçalho <code>Authorization</code>. O token aparece uma única vez; se perder, revogue e gere outro.
      </p>
      <Bloco>{`curl ${base}/status \\
  -H "Authorization: Bearer cps_live_SEU_TOKEN"`}</Bloco>
      <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
        <li>Respostas em JSON (UTF-8). Datas no formato AAAA-MM-DD; carimbos de tempo em ISO 8601 (UTC).</li>
        <li>Limite: 120 chamadas por minuto por token (acima disso, HTTP 429).</li>
        <li>Erros: <code>{`{"erro": {"codigo": "...", "mensagem": "..."}}`}</code> com HTTP 400, 401, 403, 404, 422 ou 429.</li>
        <li>Escopos: <strong>leitura</strong> (todos os GET) e <strong>pagamentos:escrita</strong> (registrar pagamento).</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Endpoints</h2>

      <Endpoint metodo="GET" caminho="/api/v1/status" escopo="leitura">
        <p>Confere o token. Devolve as empresas (CNPJs) da conta e os escopos.</p>
      </Endpoint>

      <Endpoint metodo="GET" caminho="/api/v1/eventos" escopo="leitura">
        <p>Agenda das execuções (fornecimentos e serviços), na mesma janela da agenda do CP System. Use para alimentar a agenda do seu sistema.</p>
        <p>
          Parâmetros: <code>de</code> e <code>ate</code> (AAAA-MM-DD; padrão: hoje −30 a +90 dias; máximo 366 dias).
        </p>
        <Bloco>{`curl "${base}/eventos?de=2026-11-01&ate=2026-12-31" -H "Authorization: Bearer cps_live_..."

{
  "dados": [{
    "id": "execucao-cmw...", "execucaoId": "cmw...",
    "titulo": "2026NE000518 — Prefeitura de ...",
    "descricao": "Locação de som e palco",
    "inicio": "2026-11-20", "fim": "2026-11-21",
    "horaInicio": "18:00", "horaFim": "23:00", "diaInteiro": false,
    "status": "EMPENHADO", "pago": false, "valorTotal": 32232.00,
    "empresa": "Green Entretenimento", "url": "https://cpsystem.app.br/execucao/cmw..."
  }],
  "de": "2026-11-01", "ate": "2026-12-31", "total": 1
}`}</Bloco>
      </Endpoint>

      <Endpoint metodo="GET" caminho="/api/v1/execucoes" escopo="leitura">
        <p>Execuções (empenhos, ordens de fornecimento e de serviço) com itens, valores e todas as datas do ciclo: emissão, prazo de entrega, entrega, nota fiscal e pagamento.</p>
        <p>
          Parâmetros: <code>status</code> (EMPENHADO, PEDIDO_RECEBIDO, EM_TRANSITO, ENTREGUE, NF_EMITIDA, NF_ENCAMINHADA, PAGO), <code>pago</code> (true/false), <code>emitidasDesde</code>, <code>emitidasAte</code>, <code>atualizadasDesde</code> (para sincronizar só o que mudou), <code>pagina</code>, <code>porPagina</code> (até 200).
        </p>
        <Bloco>{`curl "${base}/execucoes?pago=false&porPagina=100" -H "Authorization: Bearer cps_live_..."`}</Bloco>
        <p>
          Cada item traz <code>id</code>, <code>numero</code>, <code>status</code>, <code>pago</code>, <code>valorTotal</code>, <code>orgao</code>, <code>empresa</code>, <code>contrato</code>/<code>ata</code> de origem, <code>datas</code> e <code>itens</code> (descrição, unidade, quantidade, valor unitário e total).
        </p>
      </Endpoint>

      <Endpoint metodo="GET" caminho="/api/v1/execucoes/{id}" escopo="leitura">
        <p>Uma execução, no mesmo formato da lista.</p>
      </Endpoint>

      <Endpoint metodo="POST" caminho="/api/v1/execucoes/{id}/pagamento" escopo="pagamentos:escrita">
        <p>Registra o pagamento (baixa) da execução — o mesmo que marcar “Pago” na tela: a execução vai para PAGO com a data informada e o histórico registra que veio da API. Repetir a chamada numa execução já paga não muda nada (devolve <code>jaEstavaPago: true</code>).</p>
        <Bloco>{`curl -X POST "${base}/execucoes/cmw.../pagamento" \\
  -H "Authorization: Bearer cps_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"data": "2026-11-09", "observacao": "Crédito conferido no extrato"}'

{ "ok": true, "execucaoId": "cmw...", "status": "PAGO", "jaEstavaPago": false }`}</Bloco>
      </Endpoint>

      <Endpoint metodo="GET" caminho="/api/v1/contratos" escopo="leitura">
        <p>Contratos da conta (resumo). <code>vigentes=true</code> traz só os em vigência.</p>
      </Endpoint>

      <Endpoint metodo="GET" caminho="/api/v1/atas" escopo="leitura">
        <p>Atas de registro de preços com os itens. <code>vigentes=true</code> traz só as em vigência.</p>
      </Endpoint>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Boas práticas</h2>
      <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
        <li>Sincronize a cada 15 minutos ou mais, usando <code>atualizadasDesde</code> com a data da última sincronização.</li>
        <li>Guarde o token no servidor do seu sistema, nunca no navegador ou no aplicativo do celular.</li>
        <li>Dúvidas: contato@cpsystem.app.br ou WhatsApp (11) 97061-9434.</li>
      </ul>
    </div>
  );
}
