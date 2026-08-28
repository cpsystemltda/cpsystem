import Link from "next/link";
import { UserCog } from "lucide-react";

/**
 * Explica por que as telas pessoais ficam fora do modo de acompanhamento.
 *
 * Regina 28/08, vendo "Meus dados" enquanto acompanhava o espaço da MS Lucas:
 * a tela mostrava o nome e o e-mail do CP System — não os do cliente. E mostrava
 * um formulário editável.
 *
 * A causa: o acompanhamento troca a CONTA observada, não a pessoa logada. Então
 * "Meus dados" continuava sendo, corretamente, os dados de quem está operando —
 * só que exibidos ao lado dos dados da empresa do cliente, o que confunde
 * qualquer um. A gravação já era bloqueada; o que faltava era não oferecer.
 *
 * Mostrar os dados pessoais do cliente também não é opção: CPF e data de
 * nascimento dele não precisam ser vistos para acompanhar a operação da conta.
 */
export function PaginaPessoalNaEspionagem({ contaNome }: { contaNome: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-violet-100 text-violet-700">
          <UserCog className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Esta tela fica fora do acompanhamento
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
          Você está acompanhando o espaço de <strong>{contaNome}</strong>. As telas de dados
          pessoais, segurança e notificações são sempre da <strong>sua</strong> conta, não da conta
          acompanhada — mostrá-las aqui misturaria as duas coisas.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-xs text-slate-500">
          Para ver ou alterar seus próprios dados, saia do acompanhamento primeiro. Nada é gravado
          enquanto ele está ativo.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Voltar ao painel do cliente
        </Link>
      </div>
    </div>
  );
}
