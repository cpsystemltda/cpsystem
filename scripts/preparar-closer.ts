/**
 * Prepara tudo que a closer precisa para trabalhar e para demonstrar.
 *
 * Regina 08/09: "crie um login e senha pra Elizabeth acessar o sistema (...)
 * simule o sistema todo preenchido pra ela demonstrar pro cliente na hora da
 * venda".
 *
 * Cria duas coisas separadas, de propósito:
 *
 *   1. O ACESSO DE TRABALHO dela — colaboradora da conta interna do CP System,
 *      com um único módulo liberado: Prospecção. Ela vê a lista de ligações e
 *      NENHUM dado de cliente real. Isso importa: a lista de prospecção é dado
 *      público, a carteira de clientes não é.
 *
 *   2. A CONTA DE DEMONSTRAÇÃO — uma empresa fictícia com contratos, empenhos e
 *      notas em todos os estágios, para ela abrir na tela durante a ligação.
 *      Nunca demonstrar com a conta de um cliente real.
 *
 * Idempotente: rodar de novo atualiza em vez de duplicar.
 */
import "./_env";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashSenha } from "@/lib/auth";

const EMAIL_DEMO = "demonstracao@cpsystem.app.br";
const CNPJ_DEMO = "45678912000134";

function senhaLegivel(): string {
  // Sem caracteres que se confundem ao ditar por telefone (0/O, 1/l/I).
  const abc = "abcdefghjkmnpqrstuvwxyz";
  const num = "23456789";
  const b = randomBytes(12);
  const p = [...Array(6)].map((_, i) => abc[b[i] % abc.length]).join("");
  const n = [...Array(3)].map((_, i) => num[b[i + 6] % num.length]).join("");
  return `cp-${p}-${n}`;
}

