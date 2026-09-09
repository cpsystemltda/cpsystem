import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { ListaProspeccao, type LeadNaTela } from "@/components/ListaProspeccao";
import { Phone, Target, BookOpen, MessageSquare, ShieldQuestion } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Prospecção ativa — o manual da closer e a lista que ela trabalha.
 *
 * Regina 08/09: "eu não quero um link de Claude, porque ela nem Claude usa;
 * tem que ser um link que ela consegue acompanhar do computador dela". Então a
 * peça mora aqui dentro, com o login do próprio CP System, e o andamento fica
 * no banco — Regina e Igor abrem a mesma tela e veem o que ela marcou, ao vivo,
 * sem pedir relatório.
 *
 * Acesso: equipe do CP System. Para a closer, cadastre como colaboradora da
 * conta interna marcando só o módulo "Prospecção" — assim ela vê esta tela e
 * nenhum dado de cliente.
 */
export default async function ProspeccaoPage() {
  const usuario = await exigirUsuario();

  const contaInterna = await prisma.conta.findFirst({
    where: { id: usuario.contaId, usuarios: { some: { superAdmin: true } } },
    select: { id: true },
  });
  // A closer trabalha com o mesmo login que usa pra demonstrar (Regina 08/09),
  // então a conta de demonstração também entra aqui.
  const liberado =
    usuario.superAdmin ||
    usuario.email === "demonstracao@cpsystem.app.br" ||
    (!!contaInterna &&
      (!usuario.acessoRestrito || usuario.modulosPermitidos.includes("PROSPECCAO")));
  if (!liberado) redirect("/dashboard");

  const leads = await prisma.leadProspeccao.findMany({ orderBy: { venceEm: "asc" } });

  // "Se a pessoa já está no trial" (Regina 08/09) não precisa ser marcado à
  // mão: o CNPJ do lead é o mesmo da empresa quando ela se cadastra. Cruzamos
  // aqui e a coluna se preenche sozinha — closer não erra e ninguém liga
  // oferecendo teste pra quem já entrou.
  const cnpjs = leads.map((l) => l.cnpj);
  const jaNoSistema = cnpjs.length
    ? await prisma.empresa.findMany({
        where: { cnpj: { in: cnpjs } },
        select: {
          cnpj: true,
          conta: { select: { statusAssinatura: true, trialAteEm: true } },
        },
      })
    : [];
  const situacaoNoSistema = new Map(
    jaNoSistema.map((e) => [
      e.cnpj,
      e.conta.statusAssinatura === "TRIAL"
        ? ("TRIAL" as const)
        : e.conta.statusAssinatura === "ATIVA"
          ? ("CLIENTE" as const)
          : ("OUTRO" as const),
    ]),
  );

  const naTela: LeadNaTela[] = leads.map((l) => ({
    id: l.id,
    empresa: l.empresa,
    uf: l.uf,
    telefone: l.telefone,
    email: l.email,
    venceEm: l.venceEm.toISOString(),
    valorDoContrato: l.valorDoContrato,
    valorTotal: l.valorTotal,
    qtdContratos: l.qtdContratos,
    perfil: l.perfil,
    alvoIdeal: l.alvoIdeal,
    situacao: l.situacao,
    anotacoes: l.anotacoes,
    atualizadoPorNome: l.atualizadoPorNome,
    atualizadoEm: l.atualizadoEm.toISOString(),
    dataPrimeiroContato: l.dataPrimeiroContato?.toISOString() ?? null,
    dataUltimoContato: l.dataUltimoContato?.toISOString() ?? null,
    teveRetorno: l.teveRetorno,
    retornarEm: l.retornarEm?.toISOString() ?? null,
    contatoNome: l.contatoNome,
    noSistema: situacaoNoSistema.get(l.cnpj) ?? null,
  }));

  const feitas = leads.filter((l) => l.situacao !== "NAO_CONTATADO").length;
  const demos = leads.filter((l) => l.situacao === "DEMONSTRACAO_MARCADA").length;
  const clientes = leads.filter((l) => l.situacao === "CLIENTE").length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
        Uso interno · Prospecção ativa
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
        Manual do Closer
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Cada empresa desta lista tem um contrato público com data de vencimento marcada, tirada do
        portal oficial. Você não liga para oferecer um sistema — liga para avisar de um prazo.
      </p>

      {/* Placar */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Empresas", leads.length],
          ["Contatadas", feitas],
          ["Demonstrações", demos],
          ["Clientes", clientes],
        ].map(([rot, n]) => (
          <div key={String(rot)} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-2xl font-extrabold tabular-nums text-blue-700">{n as number}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rot as string}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${leads.length ? Math.round((feitas / leads.length) * 100) : 0}%` }}
        />
      </div>

      {/* ── 1 · O produto ───────────────────────────────────────────────── */}
      <Secao icone={<BookOpen className="h-4 w-4" />} titulo="1 · O que é a CP System">
        <p className="text-sm text-slate-700">
          Sistema para <strong>empresas que vendem para o governo</strong>. Cuida do que acontece{" "}
          <strong>depois</strong> que a empresa ganha a licitação — que é onde o dinheiro se perde.
          Ganhar todo mundo acompanha; o que quase ninguém controla é a execução.
        </p>

        <h3 className="mt-5 text-sm font-bold text-slate-800">Os cinco jeitos de perder dinheiro que a gente evita</h3>
        <p className="text-[13.5px] text-slate-600">
          Decore estes cinco. São eles que você usa na ligação, não a lista de funcionalidades.
        </p>
        <ol className="mt-2 space-y-2 text-[13.5px] text-slate-700">
          <li><strong>1. O prazo de prorrogação passa.</strong> O contrato encerra e a empresa precisa disputar tudo de novo, do zero. É a perda mais cara e a mais silenciosa.</li>
          <li><strong>2. A entrega atrasa.</strong> Vira multa de até 10% do contrato e, na reincidência, penalidade que impede de participar de novas licitações.</li>
          <li><strong>3. A entrega é feita e a nota não sai.</strong> Dinheiro entregue que não pode nem ser cobrado.</li>
          <li><strong>4. A nota sai e ninguém encaminha ao órgão.</strong> O prazo de pagamento nem começou a correr — e a empresa acha que o órgão está atrasado.</li>
          <li><strong>5. Sobra saldo na ata.</strong> Receita que estava disponível e ninguém executou até a vigência acabar.</li>
        </ol>

        <h3 className="mt-5 text-sm font-bold text-slate-800">O nível de controle que ele passa a ter</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            ["Todos os CNPJs numa tela só", "Grupo com várias empresas vê o consolidado ou filtra por CNPJ."],
            ["Cada contrato com data e responsável", "Some a dependência de “o fulano sabe”."],
            ["Saldo em tempo real", "Quanto de cada ata e contrato já foi executado e quanto falta."],
            ["Cada empenho rastreado ponta a ponta", "Pedido, entrega, nota emitida, nota encaminhada, pago."],
            ["Histórico completo", "Quem registrou o quê e quando. Serve para auditoria e para cobrar internamente."],
            ["Documentos anexados no lugar certo", "Empenho, nota e comprovante ficam no próprio registro, não no e-mail de alguém."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[13.5px] font-bold text-slate-900">{t}</p>
              <p className="text-[12.5px] text-slate-600">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-bold text-emerald-900">O argumento mais forte: os avisos no WhatsApp</p>
          <p className="mt-1 text-[13.5px] text-emerald-900">
            <strong>A pessoa não precisa entrar no sistema para ser protegida.</strong> O aviso chega
            no celular dela, no número dela, antes do prazo. Essa é a diferença entre a CP System e
            uma planilha caprichada — planilha registra, mas não avisa.
          </p>
          <p className="mt-2 text-[13px] text-emerald-900">O que chega por WhatsApp, sozinho:</p>
          <ul className="mt-1 space-y-1 text-[13px] text-emerald-900">
            <li>▸ Contrato ou ata se aproximando do fim da vigência</li>
            <li>▸ Entrega com prazo vencendo, e entrega vencida</li>
            <li>▸ Nota emitida há mais de 30 dias sem o órgão pagar, com o valor</li>
            <li>▸ Saldo de ata baixo, antes de a oportunidade acabar</li>
            <li>▸ Resumo semanal da operação, toda segunda</li>
            <li>▸ Alerta de segurança quando alguém entra na conta de um aparelho novo</li>
          </ul>
          <p className="mt-2 text-[12.5px] text-emerald-800">
            Na ligação: <em>“o senhor não precisa lembrar de nada, nem abrir o sistema. Ele te avisa
            no WhatsApp antes de virar problema.”</em>
          </p>
        </div>

        <h3 className="mt-5 text-sm font-bold text-slate-800">O que cada aba faz</h3>
        <div className="rolar mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Aba</th><th className="px-3 py-2.5">O que ela resolve</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {[
                ["Dashboard", "A primeira tela: tudo que vence nos próximos dias, o que está atrasado e quanto há a receber. É por aqui que a demonstração começa."],
                ["Empresas (CNPJs)", "Cadastro dos CNPJs do grupo. Quem tem várias empresas alterna entre elas ou vê o consolidado."],
                ["Atas de Registro de Preços", "Ata, itens, órgãos participantes e — o que mais importa — o saldo por vigência: quanto ainda pode ser executado de cada item."],
                ["Contratos", "Vigência, prorrogação, aditivos, apostilamentos, reajuste e garantia. Avisa antes de a janela de prorrogação fechar."],
                ["Fornecimento/Execução", "O coração do sistema. Cada empenho anda por etapas: pedido recebido, em trânsito, entregue, nota emitida, nota encaminhada, pago. Cada etapa com data e documento anexado."],
                ["Controle de notas", "Toda entrega concluída que ainda está sem nota, com o valor que não pode ser cobrado. E as notas emitidas que o órgão ainda não pagou."],
                ["Consultoria jurídica", "Dúvida sobre a Lei 14.133 respondida por IA dentro do sistema, com o contexto dos contratos da empresa. Intermediário e Premium."],
                ["Conciliação bancária", "O cliente manda o extrato em PDF — pelo sistema ou pelo WhatsApp — e o sistema cruza com o que está em aberto, apontando o que já foi pago. Intermediário e Premium."],
                ["Relatórios", "Relatórios gerenciais e exportação, para prestação de contas e reunião de sócios."],
                ["Notificações WhatsApp", "Onde ele escolhe o número e quais avisos quer receber."],
              ].map(([aba, faz]) => (
                <tr key={aba} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{aba}</td>
                  <td className="px-3 py-2.5">{faz}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-5 text-sm font-bold text-slate-800">Perguntas que o cliente faz e você precisa responder na hora</h3>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-slate-700">
          <li><strong>“Precisa instalar?”</strong> Não. Funciona no navegador, e dá para instalar como aplicativo no celular.</li>
          <li><strong>“Quantas pessoas podem usar?”</strong> Dois colaboradores inclusos em qualquer plano; do terceiro em diante, R$ 10,90 cada. E dá para escolher o que cada um enxerga — o financeiro pode ficar só com o dono.</li>
          <li><strong>“Meus dados ficam seguros?”</strong> Cada empresa só enxerga os próprios dados, arquivos não ficam em endereço público, acesso com senha e verificação em duas etapas disponível.</li>
          <li><strong>“Preciso digitar tudo?”</strong> Não. Ele anexa o PDF da ata, do contrato ou da nota e o sistema lê número, datas, valores e itens sozinho. O que não conseguir ler fica em branco para completar.</li>
          <li><strong>“E se eu quiser sair?”</strong> Sem fidelidade. Cancela quando quiser e os dados podem ser exportados.</li>
          <li><strong>“Serve para quem vende para prefeitura pequena?”</strong> Serve. O que muda é o órgão, não a regra — a Lei 14.133 é a mesma.</li>
        </ul>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[13px] text-amber-900">
          <p className="font-semibold">Três coisas para não prometer errado:</p>
          <p className="mt-1">
            <strong>O sistema não emite a nota fiscal do cliente</strong> — a emissão fica no emissor
            fiscal dele, por decisão de risco: envolve certificado digital e regra que muda por
            município, e quem responde perante o fisco é a empresa dele. (Atenção: a CP System,
            como empresa, <strong>emite sim</strong> a nota da assinatura para quem assina.) <strong>Não somos portal de licitação</strong> —
            não avisamos de edital nem ajudamos a disputar; começamos depois que ele ganhou.{" "}
            <strong>Não substituímos o contador</strong> — ele cuida do fiscal, que vem depois; nós
            cuidamos do prazo e da execução, que vêm antes.
          </p>
        </div>
      </Secao>

      {/* ── 2 · Planos ──────────────────────────────────────────────────── */}
      <Secao icone={<Target className="h-4 w-4" />} titulo="2 · Qual plano oferecer">
        <p className="text-sm text-slate-700">
          O que decide o plano não é o tamanho da empresa — é <strong>quantos CNPJs</strong> ela tem
          e <strong>se ela precisa de conciliação bancária</strong>.
        </p>

        <div className="mt-4 space-y-3">
          <Plano
            nome="Básico"
            preco="R$ 397"
            para="Um CNPJ só. O dono que controla tudo na planilha e quer parar de perder prazo."
            tem={[
              "Atas, contratos e empenhos com prazo acompanhado",
              "Controle de notas e avisos por WhatsApp",
              "CNPJ adicional: R$ 39,90 cada",
            ]}
            naoTem={["Sem conciliação bancária", "Sem nenhuma consulta de IA jurídica"]}
          />
          <Plano
            destaque
            nome="Intermediário"
            preco="R$ 697"
            para="O padrão para quem tem faturamento. É aqui que a conversa deve começar."
            tem={[
              "Três CNPJs inclusos (adicional R$ 39,90)",
              "Conciliação bancária — extrato em PDF, pelo sistema ou pelo WhatsApp, cruzado com o que está em aberto",
              "10 consultas de IA jurídica por mês sobre a Lei 14.133",
            ]}
            gancho="“O senhor me disse que não sabe quais notas já foram pagas. É exatamente isso que a conciliação resolve — e ela começa no Intermediário.”"
          />
          <Plano
            nome="Premium"
            preco="R$ 997"
            para="Grupo com vários CNPJs, ou quem consulta a parte jurídica com frequência."
            tem={["CNPJs ilimitados", "IA jurídica ilimitada", "Franquia de consultoria jurídica"]}
            gancho="“A partir de cinco CNPJs o Premium sai mais barato que o Intermediário com adicionais.” — e é verdade: 3 CNPJs a mais no Intermediário já dão R$ 816."
          />
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-700">
          <strong>Vale em qualquer plano:</strong> dois colaboradores inclusos, e do terceiro em
          diante R$ 10,90 cada. Derruba a objeção “mas minha equipe toda vai precisar acessar”.
          E o <strong>teste de 14 dias</strong> é o sistema inteiro liberado, sem cartão — é a sua
          principal ferramenta de fechamento.
        </div>
      </Secao>

      {/* ── 3 · Abordagem ───────────────────────────────────────────────── */}
      <Secao icone={<Phone className="h-4 w-4" />} titulo="3 · A abordagem">
        <p className="text-sm text-slate-700">
          A abertura nunca é sobre nós — é sobre <strong>o contrato dele</strong>. Quem começa se
          apresentando e falando da empresa vira telemarketing em cinco segundos.
        </p>
        <Fala titulo="Os primeiros 20 segundos">
          Bom dia, falo com o responsável pelos contratos com o governo?
          <br />
          <br />
          Aqui é [seu nome], da CP System, de Brasília. Não é venda por telefone, é um aviso rápido:
          consultando o Portal Nacional de Contratações Públicas, o{" "}
          <strong>contrato (ou ata de registro de preços)</strong> de vocês com o{" "}
          <strong>[órgão]</strong> tem vigência até <strong>[data]</strong> — faltam{" "}
          <strong>[N] dias</strong>.
        </Fala>

        <div className="mt-3 rounded-lg border border-red-200 bg-red-50/70 p-3 text-[13px] text-red-900">
          <p className="font-semibold">
            Não pergunte “a prorrogação já está encaminhada?” logo de cara — Igor, 08/09
          </p>
          <p className="mt-1">
            <strong>Nem todo contrato ou ata pode ser prorrogado.</strong> Perguntar isso de
            imediato, sem saber o caso, denuncia desconhecimento do assunto para quem vive disso —
            e você perde a autoridade que a ligação tinha ganhado no primeiro parágrafo.
          </p>
        </div>

        <h3 className="mt-4 text-sm font-bold text-slate-800">Depois da abertura, escolha uma destas</h3>
        <p className="text-[13.5px] text-slate-700">
          Todas são seguras: valem para contrato e para ata, e nenhuma pressupõe nada.
        </p>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-slate-700">
          <li>• Quantos outros contratos ou atas de vocês vencem nos próximos 60 dias?</li>
          <li>• Todo o quantitativo desse contrato (ou dessa ata) já foi executado?</li>
          <li>• Quanto falta executar?</li>
          <li>• Essa ata de registro de preços será prorrogada?</li>
        </ul>
        <p className="mt-2 text-[13px] text-slate-600">
          Repare que a última pergunta continua existindo — a diferença é que ela vem{" "}
          <strong>depois</strong>, como pergunta, e não como suposição na abertura.
        </p>
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50/70 p-3 text-[13px] text-red-900">
          <strong>Nunca invente um dado do contrato.</strong> Sem certeza do órgão, do valor ou da
          data, não fale. Se ele disser que está errado:{" "}
          <em>
            “pode ser que o portal esteja desatualizado, é dado público. Justamente por isso liguei —
            o senhor tem esse controle em algum lugar?”
          </em>
        </div>

        <h3 className="mt-5 text-sm font-bold text-slate-800">Quem procurar</h3>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-slate-700">
          <li>• <strong>Micro e pequeno porte:</strong> o dono. Decide na hora.</li>
          <li>• <strong>Média com estrutura:</strong> gerente de contratos ou de licitações.</li>
          <li>• <strong>Construtora:</strong> engenheiro responsável ou administrativo de obras.</li>
          <li>• <strong>Eventos:</strong> o produtor, que costuma ser o dono.</li>
        </ul>
        <p className="mt-2 text-[13px] text-slate-600">
          Nunca aceite “manda por e-mail que eu repasso” da recepção. Peça o nome e o horário. Antes
          das 9h e depois das 17h costuma cair direto com quem decide.
        </p>

        <h3 className="mt-5 text-sm font-bold text-slate-800">A descoberta</h3>
        <p className="text-[13.5px] text-slate-700">
          Use três ou quatro perguntas e <strong>pare na primeira que ele não souber responder</strong> —
          essa é a dor, e é sobre ela que a demonstração vai ser.
        </p>
        <ol className="mt-2 space-y-1 text-[13.5px] text-slate-700">
          {[
            "Quantas atas e contratos vocês têm hoje com o poder público?",
            "Quanto eles somam?",
            "Quanto já foi executado e quanto falta?",
            "Quantos vencem nos próximos 60 dias?",
            "Qual a agenda de entrega deste mês?",
            "Quantas notas emitidas ainda não foram pagas?",
            "Qual foi o faturamento do trimestre passado?",
          ].map((p, i) => (
            <li key={p}>
              <span className="font-mono text-xs font-bold text-blue-700">{i + 1}.</span> {p}
            </li>
          ))}
        </ol>
      </Secao>

      {/* ── 4 · Objeções ────────────────────────────────────────────────── */}
      <Secao icone={<ShieldQuestion className="h-4 w-4" />} titulo="4 · As objeções">
        <Objecao
          p="“Onde vocês conseguiram meus dados?”"
          r="No Portal Nacional de Contratações Públicas, o portal oficial do governo. Todo contrato com o poder público é público por lei. Seu telefone veio do cadastro da Receita. Se preferir não receber mais contato, retiro agora da lista."
          nota="A mais importante. Hesitar aqui mata a venda."
        />
        <Objecao
          p="“Controlo em planilha.” / “Meu contador cuida.”"
          r="Planilha resolve o registro. O que ela não faz é avisar: não te liga faltando 30 dias para a prorrogação. E o contador cuida do fiscal, que é depois — quando chega nele, o prazo já passou."
          nota="Nunca diga que a planilha é ruim: ele fez a planilha."
        />
        <Objecao
          p="“Quanto custa?”"
          r="São R$ 397, R$ 697 ou R$ 997 por mês, conforme CNPJs e módulos, com 14 dias gratuitos antes de qualquer cobrança. Mas antes do plano: aquele contrato de [R$ valor] que vence em [N] dias — se não for prorrogado, quanto custa para vocês?"
          nota="Se pergunta cedo, ainda não viu valor. Ancore e volte para a dor."
        />
        <Objecao
          p="“É caro.”"
          r="R$ 397 por mês são cerca de R$ 13 por dia. O contrato que a gente falou é de [R$ valor]. Um único prazo perdido paga o sistema por muitos anos."
          nota="Compare com a perda, nunca com outro software."
        />
        <Objecao
          p="“Já uso um sistema.”"
          r="Qual vocês usam? … E ele avisa quando a vigência está acabando, ou controla o saldo que ainda pode ser executado na ata? A maioria cuida do financeiro, que é depois da entrega."
          nota="Descubra qual antes de comparar."
        />
        <Objecao
          p="“Vocês emitem nota fiscal?”"
          r="Antes de responder, descubra qual das duas ele está perguntando — são coisas diferentes e a resposta muda (Igor, 08/09). Pergunte: “o senhor diz emitir a nota dos SEUS contratos, ou a nota da assinatura do CP System?”"
          nota="A pergunta tem dois sentidos. Responder o errado passa informação falsa."
        />
        <div className="-mt-1 mb-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5">
            <p className="text-[13px] font-bold text-red-900">
              “O sistema emite a nota da MINHA empresa depois da execução?”
            </p>
            <p className="mt-1 text-[13px] font-bold text-red-900">NÃO.</p>
            <p className="mt-1 text-[13px] text-red-900">
              A emissão continua no emissor fiscal da empresa dele. É decisão nossa: envolve
              certificado digital e regra que muda de município para município, e quem responde
              perante o fisco é a empresa dele — não colocamos cliente nesse risco.
            </p>
            <p className="mt-1.5 text-[13px] text-red-900">
              O que fazemos é o controle em volta: apontamos toda entrega concluída sem nota, ele
              registra a nota, e a partir do <strong>encaminhamento dela ao órgão</strong> contamos
              o prazo de pagamento e avisamos quando o órgão atrasa.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
            <p className="text-[13px] font-bold text-emerald-900">
              “A CP System me dá nota fiscal da mensalidade?”
            </p>
            <p className="mt-1 text-[13px] font-bold text-emerald-900">SIM.</p>
            <p className="mt-1 text-[13px] text-emerald-900">
              A CP System emite nota fiscal da assinatura para todo cliente da plataforma,
              normalmente, como qualquer fornecedor.
            </p>
            <p className="mt-1.5 text-[13px] text-emerald-900">
              Vale dizer isso sem ser perguntada quando o cliente for empresa que precisa lançar a
              despesa — tira uma dúvida antes que ela vire objeção.
            </p>
          </div>
        </div>
        <Objecao
          p="“Me manda por e-mail.”"
          r="Mando agora. Só que e-mail não mostra o que interessa, que é como ficariam os contratos de vocês dentro do sistema. São 15 minutos — amanhã de manhã ou no fim da tarde?"
          nota="Aceitar sem marcar horário é perder o lead."
        />
      </Secao>

      {/* ── 5 · Fechamento ──────────────────────────────────────────────── */}
      <Secao icone={<MessageSquare className="h-4 w-4" />} titulo="5 · O fechamento">
        <p className="text-sm text-slate-700">
          O objetivo da ligação é <strong>uma demonstração marcada com data e hora</strong>, não uma
          assinatura. Quem tenta fechar no telefone assusta e perde as duas coisas.
        </p>
        <Fala titulo="Como marcar">
          Separo 15 minutos e mostro com <strong>os contratos da sua empresa</strong>, não com
          exemplo genérico. Amanhã às 10h ou quinta às 15h?
        </Fala>
        <p className="mt-3 text-[13.5px] text-slate-700">
          Duas opções de horário, nunca “quando você puder”. Antes de desligar: confirme o WhatsApp e
          mande o convite na hora, confirme quem mais participa, e repita o prazo — “não esquece do
          contrato que vence em [N] dias”. É o que faz ele aparecer.
        </p>
        <Fala titulo="Depois da demonstração">
          Libero seu acesso hoje: 14 dias com tudo liberado e sem cobrança. Você cadastra os
          contratos que estão vencendo e vê funcionando. Se não servir, é só não continuar.
        </Fala>
        <p className="mt-3 text-[13.5px] text-slate-700">
          Peça o CNPJ e o e-mail <strong>ainda na chamada</strong> e libere o acesso enquanto ele
          está online. Trial que fica para depois não é aberto.
        </p>
      </Secao>

      {/* ── 6 · Demonstração e vídeos ───────────────────────────────────── */}
      <Secao icone={<Target className="h-4 w-4" />} titulo="6 · O que mostrar ao cliente">
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <p className="text-sm font-bold text-violet-900">Conta de demonstração</p>
          <p className="mt-1 text-[13.5px] text-violet-900">
            Use <strong>sempre esta conta</strong> para mostrar o sistema — nunca a de um cliente
            real. Ela é a <strong>Construtora Modelo</strong>, uma empresa fictícia com a operação
            inteira preenchida: uma ata com saldo parcial, dois contratos (um vencendo em 28 dias) e
            cinco empenhos parados em etapas diferentes.
          </p>
          <p className="mt-2 text-[13px] text-violet-900">
            Cada dor que você cita na ligação tem uma linha lá para mostrar: um empenho aguardando
            entrega, um em trânsito, <strong>um entregue e sem nota emitida</strong>, um com nota
            encaminhada e o órgão em atraso, e um pago.
          </p>
          <p className="mt-2 text-[12.5px] text-violet-800">
            O acesso da demonstração é entregue à parte, junto com o seu login. Peça à Regina se não
            tiver recebido.
          </p>
        </div>

        <h3 className="mt-5 text-sm font-bold text-slate-800">O roteiro da tela, em 3 passos</h3>
        <ol className="mt-2 space-y-2 text-[13.5px] text-slate-700">
          <li>
            <strong>1. O painel.</strong> “É o que a sua empresa veria hoje: tudo que vence nos
            próximos dias numa tela só. E o aviso chega no seu WhatsApp antes.”
          </li>
          <li>
            <strong>2. A execução de um empenho.</strong> Abra o que está entregue sem nota. “Aqui é
            onde o dinheiro trava: você entregou, mas não pode cobrar.”
          </li>
          <li>
            <strong>3. O saldo da ata.</strong> “Quanto ainda pode ser executado. É a pergunta que
            ninguém responde de cabeça e que deixa receita na mesa.”
          </li>
        </ol>

        <h3 className="mt-5 text-sm font-bold text-slate-800">Vídeos da CP System</h3>
        <p className="text-[13px] text-slate-600">
          Para mandar por WhatsApp depois da ligação, ou mostrar durante a conversa.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {["DdBowbUmK3M", "DcwhhLrBlqj", "DcMsvdTBl1O"].map((codigo) => (
            <div key={codigo} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <iframe
                src={`https://www.instagram.com/reel/${codigo}/embed`}
                title={`Vídeo CP System ${codigo}`}
                loading="lazy"
                className="h-[420px] w-full border-0"
                allowFullScreen
              />
              <a
                href={`https://www.instagram.com/reel/${codigo}/`}
                target="_blank"
                rel="noreferrer"
                className="block border-t border-slate-200 px-3 py-2 text-center text-[12px] font-semibold text-blue-700 hover:bg-blue-50"
              >
                Abrir no Instagram para compartilhar
              </a>
            </div>
          ))}
        </div>
      </Secao>

      {/* ── 7 · Lista ───────────────────────────────────────────────────── */}
      <Secao icone={<Phone className="h-4 w-4" />} titulo="7 · A lista de ligações">
        <p className="mb-4 text-[13.5px] text-slate-600">
          Marque a situação e anote o que foi dito — salva sozinho. As primeiras vencem nesta
          semana: para essas, a ligação é hoje.
        </p>
        <ListaProspeccao leads={naTela} />
      </Secao>
    </div>
  );
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        {icone} {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Plano({
  nome,
  preco,
  para,
  tem,
  naoTem,
  gancho,
  destaque,
}: {
  nome: string;
  preco: string;
  para: string;
  tem: string[];
  naoTem?: string[];
  gancho?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque ? "border-blue-300 bg-blue-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-mono text-xl font-extrabold text-blue-700">{preco}</span>
        <span className="text-[15px] font-bold text-slate-900">{nome}</span>
        {destaque && (
          <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            oferecer por padrão
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] font-medium text-slate-700">{para}</p>
      <ul className="mt-2 space-y-1 text-[13px] text-slate-700">
        {tem.map((t) => (
          <li key={t}>✓ {t}</li>
        ))}
        {naoTem?.map((t) => (
          <li key={t} className="text-slate-500">✗ {t}</li>
        ))}
      </ul>
      {gancho && (
        <p className="mt-2 rounded-md bg-white/70 px-2.5 py-1.5 text-[12.5px] italic text-slate-700">
          {gancho}
        </p>
      )}
    </div>
  );
}

function Fala({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border-l-4 border-blue-400 bg-blue-50/60 p-3">
      <p className="mb-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-blue-700">
        {titulo}
      </p>
      <p className="text-[14px] leading-relaxed text-slate-800">{children}</p>
    </div>
  );
}

function Objecao({ p, r, nota }: { p: string; r: string; nota: string }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[15px] font-bold text-slate-900">{p}</p>
      <p className="mt-0.5 text-[12.5px] text-slate-500">{nota}</p>
      <p className="mt-2 rounded-lg border-l-4 border-blue-400 bg-blue-50/60 p-2.5 text-[14px] leading-relaxed text-slate-800">
        {r}
      </p>
    </div>
  );
}
