import "server-only";
import { prisma } from "@/lib/prisma";

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
 *   1. teto de 10 por dia;
 *   2. intervalo humano de 3 a 5 minutos, sorteado;
 *   3. texto diferente em cada envio, montado com o contrato real do lead.
 */

const TETO_DIARIO = 10;
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

export type ResumoProspeccao = {
  enfileiradas: number;
  primeiraAs: string | null;
  ultimaAs: string | null;
  jaFeitasHoje: number;
  semCelular: number;
  motivo?: string;
};

export async function prospectarDoDia(): Promise<ResumoProspeccao> {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  // Quantas já saíram hoje — inclusive as que eu tiver disparado à mão. O teto
  // é do DIA, não da execução.
  const jaFeitasHoje = await prisma.leadProspeccao.count({
    where: { dataPrimeiroContato: { gte: inicioDoDia } },
  });
  const vagas = TETO_DIARIO - jaFeitasHoje;
  if (vagas <= 0) {
    return { enfileiradas: 0, primeiraAs: null, ultimaAs: null, jaFeitasHoje, semCelular: 0, motivo: "teto diário já atingido" };
  }

  const candidatos = await prisma.leadProspeccao.findMany({
    where: { alvoIdeal: true, situacao: "NAO_CONTATADO", telefone: { not: null } },
    orderBy: [{ venceEm: "asc" }],
    take: vagas * 4, // folga para descartar os sem celular
    select: {
      id: true, empresa: true, telefone: true, orgao: true,
      valorTotal: true, venceEm: true, qtdContratos: true, anotacoes: true,
    },
  });

  const comCelular = candidatos.filter((l) => ehCelular(l.telefone));
  const fila = comCelular.slice(0, vagas);
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
        texto: montarMensagem(l),
        tipo: "PROSPECCAO",
        agendadoPara,
      },
    });

    // Marca o lead na hora de enfileirar, não na entrega: se o cron rodar duas
    // vezes, o mesmo lead não entra duas vezes na fila.
    const nota = `[${new Date().toLocaleDateString("pt-BR")}] Abordagem de prospecção enfileirada pelo CP System (envio automático).`;
    await prisma.leadProspeccao.update({
      where: { id: l.id },
      data: {
        situacao: "TENTOU_NAO_FALOU",
        dataPrimeiroContato: new Date(),
        dataUltimoContato: new Date(),
        anotacoes: l.anotacoes ? `${l.anotacoes}\n${nota}` : nota,
        atualizadoPorNome: "CP System (prospecção automática)",
      },
    });
  }

  const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return {
    enfileiradas: fila.length,
    primeiraAs: hora(horarios[0]),
    ultimaAs: hora(horarios[horarios.length - 1]),
    jaFeitasHoje,
    semCelular: candidatos.length - comCelular.length,
  };
}