/** 2 · Conta de demonstração, com a operação inteira preenchida. */
async function criarDemonstracao() {
  const senha = senhaLegivel();
  const senhaHash = await hashSenha(senha);
  const hoje = new Date();
  const dias = (n: number) => new Date(hoje.getTime() + n * 86400000);

  // Zera o que existia, para a demonstração ser sempre igual e previsível.
  const antiga = await prisma.conta.findFirst({
    where: { usuarios: { some: { email: EMAIL_DEMO } } },
    select: { id: true },
  });
  if (antiga) await prisma.conta.delete({ where: { id: antiga.id } });

  const conta = await prisma.conta.create({
    data: {
      tipo: "EMPRESA",
      plano: "PREMIUM",
      statusAssinatura: "ATIVA",
      termosAceitosEm: hoje,
      termosAceitosVersao: "2.2",
      empresas: {
        create: {
          razaoSocial: "CONSTRUTORA MODELO LTDA",
          nomeFantasia: "Construtora Modelo",
          cnpj: CNPJ_DEMO,
          porte: "EPP",
          naturezaJuridica: "LTDA",
          endereco: "SRTVS Qd 701, 616 - Asa Sul, Brasília/DF",
          cep: "70340906",
          email: "contato@construtoramodelo.com.br",
          telefones: "6133334444",
          responsavel: "Roberto Modelo",
        },
      },
      usuarios: {
        create: {
          nome: "Demonstração CP System",
          email: EMAIL_DEMO,
          senhaHash,
          perfil: "ADMIN",
          onboardingConcluido: true,
          optInWhatsApp: false,
        },
      },
    },
    include: { empresas: true },
  });
  const empresaId = conta.empresas[0].id;

  // ── Ata com saldo parcialmente executado ────────────────────────────────
  await prisma.ata.create({
    data: {
      empresaId,
      numero: "012/2026",
      processoAdministrativo: "PA 23456/2026",
      procedimentoSelecao: "PREGAO_ELETRONICO",
      tipo: "FORNECIMENTO",
      orgaoNome: "Secretaria Municipal de Educação de Santa Clara",
      orgaoCnpj: "12345678000190",
      orgaoEndereco: "SBN Qd 02, Brasília/DF",
      objeto: "Registro de preços para fornecimento de material de construção",
      dataAssinatura: dias(-200),
      vigenciaInicio: dias(-200),
      vigenciaFim: dias(45),
      // Ata não guarda valor próprio: ele vem dos itens.
      itens: {
        create: [
          { descricao: "Cimento CP-II 50kg", unidade: "SC", quantidade: 12000, valorUnitario: 42.5, valorTotal: 510000 },
          { descricao: "Areia média lavada", unidade: "M3", quantidade: 3000, valorUnitario: 130, valorTotal: 390000 },
          { descricao: "Brita 1", unidade: "M3", quantidade: 2500, valorUnitario: 145, valorTotal: 362500 },
        ],
      },
    },
  });

  // ── Contratos em situações diferentes ───────────────────────────────────
  const contratos = [
    {
      numero: "045/2026",
      orgao: "Prefeitura Municipal de Santa Clara",
      cnpj: "12345678000190",
      objeto: "Reforma de unidades escolares",
      fim: dias(28),
      valor: 1_180_000,
    },
    {
      numero: "018/2026",
      orgao: "Instituto Municipal de Saúde de Santa Clara",
      cnpj: "98765432000110",
      objeto: "Manutenção predial continuada",
      fim: dias(120),
      valor: 640_000,
    },
  ];
  for (const c of contratos) {
    await prisma.contrato.create({
      data: {
        empresaId,
        tipo: "SERVICOS",
        numero: c.numero,
        processoAdministrativo: `PA ${c.numero.replace("/", "")}`,
        procedimentoSelecao: "PREGAO_ELETRONICO",
        orgaoNome: c.orgao,
        orgaoCnpj: c.cnpj,
        orgaoEndereco: "Brasília/DF",
        objeto: c.objeto,
        dataAssinatura: dias(-180),
        vigenciaInicio: dias(-180),
        vigenciaFim: c.fim,
        valorInicial: c.valor,
        prazoPagamentoDias: 30,
      },
    });
  }

  // ── Empenhos cobrindo TODAS as etapas da execução ───────────────────────
  // É o que a closer mostra: cada dor da ligação tem uma linha aqui.
  const empenhos: {
    numero: string; orgao: string; objeto: string; valor: number;
    status: "PEDIDO_RECEBIDO" | "EM_TRANSITO" | "ENTREGUE" | "NF_ENCAMINHADA" | "PAGO";
    marcos: Record<string, Date | null>; entregaEm: number;
  }[] = [
    {
      numero: "2026NE000412", orgao: "Secretaria Municipal de Educação de Santa Clara",
      objeto: "Fornecimento de cimento e areia", valor: 184_000, entregaEm: 2,
      status: "PEDIDO_RECEBIDO",
      marcos: { dataPedidoRecebido: dias(-6) },
    },
    {
      numero: "2026NE000388", orgao: "Prefeitura Municipal de Santa Clara",
      objeto: "Reforma da Escola Classe 04", valor: 72_500, entregaEm: 5,
      status: "EM_TRANSITO",
      marcos: { dataPedidoRecebido: dias(-12), dataDespacho: dias(-3) },
    },
    {
      numero: "2026NE000350", orgao: "Instituto Municipal de Saúde de Santa Clara",
      objeto: "Manutenção elétrica do posto de saúde central", valor: 129_000, entregaEm: -6,
      status: "ENTREGUE",
      marcos: { dataPedidoRecebido: dias(-30), dataDespacho: dias(-14), dataEntrega: dias(-6) },
    },
    {
      numero: "2026NE000297", orgao: "Fundo Municipal de Saúde de Santa Clara",
      objeto: "Adequação de acessibilidade em UBS", valor: 98_000, entregaEm: -40,
      status: "NF_ENCAMINHADA",
      marcos: {
        dataPedidoRecebido: dias(-70), dataDespacho: dias(-55), dataEntrega: dias(-45),
        dataNfEmitida: dias(-43), dataNfEncaminhada: dias(-40),
      },
    },
    {
      numero: "2026NE000205", orgao: "Prefeitura Municipal de Santa Clara",
      objeto: "Fornecimento de material hidráulico", valor: 56_300, entregaEm: -80,
      status: "PAGO",
      marcos: {
        dataPedidoRecebido: dias(-110), dataDespacho: dias(-95), dataEntrega: dias(-85),
        dataNfEmitida: dias(-83), dataNfEncaminhada: dias(-80), dataPagamento: dias(-50),
      },
    },
  ];

  for (const e of empenhos) {
    const emp = await prisma.empenho.create({
      data: {
        empresaId,
        tipo: "FORNECIMENTO",
        instrumento: "NOTA_EMPENHO",
        numero: e.numero,
        processoAdministrativo: `PA ${e.numero.slice(-6)}`,
        procedimentoSelecao: "PREGAO_ELETRONICO",
        orgaoNome: e.orgao,
        orgaoCnpj: "12345678000190",
        orgaoEndereco: "Brasília/DF",
        objeto: e.objeto,
        dataEmissao: dias(-60),
        vigenciaInicio: dias(-60),
        vigenciaFim: dias(180),
        prazoEntregaModo: "DATA_CERTA",
        dataEntregaCerta: dias(e.entregaEm),
        prazoPagamentoDias: 30,
        status: e.status,
        ...e.marcos,
        itens: {
          create: [
            { descricao: e.objeto, unidade: "UN", quantidade: 1, valorUnitario: e.valor, valorTotal: e.valor },
          ],
        },
      },
    });

    // Nota registrada nos que já passaram da emissão.
    if (e.marcos.dataNfEmitida) {
      await prisma.notaFiscal.create({
        data: {
          empresaId,
          empenhoId: emp.id,
          referencia: `demo-${emp.id}`,
          provedor: "EXTERNA",
          ambiente: "PRODUCAO",
          status: "AUTORIZADA",
          numero: String(1000 + Number(e.numero.slice(-3))),
          valorServicos: e.valor,
          issRetido: false,
          descricao: e.objeto,
          tomadorCnpj: "12345678000190",
          tomadorRazaoSocial: e.orgao,
          autorizadaEm: e.marcos.dataNfEmitida,
        },
      });
    }
  }

  return { email: EMAIL_DEMO, senha, empresa: "Construtora Modelo" };
}

async function main() {
  const demo = await criarDemonstracao();

  console.log("\n════════ ACESSO DA ELIZABETH ════════");
  console.log(`  https://cpsystem.app.br/login`);
  console.log(`  e-mail: ${demo.email}`);
  console.log(`  senha:  ${demo.senha}`);
  console.log("");
  console.log(`  Serve pras duas coisas:`);
  console.log(`   · trabalhar a lista em cpsystem.app.br/prospeccao`);
  console.log(`   · demonstrar o sistema com a ${demo.empresa} — dados fictícios`);
  console.log(`     1 ata, 2 contratos e 5 empenhos em todas as etapas.`);
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
