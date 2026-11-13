import "server-only";
import { prisma } from "@/lib/prisma";
import { inicioDoDiaBrt } from "@/lib/saudacao";

/**
 * Prospecção diária — do servidor, não da minha mão.
 *
 * Regina, 24/09/2026, às 11h de uma quinta: *"como está a programação de
 * mensagem para as prospecções? Nenhuma mensagem foi enviada de forma
 * automática, como sempre foi feito."* Estava certa, e a falha era de desenho:
 * a prospecção morava num script que alguém precisava rodar. Dia em que
 * ninguém rodava, dia sem prospecção — e não havia sinal nenhum disso.
 *
 * Agora é cron. O que ele faz é **enfileirar**, não enviar: cada mensagem
 * entra com hora marcada, espaçada de 3 a 5 minutos, e a ponte entrega quando
 * a hora chega. Isso resolve o problema que impedia a automação antes — função
 * de servidor não pode ficar 40 minutos dormindo entre um envio e outro.
 *
 * As três travas de sempre continuam valendo, e são o motivo de o número ainda
 * existir depois de 12/08:
 *   1. teto de 15 por dia (era 10; Regina subiu em 13/11/2026), somando repescagens;
 *   2. intervalo humano de 3 a 5 minutos, sorteado;
 *   3. texto diferente em cada envio, montado com o contrato real do lead.
 */

