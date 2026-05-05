/** Seed minimal para validar a nova timeline. Rodar reset-dados.ts depois pra limpar. */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const igor = await p.usuario.findFirst({ where: { email: "igor@contratospublicos.com.br" } });
  if (!igor) throw new Error("Igor não encontrado");

  const empresa = await p.empresa.create({
    data: {
      contaId: igor.contaId,
      razaoSocial: "Teste Timeline LTDA", nomeFantasia: "Teste Timeline",
      cnpj: "11111111000111", porte: "ME", cnaePrincipal: "62.04-0",
      naturezaJuridica: "LTDA", endereco: "Brasília — DF", cep: "70000000",
      email: "teste@x.com", telefones: "(61) 99999-9999", responsavel: "Igor",
    },
  });

  const hoje = new Date();
  const fim = new Date(hoje); fim.setMonth(hoje.getMonth() + 6);

  const contrato = await p.contrato.create({
    data: {
      empresaId: empresa.id, tipo: "FORNECIMENTO", numero: "TIMELINE/2026",
      processoAdministrativo: "TESTE-001", procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: "Órgão Teste", orgaoCnpj: "00000000000100", orgaoEndereco: "Brasília",
      objeto: "Teste visual da timeline", dataAssinatura: hoje,
      vigenciaInicio: hoje, vigenciaFim: fim, modalidadeEntrega: "INTEGRAL",
      marcoInicialPrazo: "ASSINATURA_CONTRATO",
      itens: { create: [{ descricao: "Item teste", unidade: "un", quantidade: 1, valorUnitario: 1000, valorTotal: 1000 }] },
    },
  });

  // 3 empenhos em estágios diferentes
  await p.empenho.create({
    data: {
      empresaId: empresa.id, contratoId: contrato.id, tipo: "FORNECIMENTO",
      numero: "EMP-001", processoAdministrativo: "T", procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: "Órgão Teste", orgaoCnpj: "00000000000100", orgaoEndereco: "Brasília",
      objeto: "Empenho PAGO (todas etapas concluídas)", dataEmissao: new Date("2026-04-01"),
      vigenciaInicio: hoje, vigenciaFim: fim, status: "PAGO",
      dataPedidoRecebido: new Date("2026-04-05"), dataDespacho: new Date("2026-04-12"),
      dataEntrega: new Date("2026-04-25"), dataNfEmitida: new Date("2026-04-26"),
      dataNfEncaminhada: new Date("2026-04-27"), dataPagamento: new Date("2026-05-02"),
      itens: { create: [{ descricao: "Item teste", unidade: "un", quantidade: 1, valorUnitario: 1000, valorTotal: 1000 }] },
    },
  });
  await p.empenho.create({
    data: {
      empresaId: empresa.id, contratoId: contrato.id, tipo: "FORNECIMENTO",
      numero: "EMP-002", processoAdministrativo: "T", procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: "Órgão Teste", orgaoCnpj: "00000000000100", orgaoEndereco: "Brasília",
      objeto: "Empenho ENTREGUE (4 etapas concluídas, atual=4)", dataEmissao: new Date("2026-04-15"),
      vigenciaInicio: hoje, vigenciaFim: fim, status: "ENTREGUE",
      dataPedidoRecebido: new Date("2026-04-20"), dataDespacho: new Date("2026-04-28"),
      dataEntrega: new Date("2026-05-03"),
      itens: { create: [{ descricao: "Item teste", unidade: "un", quantidade: 1, valorUnitario: 1000, valorTotal: 1000 }] },
    },
  });
  const empNovo = await p.empenho.create({
    data: {
      empresaId: empresa.id, contratoId: contrato.id, tipo: "FORNECIMENTO",
      numero: "EMP-003", processoAdministrativo: "T", procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: "Órgão Teste", orgaoCnpj: "00000000000100", orgaoEndereco: "Brasília",
      objeto: "Empenho EMPENHADO (estado inicial)", dataEmissao: hoje,
      vigenciaInicio: hoje, vigenciaFim: fim, status: "EMPENHADO",
      itens: { create: [{ descricao: "Item teste", unidade: "un", quantidade: 1, valorUnitario: 1000, valorTotal: 1000 }] },
    },
  });

  console.log("contratoId:", contrato.id);
  console.log("empenhoNovoId:", empNovo.id);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
