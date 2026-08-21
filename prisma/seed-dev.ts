/**
 * Semeia um banco LOCAL com uma conta completa pra testar de verdade.
 *
 * Existe porque, até 21/08, a única base disponível era a de produção: o
 * adapter do Neon não fala com Postgres comum e o histórico de migrations não
 * construía o schema. Os dois foram consertados; isto aqui fecha o ciclo, pra
 * ninguém mais precisar escolher entre testar em produção e não testar.
 *
 * Uso:
 *   createdb cpsystem_test
 *   DATABASE_URL="postgresql://$USER@localhost:5432/cpsystem_test" npx prisma migrate deploy
 *   DATABASE_URL="postgresql://$USER@localhost:5432/cpsystem_test" npx tsx prisma/seed-dev.ts
 *   DATABASE_URL="postgresql://$USER@localhost:5432/cpsystem_test" npx next dev
 *
 * Depois é só entrar sem senha, com o cookie de sessão que ele imprime:
 *   curl -b "cp_session=<token>" http://localhost:3000/dashboard
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL ?? "";

// Trava dura: este script CRIA e APAGA dados. Nunca pode encostar em produção.
if (!url) throw new Error("DATABASE_URL não definida.");
if (!/localhost|127\.0\.0\.1/.test(url) || /neon\.tech/.test(url)) {
  throw new Error(
    `Recusando rodar: este seed é só pra banco local. DATABASE_URL aponta pra "${url.replace(/:[^:@]+@/, ":***@")}".`,
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const TOKEN_TITULAR = "dev-titular";
const TOKEN_COLABORADOR = "dev-colaborador";
const daquiUmMes = new Date(Date.now() + 30 * 86400000);

async function main() {
  // Idempotente: limpa a conta de teste antes, pra rodar quantas vezes quiser.
  await prisma.conta.deleteMany({ where: { usuarios: { some: { email: { endsWith: "@dev.local" } } } } });
  await prisma.analista.deleteMany({ where: { email: { endsWith: "@dev.local" } } });

  const conta = await prisma.conta.create({
    data: {
      tipo: "EMPRESA",
      plano: "PREMIUM", // Premium pra o módulo jurídico ficar testável
      statusAssinatura: "ATIVA", // evita paywall e o desvio de "completar cadastro"
      termosAceitosEm: new Date(),
      termosAceitosVersao: "2.2",
      gatewaySubscriptionId: "sub_dev",
      empresas: {
        create: {
          razaoSocial: "EMPRESA DE DESENVOLVIMENTO LTDA",
          nomeFantasia: "Empresa Dev",
          cnpj: "11222333000181",
          porte: "EPP",
          naturezaJuridica: "LTDA",
          endereco: "SRTVS Qd 701, 616 - Asa Sul, Brasilia/DF",
          cep: "70340906",
          email: "contato@dev.local",
          telefones: "61999999999",
          responsavel: "Titular Dev",
        },
      },
      usuarios: {
        create: [
          {
            nome: "Titular Dev",
            email: "titular@dev.local",
            senhaHash: "seed-dev-sem-senha-entre-pelo-cookie",
            perfil: "ADMIN",
            onboardingConcluido: true,
          },
          {
            // Colaborador restrito: opera, mas não vê o financeiro.
            nome: "Colaborador Dev",
            email: "colaborador@dev.local",
            senhaHash: "seed-dev-sem-senha-entre-pelo-cookie",
            perfil: "OPERACIONAL",
            onboardingConcluido: true,
            acessoRestrito: true,
            modulosPermitidos: ["EMPRESAS", "ATAS", "CONTRATOS", "EXECUCAO"],
          },
        ],
      },
    },
    include: { usuarios: { orderBy: { criadoEm: "asc" } }, empresas: true },
  });

  const contaAnalista = await prisma.conta.create({
    data: { tipo: "ANALISTA", plano: "BASICO", statusAssinatura: "ATIVA" },
  });
  const analista = await prisma.analista.create({
    data: {
      nomeCompleto: "Analista Dev",
      cpf: "12345678901",
      telefone: "61988887777",
      endereco: "Brasilia/DF",
      email: "analista@dev.local",
      contaId: contaAnalista.id,
    },
  });

  const vinculo = await prisma.vinculoAnalista.create({
    data: {
      contaId: conta.id,
      analistaId: analista.id,
      percentualComissao: 5,
      fixoMensal: 0,
      status: "ATIVO",
      dataInicio: new Date("2026-01-01"),
    },
  });

  const empenho = await prisma.empenho.create({
    data: {
      empresaId: conta.empresas[0].id,
      tipo: "SERVICOS",
      instrumento: "ORDEM_SERVICO",
      numero: "ORDEM_SERVICO Julho/2026",
      processoAdministrativo: "23106.000123/2026-11",
      procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: "Universidade de Brasilia",
      orgaoCnpj: "00038174000143",
      orgaoEndereco: "Campus Darcy Ribeiro, Brasilia/DF",
      objeto: "Prestacao de servicos de desenvolvimento",
      dataEmissao: new Date("2026-07-01"),
      vigenciaInicio: new Date("2026-07-01"),
      vigenciaFim: daquiUmMes,
      status: "PAGO",
    },
  });

  // Comissão liberada: o órgão já pagou, a empresa precisa repassar. É o estado
  // em que o botão "Marcar como pago" aparece em /honorarios.
  await prisma.comissaoExecucao.create({
    data: {
      empenhoId: empenho.id,
      vinculoId: vinculo.id,
      analistaId: analista.id,
      percentual: 5,
      valorBaseEmpenho: 9467.83,
      valorBasePago: 9799.8,
      valorCalculado: 489.99,
      status: "A_RECEBER",
    },
  });

  const [titular, colaborador] = conta.usuarios;
  await prisma.sessao.createMany({
    data: [
      { token: TOKEN_TITULAR, usuarioId: titular.id, expiraEm: daquiUmMes },
      { token: TOKEN_COLABORADOR, usuarioId: colaborador.id, expiraEm: daquiUmMes },
    ],
  });

  console.log("Banco de desenvolvimento semeado.\n");
  console.log("  Titular (acesso completo)  cookie: cp_session=" + TOKEN_TITULAR);
  console.log("  Colaborador (sem financeiro) cookie: cp_session=" + TOKEN_COLABORADOR);
  console.log("\n  O colaborador deve ser barrado em /honorarios, /vinculos, /conciliacao,");
  console.log("  /conta/assinatura, /juridico e /relatorios — e passar em /atas e /contratos.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
