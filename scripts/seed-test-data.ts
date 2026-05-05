import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  // Find Igor's conta
  const igor = await p.usuario.findFirst({
    where: { email: "igor@contratospublicos.com.br" },
    include: { conta: true },
  });
  if (!igor) throw new Error("Igor não encontrado");

  // Find or create empresa
  let empresa = await p.empresa.findFirst({ where: { contaId: igor.contaId } });
  if (!empresa) {
    empresa = await p.empresa.create({
      data: {
        contaId: igor.contaId,
        razaoSocial: "Contratos Públicos LTDA",
        nomeFantasia: "Contratos Públicos",
        cnpj: "00000000000100",
        porte: "MEDIA",
        cnaePrincipal: "62.04-0",
        naturezaJuridica: "LTDA",
        endereco: "Brasília — DF",
        cep: "70000-000",
        email: "contato@contratospublicos.com.br",
        telefones: "(61) 99999-9999",
        responsavel: "Igor Fernandes",
      },
    });
  }
  console.log("Empresa:", empresa.id, empresa.nomeFantasia);

  // Create a Contrato direto (não-continuado, parcelada)
  const hoje = new Date();
  const daquiAUmAno = new Date(hoje); daquiAUmAno.setFullYear(hoje.getFullYear() + 1);
  const contrato = await p.contrato.create({
    data: {
      empresaId: empresa.id,
      tipo: "FORNECIMENTO",
      numero: "001/2026",
      processoAdministrativo: "23000.000123/2026-12",
      procedimentoSelecao: "PREGAO_ELETRONICO",
      numeroLicitacao: "PE 015/2026",
      orgaoNome: "Secretaria de Educação - DF",
      orgaoCnpj: "00394676000107",
      orgaoEndereco: "SBS Quadra 9, Brasília - DF",
      orgaoEmail: "compras@se.df.gov.br",
      objeto: "Fornecimento de 100 computadores (50 DELL Inspiron + 50 DELL Allen)",
      dataAssinatura: hoje,
      vigenciaInicio: hoje,
      vigenciaFim: daquiAUmAno,
      prazoEntregaDias: 60,
      prazoPagamentoDias: 30,
      modalidadeEntrega: "PARCELADA",
      marcoInicialPrazo: "ASSINATURA_CONTRATO",
      itens: {
        create: [
          { descricao: "Computador DELL Inspiron i5", unidade: "un", quantidade: 50, marca: "DELL", valorUnitario: 5000, valorTotal: 250000 },
          { descricao: "Computador DELL Allen i7", unidade: "un", quantidade: 50, marca: "DELL", valorUnitario: 7500, valorTotal: 375000 },
        ],
      },
      parcelas: {
        create: [
          { numero: 1, prazoDias: 30, descricao: "50 DELL Inspiron", valorEstimado: 250000 },
          { numero: 2, prazoDias: 60, descricao: "50 DELL Allen", valorEstimado: 375000 },
        ],
      },
    },
  });
  console.log("Contrato:", contrato.id, contrato.numero);

  // Create 3 empenhos in different stages, vinculados ao contrato
  const itens = await p.contratoItem.findMany({ where: { contratoId: contrato.id } });

  // Empenho 1: PAGO (todas as datas preenchidas)
  await p.empenho.create({
    data: {
      empresaId: empresa.id,
      contratoId: contrato.id,
      tipo: "FORNECIMENTO",
      numero: "EMP-001/2026",
      identificador: "1ª parcela",
      processoAdministrativo: contrato.processoAdministrativo,
      procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: contrato.orgaoNome,
      orgaoCnpj: contrato.orgaoCnpj,
      orgaoEndereco: contrato.orgaoEndereco,
      objeto: "1ª parcela: 50 DELL Inspiron",
      dataEmissao: new Date("2026-04-01"),
      vigenciaInicio: new Date("2026-04-01"),
      vigenciaFim: daquiAUmAno,
      status: "PAGO",
      dataPedidoRecebido: new Date("2026-04-05"),
      dataDespacho: new Date("2026-04-12"),
      dataEntrega: new Date("2026-04-25"),
      dataNfEmitida: new Date("2026-04-26"),
      dataNfEncaminhada: new Date("2026-04-27"),
      dataPagamento: new Date("2026-05-02"),
      itens: {
        create: [
          { descricao: itens[0].descricao, unidade: itens[0].unidade, quantidade: 50, marca: itens[0].marca, valorUnitario: itens[0].valorUnitario, valorTotal: 250000 },
        ],
      },
    },
  });

  // Empenho 2: ENTREGUE (em execução, parado nessa etapa)
  await p.empenho.create({
    data: {
      empresaId: empresa.id,
      contratoId: contrato.id,
      tipo: "FORNECIMENTO",
      numero: "EMP-002/2026",
      identificador: "2ª parcela",
      processoAdministrativo: contrato.processoAdministrativo,
      procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: contrato.orgaoNome,
      orgaoCnpj: contrato.orgaoCnpj,
      orgaoEndereco: contrato.orgaoEndereco,
      objeto: "2ª parcela: 50 DELL Allen",
      dataEmissao: new Date("2026-04-15"),
      vigenciaInicio: new Date("2026-04-15"),
      vigenciaFim: daquiAUmAno,
      status: "ENTREGUE",
      dataPedidoRecebido: new Date("2026-04-20"),
      dataDespacho: new Date("2026-04-28"),
      dataEntrega: new Date("2026-05-03"),
      itens: {
        create: [
          { descricao: itens[1].descricao, unidade: itens[1].unidade, quantidade: 50, marca: itens[1].marca, valorUnitario: itens[1].valorUnitario, valorTotal: 375000 },
        ],
      },
    },
  });

  // Empenho 3: EMPENHADO (recém-criado, sem nenhuma execução posterior)
  await p.empenho.create({
    data: {
      empresaId: empresa.id,
      contratoId: contrato.id,
      tipo: "FORNECIMENTO",
      numero: "EMP-003/2026",
      identificador: "Reposição emergencial",
      processoAdministrativo: contrato.processoAdministrativo,
      procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: contrato.orgaoNome,
      orgaoCnpj: contrato.orgaoCnpj,
      orgaoEndereco: contrato.orgaoEndereco,
      objeto: "Empenho recém criado, ainda não executado",
      dataEmissao: new Date(),
      vigenciaInicio: new Date(),
      vigenciaFim: daquiAUmAno,
      status: "EMPENHADO",
      itens: {
        create: [
          { descricao: itens[0].descricao, unidade: itens[0].unidade, quantidade: 5, marca: itens[0].marca, valorUnitario: itens[0].valorUnitario, valorTotal: 25000 },
        ],
      },
    },
  });

  console.log("Seed concluído. Acesse /contratos/" + contrato.id + " para ver a timeline.");
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
