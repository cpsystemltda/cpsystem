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
          <strong>depois</strong> que a empresa ganha a licitação — que é onde o dinheiro se perde:
          o prazo de prorrogação que passa e encerra o contrato, a entrega que atrasa e vira multa,
          a entrega feita cuja nota não saiu, a nota que ninguém encaminhou ao órgão, o saldo de ata
          que nunca foi executado.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[13px] text-amber-900">
          <p className="font-semibold">Três coisas para não prometer errado:</p>
          <p className="mt-1">
            <strong>Não emitimos nota fiscal</strong> — a emissão fica no emissor fiscal do cliente,
            por decisão de risco. <strong>Não somos portal de licitação</strong> — começamos depois
            que ele ganhou. <strong>Não substituímos o contador</strong> — ele cuida do fiscal, que
            vem depois; nós cuidamos do prazo e da execução, que vêm antes.
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
          consultando o Portal Nacional de Contratações Públicas, o contrato de vocês com a{" "}
          <strong>[órgão]</strong>, de <strong>[R$ valor]</strong>, tem vigência até{" "}
          <strong>[data]</strong> — faltam <strong>[N] dias</strong>.
          <br />
          <br />
          <strong>A prorrogação já está encaminhada?</strong>
        </Fala>
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
          r="Não, e é decisão nossa: envolve certificado digital e regra que muda por município, e quem responde perante o fisco é a sua empresa. O que fazemos é o controle em volta — apontamos toda entrega sem nota e, a partir do encaminhamento dela ao órgão, contamos o prazo de pagamento."
          nota="Apresente como proteção, nunca como limitação."
        />
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