// Regina, 13/11/2026: "vamos aumentar para 15, para não bloquear o WhatsApp
// mas também não ficar só em 10". O intervalo de 3 a 5 min e o texto único
// continuam: 15 envios espaçados levam ~1h, nada de rajada.
const TETO_DIARIO = 15;
/** Metade do dia vai para a repescagem; sobra de um lado passa para o outro. */
const RESERVA_REPESCAGEM = 7;
/** Intervalo mínimo entre uma abordagem e a repescagem do mesmo lead. */
const DIAS_ENTRE_REPESCAGENS = 7;
/** Depois da 1ª mensagem, no máximo 3 repescagens por lead. */
const MAX_REPESCAGENS = 3;
const MIN_INTERVALO_MIN = 3;
const MAX_INTERVALO_MIN = 5;

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function dataBr(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** O portal guarda caixa alta e sem acento — na abordagem isso entrega planilha. */
const ACENTOS: Record<string, string> = {
  educacao: "Educação", ciencia: "Ciência", tecnologia: "Tecnologia", saude: "Saúde",
  policia: "Polícia", municipio: "Município", fundacao: "Fundação", federal: "Federal",
  universidade: "Universidade", servicos: "Serviços", servico: "Serviço",
  producao: "Produção", administracao: "Administração", gestao: "Gestão",
  regiao: "Região", distrito: "Distrito", comercio: "Comércio", transito: "Trânsito",
  agua: "Água", infraestrutura: "Infraestrutura", habitacao: "Habitação",
  construcao: "Construção", construcoes: "Construções", solucoes: "Soluções",
  alimenticios: "Alimentícios", eletrico: "Elétrico", eletrica: "Elétrica",
  medicos: "Médicos", hospitalar: "Hospitalar", industria: "Indústria",
  maquinas: "Máquinas", tecnicos: "Técnicos", tecnica: "Técnica",
};

function apresentavel(bruto: string, cortarNaVirgula = false): string {
  const CONECTIVOS = /^(DE|DA|DO|DAS|DOS|E|EM|NO|NA)$/i;
  const base = cortarNaVirgula ? bruto.split(",")[0] : bruto;
  return base
    .trim()
    .split(/\s+/)
    .map((p, i) => {
      if (i > 0 && CONECTIVOS.test(p)) return p.toLowerCase();
      if (p.length <= 4 && p === p.toUpperCase() && /^[A-ZÀ-Ý]+$/.test(p)) return p;
      return ACENTOS[p.toLowerCase()] ?? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    })
    .join(" ");
}

function nomeCurtoEmpresa(razao: string): string {
  const tokens = razao
    .replace(/\b(LTDA|ME|EPP|EIRELI|S\/A|S\.A\.?|SA|MEI)\b\.?/gi, " ")
    .replace(/[^\wÀ-ÿ\s&.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t && !/^(DE|DA|DO|DAS|DOS|E)$/i.test(t));
  const escolhidos = tokens.slice(0, 2).map((t) =>
    t.length <= 3 ? t.toUpperCase() : (ACENTOS[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()),
  );
  return escolhidos.join(" ") || razao;
}

/** Só celular tem WhatsApp: depois do DDD, 9 dígitos começando em 9. */
function ehCelular(tel: string | null): boolean {
  const d = (tel || "").replace(/\D/g, "");
  return d.length === 11 && /^9/.test(d.slice(2));
}

/**
 * A abordagem, montada com o contrato real do lead.
 *
 * Passa pelo crivo que a Regina fixou em 22/09: eu saberia o que fazer? eu me
 * interessaria? está persuasivo? mostra o diferencial? diz o que resolve?
 */
function montarMensagem(l: {
  empresa: string; orgao: string | null; valorTotal: number; venceEm: Date; qtdContratos: number;
}): string {
  const nome = nomeCurtoEmpresa(l.empresa);
  const dias = Math.ceil((l.venceEm.getTime() - Date.now()) / 86400000);
  const orgao = l.orgao ? apresentavel(l.orgao, true) : "o órgão";
  const vencido = dias < 0;
  const valor = l.qtdContratos > 1 ? `${brl(l.valorTotal)} em ${l.qtdContratos} contratos` : brl(l.valorTotal);

  const abertura = vencido
    ? `o contrato de vocês com ${orgao} encerrou em ${dataBr(l.venceEm)} — ${valor}.`
    : dias <= 60
      ? `o contrato de vocês com ${orgao} vence em ${dataBr(l.venceEm)}, daqui a ${dias} dias — ${valor}.`
      : `vocês têm contrato com ${orgao} até ${dataBr(l.venceEm)} — ${valor}.`;

  const miolo = vencido
    ? `Vocês já pediram ao órgão o *Atestado de Capacidade Técnica* dessa contratação? É o documento que comprova qualificação técnica na próxima licitação. Quem deixa passar costuma descobrir no meio de um certame — com o servidor que acompanhou a execução já fora do setor e o processo arquivado.\n\n` +
      `O CP System avisa a hora de pedir, reúne todos os atestados num lugar só, buscáveis por órgão e por objeto na hora de montar a habilitação, e ainda aponta as notas que o órgão não pagou, com valor e dias de atraso.`
    : `Quem vende para o governo perde dinheiro sempre nos mesmos três pontos: prazo de entrega que vence e vira multa, nota emitida que fica meses parada no órgão sem ninguém cobrar, e contrato que encerra sem o Atestado de Capacidade Técnica — e aí falta comprovação na licitação seguinte.\n\n` +
      `O CP System existe só para essa fase, a de depois que a empresa ganhou: acompanha o saldo de cada item da ata, avisa o prazo antes de vencer e aponta cada nota que já deveria ter sido paga, com valor e dias de atraso. Tudo chega aqui no WhatsApp, sem precisar abrir sistema nenhum.`;

  return (
    `Olá! Aqui é do CP System.\n\n` +
    `${nome}, ${abertura}\n\n` +
    `${miolo}\n\n` +
    `Dá para conhecer e já testar grátis por 14 dias em *cpsystem.app.br*, sem precisar cadastrar cartão.\n\n` +
    `Se preferir, eu mostro em 15 minutos com os contratos de vocês. Faz sentido?\n\n` +
    `Se não for do interesse, é só dizer.\n\n` +
    `Contato CP System`
  );
}

/**
 * Repescagem (Regina 13/11/2026: "venda é insistência — aparece de novo para
 * esses caras"). Abordagem diferente da primeira, curta, com uma pergunta
 * direta e saída para indicar o responsável. Três ângulos, um por rodada.
 */
function montarRepescagem(l: { empresa: string; orgao: string | null; valorTotal: number; venceEm: Date; qtdContratos: number }, rodada: number): string {
  const nome = nomeCurtoEmpresa(l.empresa);
  const orgao = l.orgao ? apresentavel(l.orgao, true) : "o órgão";
  const valor = l.qtdContratos > 1 ? `${brl(l.valorTotal)} em ${l.qtdContratos} contratos` : brl(l.valorTotal);
  const angulos = [
    `Olá! Retomando o contato do CP System com a ${nome}.\n\n` +
      `Uma pergunta rápida: hoje, quem aí confere se cada nota do contrato com ${orgao} (${valor}) foi paga no prazo? Um atraso de 30 dias numa nota costuma passar despercebido até faltar no caixa.\n\n` +
      `O CP System mostra isso sozinho, nota por nota, e avisa aqui no WhatsApp. São 14 dias grátis em *cpsystem.app.br*, sem cartão.\n\n` +
      `Se não for com você, pode me indicar quem cuida dos contratos públicos?\n\nContato CP System`,
    `Olá, ${nome}! Aqui é do CP System de novo.\n\n` +
      `Sei que a rotina é corrida, então vou direto: empresas que vendem para ${orgao} usam o CP System para não perder prazo de entrega, saber o saldo de cada ata e pedir o Atestado de Capacidade Técnica na hora certa.\n\n` +
      `Posso te mostrar em 15 minutos, com os contratos de vocês já carregados? É só me dizer um horário que funcione.\n\nContato CP System`,
    `Olá! Última mensagem do CP System para a ${nome}, prometo.\n\n` +
      `Se em algum momento fizer sentido ter num só lugar os contratos com ${orgao} e os demais órgãos — prazos, saldo, notas em atraso e atestados —, o teste de 14 dias continua aberto em *cpsystem.app.br*.\n\n` +
      `Se preferir que eu não envie mais nada, é só responder "não". Obrigado pela atenção.\n\nContato CP System`,
  ];
  return angulos[Math.min(rodada, angulos.length) - 1];
}

/** Resposta que tira o lead da repescagem: número de outra pessoa, contabilidade, não vende ao governo. */
const RESPOSTA_DESCARTA = /(n[aã]o tenho contato|n[aã]o conhe[cç]o|n[uú]mero errado|engano|n[aã]o (é|e) (daqui|aqui|dessa|desta|a empresa)|n[aã]o (trabalh|vend|atend)\w* (com|para|pro) (o )?(governo|[oó]rg[aã]o|licita)|n[aã]o participamos|contabil|contador|escrit[oó]rio de contab|pare de|n[aã]o mande|n[aã]o envie|bloque)/i;

export type ResumoProspeccao = {
  enfileiradas: number;
  repescagens?: number;
  primeiraAs: string | null;
  ultimaAs: string | null;
  jaFeitasHoje: number;
  semCelular: number;
  motivo?: string;
};

export async function prospectarDoDia(opts: { simular?: boolean } = {}): Promise<ResumoProspeccao & { previa?: { empresa: string; rodada: number; texto: string }[]; repescaveis?: number; descartados?: number }> {
  // Dia de Brasília: com `setHours` o "hoje" virava às 21h daqui, porque o
  // processo roda em UTC na Vercel.
  const inicioDoDia = inicioDoDiaBrt();

  // Quantas já saíram hoje — inclusive as que eu tiver disparado à mão. O teto
  // é do DIA, não da execução.
  // Conta primeiros contatos E repescagens: o teto é de mensagens no dia.
  const [primeirosHoje, enfileiradasHoje] = await Promise.all([
    prisma.leadProspeccao.count({ where: { dataPrimeiroContato: { gte: inicioDoDia } } }),
    prisma.mensagemSaidaWhatsApp.count({ where: { tipo: "PROSPECCAO", criadoEm: { gte: inicioDoDia } } }),
  ]);
  const jaFeitasHoje = Math.max(primeirosHoje, enfileiradasHoje);
  const vagas = TETO_DIARIO - jaFeitasHoje;
  if (vagas <= 0) {
    return { enfileiradas: 0, primeiraAs: null, ultimaAs: null, jaFeitasHoje, semCelular: 0, motivo: "teto diário já atingido" };
  }

  // Sem `take` no banco, e o corte acontece depois de separar os celulares.
  //
  // Regina, 30/09: *"por que você não está fazendo a prospecção de dez
  // pessoas e está reduzindo esse número?"* — foram 8, depois 4, depois 1.
  //
  // A causa era o `take: vagas * 4`: pegava os 40 primeiros por vencimento e
  // só então descartava telefone fixo. Como cada rodada consome justamente os
  // celulares, o começo da fila vai ficando cada vez mais cheio de fixo, e a
  // janela de 40 passa a devolver quase nada — 8, 4, 1. A lista tinha 93
  // elegíveis e 27 celulares no dia em que saiu uma única abordagem.
  //
  // Filtrar tudo em memória é seguro aqui: a lista inteira é de centenas de
  // linhas, não de milhões, e o teto de mil evita surpresa se ela crescer.
  const candidatos = await prisma.leadProspeccao.findMany({
    where: { alvoIdeal: true, situacao: "NAO_CONTATADO", telefone: { not: null } },
    orderBy: [{ venceEm: "asc" }],
    take: 1000,
    select: {
      id: true, empresa: true, telefone: true, orgao: true,
      valorTotal: true, venceEm: true, qtdContratos: true, anotacoes: true,
    },
  });

  const comCelular = candidatos.filter((l) => ehCelular(l.telefone));

  // Repescagem: já abordados, sem conversa com a closer, que não pediram para
  // parar nem disseram que o número é de outra pessoa/da contabilidade.
  const limiteRepesca = new Date(Date.now() - DIAS_ENTRE_REPESCAGENS * 86_400_000);
  const jaAbordados = await prisma.leadProspeccao.findMany({
    where: { alvoIdeal: true, situacao: "TENTOU_NAO_FALOU", telefone: { not: null }, dataUltimoContato: { lt: limiteRepesca } },
    orderBy: [{ dataUltimoContato: "asc" }],
    take: 1000,
    select: { id: true, empresa: true, telefone: true, orgao: true, valorTotal: true, venceEm: true, qtdContratos: true, anotacoes: true },
  });
  const ult8 = (t: string | null) => (t || "").replace(/\D/g, "").slice(-8);
  const respostas = await prisma.mensagemInboundWhatsApp.findMany({ select: { telefone: true, texto: true } });
  const descartados = new Set(respostas.filter((r) => r.texto && RESPOSTA_DESCARTA.test(r.texto)).map((r) => ult8(r.telefone)));
  const falhas = await prisma.mensagemSaidaWhatsApp.findMany({ where: { tipo: "PROSPECCAO", status: "FALHOU" }, select: { destino: true } });
  const semWhats = new Set(falhas.map((f) => ult8(f.destino)));
  const rodadas = (a: string | null) => (a?.match(/Repescagem \d/g) ?? []).length;
  const repescaveis = jaAbordados.filter((l) => ehCelular(l.telefone) && !descartados.has(ult8(l.telefone)) && !semWhats.has(ult8(l.telefone)) && rodadas(l.anotacoes) < MAX_REPESCAGENS);

  const vagasNovos = Math.min(comCelular.length, Math.max(vagas - Math.min(RESERVA_REPESCAGEM, repescaveis.length), 0));
  const novos = comCelular.slice(0, vagasNovos).map((l) => ({ ...l, rodada: 0 }));
  const repesca = repescaveis.slice(0, vagas - novos.length).map((l) => ({ ...l, rodada: rodadas(l.anotacoes) + 1 }));
  // Intercala para o dia não ter um bloco só de repescagem.
  const fila: ((typeof novos)[number])[] = [];
  for (let i = 0; i < Math.max(novos.length, repesca.length); i++) {
    if (novos[i]) fila.push(novos[i]);
    if (repesca[i]) fila.push(repesca[i]);
  }
  if (opts.simular) {
    return {
      enfileiradas: 0, primeiraAs: null, ultimaAs: null, jaFeitasHoje, semCelular: candidatos.length - comCelular.length,
      repescaveis: repescaveis.length, descartados: jaAbordados.length - repescaveis.length,
      previa: fila.map((l) => ({ empresa: l.empresa, rodada: l.rodada, texto: l.rodada > 0 ? montarRepescagem(l, l.rodada) : montarMensagem(l) })),
    };
  }
  if (fila.length === 0) {
    return { enfileiradas: 0, primeiraAs: null, ultimaAs: null, jaFeitasHoje, semCelular: candidatos.length - comCelular.length, motivo: "sem lead elegível" };
  }

  // Espaçamento: a primeira sai já, as seguintes de 3 a 5 minutos depois da
  // anterior. Rajada é o que derruba número — foi o que aconteceu em 12/08.
  let quando = Date.now();
  const horarios: Date[] = [];

  for (const [i, l] of fila.entries()) {
    if (i > 0) {
      const minutos = MIN_INTERVALO_MIN + Math.random() * (MAX_INTERVALO_MIN - MIN_INTERVALO_MIN);
      quando += Math.round(minutos * 60_000);
    }
    const agendadoPara = new Date(quando);
    horarios.push(agendadoPara);

    await prisma.mensagemSaidaWhatsApp.create({
      data: {
        destino: "55" + (l.telefone ?? "").replace(/\D/g, ""),
        texto: l.rodada > 0 ? montarRepescagem(l, l.rodada) : montarMensagem(l),
        tipo: "PROSPECCAO",
        agendadoPara,
      },
    });

    // Marca o lead na hora de enfileirar, não na entrega: se o cron rodar duas
    // vezes, o mesmo lead não entra duas vezes na fila.
    const hojeBr = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const nota = l.rodada > 0 ? `[${hojeBr}] Repescagem ${l.rodada} enfileirada pelo CP System (envio automático).` : `[${hojeBr}] Abordagem de prospecção enfileirada pelo CP System (envio automático).`;
    await prisma.leadProspeccao.update({
      where: { id: l.id },
      data: {
        situacao: "TENTOU_NAO_FALOU",
        ...(l.rodada > 0 ? {} : { dataPrimeiroContato: new Date() }),
        dataUltimoContato: new Date(),
        anotacoes: l.anotacoes ? `${l.anotacoes}\n${nota}` : nota,
        atualizadoPorNome: "CP System (prospecção automática)",
      },
    });
  }

  // Hora de Brasília, sempre.
  //
  // Regina, 30/09: *"por que cargas d'água você está falando que a prospecção
  // começa meio-dia, sendo que começa às nove?"* — o aviso no grupo dizia
  // 12:05 porque a função roda na Vercel, em UTC, e o relógio saía sem fuso.
  // O cron nunca mudou de hora; só a mensagem mentia.
  const hora = (d: Date) =>
    d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  return {
    enfileiradas: fila.length,
    repescagens: repesca.length,
    primeiraAs: hora(horarios[0]),
    ultimaAs: hora(horarios[horarios.length - 1]),
    jaFeitasHoje,
    semCelular: candidatos.length - comCelular.length,
  };
}
