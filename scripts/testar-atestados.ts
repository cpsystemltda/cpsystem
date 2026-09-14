import "./_env";
import { prisma } from "@/lib/prisma";
import {
  situacaoAtestado,
  whereAtestadoPendente,
  whereAguardandoOrgao,
  deveAvisarHoje,
  diasDecorridos,
} from "@/lib/atestados";

/**
 * Exercita a régua do Atestado de Capacidade Técnica contra o banco LOCAL.
 *
 * Cria uma conta descartável com seis Atas em estados diferentes, confere o que
 * cada consulta e cada função devolve, e apaga tudo no fim. O que este teste
 * protege, em ordem de quanto dói errar:
 *
 *   1. cobrar atestado de contratação que ainda está valendo (o cliente perde
 *      a confiança no alerta na primeira vez que isso acontece);
 *   2. continuar cobrando quem já pediu ou já anexou;
 *   3. errar a contagem de dias na virada do dia por fuso.
 */
const url = process.env.DATABASE_URL || "";
if (!/localhost|127\.0\.0\.1/.test(url) || /neon\.tech/.test(url)) {
  console.error("Recusando rodar: DATABASE_URL não é local.\n  " + url);
  process.exit(1);
}

const DIA = 86400000;
let falhas = 0;

function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(
    `  ${ok ? "✓" : "✗"} ${nome}` + (ok ? "" : `\n      esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`),
  );
}

/** Meia-noite UTC de N dias atrás — como as vigências são gravadas. */
function diasAtras(n: number): Date {
  const hoje = Math.floor(Date.now() / DIA);
  return new Date((hoje - n) * DIA);
}

