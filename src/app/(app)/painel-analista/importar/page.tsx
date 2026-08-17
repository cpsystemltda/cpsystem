import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { ImportarClientesClient } from "./ImportarClientesClient";

// Importacao da carteira do analista por planilha (Regina 10/08). O analista ja
// tem os clientes numa planilha propria; redigitar um por um e o que trava a
// migracao pro sistema. Aqui ele sobe o arquivo como esta e a leitura por IA
// descobre o significado de cada coluna, perguntando o que ficar ambiguo.
export default async function ImportarClientesPage() {
  const usuario = await exigirUsuario();
  const analista = await prisma.analista.findFirst({
    where: { contaId: usuario.contaId },
    select: { id: true },
  });

  if (!analista) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">
          Esta tela é da conta de analista.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        eyebrow="Carteira"
        titulo="Importe sua"
        destaque="planilha de clientes"
        subtitulo="Suba a planilha que você já usa. O sistema lê, entende as colunas sozinho e pergunta o que não ficar claro — você confere tudo antes de qualquer coisa ser criada."
      />
      <ImportarClientesClient />
    </div>
  );
}