async function main() {
  const conta = await prisma.conta.create({
    data: { tipo: "EMPRESA", plano: "BASICO", statusAssinatura: "TRIAL" },
  });
  const empresa = await prisma.empresa.create({
    data: {
      contaId: conta.id,
      razaoSocial: "TESTE ATESTADOS LTDA",
      // CNPJ é único no schema; sufixo aleatório deixa o script rodar de novo
      // mesmo que uma execução anterior tenha morrido sem limpar.
      cnpj: `99${String(Math.floor(Math.random() * 1e12)).padStart(12, "0")}`,
      porte: "ME",
      naturezaJuridica: "206-2 - Sociedade Empresária Limitada",
      endereco: "SBS Quadra 1, Brasília/DF",
      cep: "70070000",
      email: "teste@exemplo.invalid",
      telefones: "(61) 90000-0000",
      responsavel: "Teste",
    },
  });

  const baseAta = {
    empresaId: empresa.id,
    tipo: "FORNECIMENTO" as const,
    numero: "",
    processoAdministrativo: "PA-TESTE",
    procedimentoSelecao: "PREGAO_ELETRONICO" as const,
    orgaoNome: "Órgão de Teste",
    orgaoCnpj: "00000000000191",
    orgaoEndereco: "Brasília/DF",
    objeto: "Objeto de teste",
    dataAssinatura: diasAtras(400),
    vigenciaInicio: diasAtras(400),
  };

  // Seis cenários, um por linha do que a régua precisa distinguir.
  const vigente = await prisma.ata.create({
    data: { ...baseAta, numero: "A-VIGENTE", vigenciaFim: new Date(Date.now() + 30 * DIA) },
  });
  const ultimoDia = await prisma.ata.create({
    data: { ...baseAta, numero: "A-ULTIMO-DIA", vigenciaFim: diasAtras(0) },
  });
  const encerrada1 = await prisma.ata.create({
    data: { ...baseAta, numero: "A-ONTEM", vigenciaFim: diasAtras(1) },
  });
  const encerrada40 = await prisma.ata.create({
    data: { ...baseAta, numero: "A-40D", vigenciaFim: diasAtras(40) },
  });
  const solicitada = await prisma.ata.create({
    data: {
      ...baseAta,
      numero: "A-SOLICITADA",
      vigenciaFim: diasAtras(50),
      atestadoSolicitadoEm: diasAtras(15),
    },
  });
  const dispensada = await prisma.ata.create({
    data: {
      ...baseAta,
      numero: "A-DISPENSADA",
      vigenciaFim: diasAtras(50),
      atestadoDispensadoEm: diasAtras(2),
      atestadoDispensaMotivo: "nada executado",
    },
  });
  const comAtestado = await prisma.ata.create({
    data: { ...baseAta, numero: "A-COM-PDF", vigenciaFim: diasAtras(60) },
  });
  await prisma.atestadoCapacidade.create({
    data: {
      ataId: comAtestado.id,
      dataEmissao: diasAtras(30),
      orgaoEmissor: "Órgão de Teste",
      arquivoPdfUrl: "/uploads/teste.pdf",
    },
  });

  console.log("\nEstado de cada Ata:");
  const carregar = (id: string) =>
    prisma.ata.findUniqueOrThrow({
      where: { id },
      select: {
        vigenciaFim: true,
        atestadoSolicitadoEm: true,
        atestadoDispensadoEm: true,
        atestadoDispensaMotivo: true,
        atestados: { select: { id: true } },
      },
    });

  conferir("vigente → VIGENTE", situacaoAtestado(await carregar(vigente.id)).estado, "VIGENTE");
  conferir(
    "último dia de vigência → VIGENTE (não cobra quem ainda está valendo)",
    situacaoAtestado(await carregar(ultimoDia.id)).estado,
    "VIGENTE",
  );
  conferir("encerrada ontem → PENDENTE", situacaoAtestado(await carregar(encerrada1.id)).estado, "PENDENTE");

  const s40 = situacaoAtestado(await carregar(encerrada40.id));
  conferir("encerrada há 40d → PENDENTE", s40.estado, "PENDENTE");
  conferir(
    "contagem de dias desde o encerramento",
    s40.estado === "PENDENTE" ? s40.diasDesdeEncerramento : null,
    40,
  );

  const sSol = situacaoAtestado(await carregar(solicitada.id));
  conferir("solicitada → AGUARDANDO_ORGAO", sSol.estado, "AGUARDANDO_ORGAO");
  conferir("dias de espera", sSol.estado === "AGUARDANDO_ORGAO" ? sSol.diasDeEspera : null, 15);

  conferir("dispensada → DISPENSADO", situacaoAtestado(await carregar(dispensada.id)).estado, "DISPENSADO");
  conferir("com PDF anexado → ANEXADO", situacaoAtestado(await carregar(comAtestado.id)).estado, "ANEXADO");

  console.log("\nConsultas usadas pelo banner e pelo filtro:");
  const pendentes = await prisma.ata.findMany({
    where: { empresa: { contaId: conta.id }, ...whereAtestadoPendente() },
    select: { numero: true },
    orderBy: { numero: "asc" },
  });
  conferir(
    "whereAtestadoPendente traz só as encerradas sem tratativa",
    pendentes.map((p) => p.numero),
    ["A-40D", "A-ONTEM"],
  );

  const esperando = await prisma.ata.findMany({
    where: { empresa: { contaId: conta.id }, ...whereAguardandoOrgao() },
    select: { numero: true },
  });
  conferir(
    "whereAguardandoOrgao traz só a que foi pedida",
    esperando.map((p) => p.numero),
    ["A-SOLICITADA"],
  );

  console.log("\nCadência do WhatsApp:");
  conferir("encerrada ontem (1d) avisa", deveAvisarHoje(situacaoAtestado(await carregar(encerrada1.id))), true);
  conferir("encerrada há 40d NÃO avisa (fora da cadência)", deveAvisarHoje(s40), false);
  conferir("solicitada há 15d avisa", deveAvisarHoje(sSol), true);
  conferir(
    "dispensada nunca avisa",
    deveAvisarHoje(situacaoAtestado(await carregar(dispensada.id))),
    false,
  );
  conferir(
    "com PDF nunca avisa",
    deveAvisarHoje(situacaoAtestado(await carregar(comAtestado.id))),
    false,
  );

  console.log("\nContagem de dias (a que dependia do fuso):");
  conferir("mesmo dia = 0", diasDecorridos(diasAtras(0), new Date()), 0);
  conferir("um dia = 1", diasDecorridos(diasAtras(1), new Date()), 1);

  await prisma.conta.delete({ where: { id: conta.id } });
  console.log(`\nDados de teste removidos.\n${falhas === 0 ? "TUDO PASSOU" : `${falhas} FALHA(S)`}\n`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
