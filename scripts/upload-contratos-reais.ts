import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  const igor = await p.usuario.findFirst({ where: { email: "igor@contratospublicos.com.br" } });
  if (!igor) throw new Error("Igor não encontrado");

  // Cria/recupera empresa C.L.A DOS SANTOS ESTÚDIO sob a conta do Igor
  const cnpjCla = "10284509000167";
  let cla = await p.empresa.findFirst({ where: { cnpj: cnpjCla, contaId: igor.contaId } });
  if (!cla) {
    cla = await p.empresa.create({
      data: {
        contaId: igor.contaId,
        razaoSocial: "C.L.A DOS SANTOS ESTÚDIO",
        nomeFantasia: "CLA DOS SANTOS ESTÚDIO",
        cnpj: cnpjCla,
        porte: "ME",
        cnaePrincipal: "9001-9/04",
        naturezaJuridica: "Empresário individual",
        endereco: "Edifício The Union, Setor de Múltiplas Atividades Sul - SMAS, Trecho 3, Quadra 2, Lote 1, Sala 223-B, Guará, Brasília/DF",
        cep: "71215-220",
        email: "contato@cladossantos.com.br",
        telefones: "(61) 99999-9999",
        responsavel: "Cesar Leonardo Aguiar dos Santos",
      },
    });
    console.log("✅ Empresa criada:", cla.razaoSocial, `(${cla.id})`);
  } else {
    console.log("ℹ️  Empresa já existia:", cla.razaoSocial, `(${cla.id})`);
  }

  // ============================================================
  // CONTRATO 1 — UnB / C.L.A DOS SANTOS ESTÚDIO
  // ============================================================
  const c1Assinatura = new Date("2024-10-16");
  const c1VigenciaFim = new Date("2025-10-16");
  const c1 = await p.contrato.create({
    data: {
      empresaId: cla.id,
      tipo: "SERVICOS_CONTINUOS",
      numero: "82/2024",
      processoAdministrativo: "23106.132644/2023-88",
      procedimentoSelecao: "PREGAO_ELETRONICO",
      numeroLicitacao: "PE 90010/2024",
      orgaoNome: "Universidade de Brasília",
      orgaoCnpj: "00038174000143",
      orgaoEndereco: "Campus Universitário Darcy Ribeiro - Asa Norte - Brasília/DF",
      orgaoEmail: null,
      orgaoTelefone: null,
      objeto:
        "Contratação de serviços para planejamento, organização e fornecimento da infraestrutura requerida para a realização de eventos institucionais, colações de grau, outorgas de títulos e posses promovidos ou apoiados pela UnB, abrangendo o Distrito Federal e a região Centro-Oeste, sob demanda e sem dedicação de mão de obra exclusiva (Grupo 2 — Locação e instalação de equipamentos)",
      dataAssinatura: c1Assinatura,
      vigenciaInicio: c1Assinatura,
      vigenciaFim: c1VigenciaFim,
      prazoEntregaDias: null,
      prazoPagamentoDias: 30,
      modalidadeEntrega: "SOB_DEMANDA",
      marcoInicialPrazo: null,
      itens: {
        create: [
          {
            descricao: "Equipamento de áudio e vídeo para Colação de Grau (CATSER 12556)",
            unidade: "diária",
            quantidade: 120,
            valorUnitario: 800,
            valorTotal: 120 * 800,
          },
          {
            descricao: "Equipamentos de áudio e vídeo para Recepção - alunos e servidores (CATSER 12556)",
            unidade: "diária",
            quantidade: 6,
            valorUnitario: 650,
            valorTotal: 6 * 650,
          },
          {
            descricao: "Técnico Audiovisual (CATSER 25631)",
            unidade: "diária",
            quantidade: 126,
            valorUnitario: 150,
            valorTotal: 126 * 150,
          },
        ],
      },
    },
  });
  console.log(`\n✅ Contrato 1 criado: ${c1.numero} — ${c1.orgaoNome}`);
  console.log(`   ID: ${c1.id}`);

  // ============================================================
  // CONTRATO 2 — CFQ / C.L.A DOS SANTOS ESTÚDIO
  // ============================================================
  const c2Assinatura = new Date("2025-06-06");
  // 280 dias após assinatura
  const c2VigenciaFim = new Date(c2Assinatura);
  c2VigenciaFim.setDate(c2Assinatura.getDate() + 280);

  // Datas dos eventos: 26/06/2025 e 11/12/2025
  const diaQuimico = new Date("2025-06-26");
  const encerramento = new Date("2025-12-11");
  const dias = (d: Date) => Math.round((d.getTime() - c2Assinatura.getTime()) / (1000 * 60 * 60 * 24));

  const c2 = await p.contrato.create({
    data: {
      empresaId: cla.id,
      tipo: "SERVICOS",
      numero: "18/2025",
      processoAdministrativo: "2800.00.00167.2025",
      procedimentoSelecao: "PREGAO_ELETRONICO",
      numeroLicitacao: "PE 90002/2025",
      orgaoNome: "Conselho Federal de Química",
      orgaoCnpj: "33839275000172",
      orgaoEndereco:
        "Setor Comercial Sul, Quadra 09, bloco A, Torre B, 9° andar, Ed. Parque Cidade Corporate, Asa Sul, Brasília/DF",
      orgaoEmail: null,
      orgaoTelefone: "(61) 2099-3300",
      objeto:
        "Contratação de empresa especializada para fornecimento de espaço e demais itens necessários à instrumentalização das ações Dia do Químico (26/06/2025) e Encerramento das Atividades do CFQ 2025 (11/12/2025)",
      dataAssinatura: c2Assinatura,
      vigenciaInicio: c2Assinatura,
      vigenciaFim: c2VigenciaFim,
      prazoPagamentoDias: 30,
      modalidadeEntrega: "PARCELADA",
      marcoInicialPrazo: "ASSINATURA_CONTRATO",
      itens: {
        create: [
          // GRUPO 1 - Dia do Químico (26/06/2025)
          { descricao: "Espaço — Dia do Químico (CATSER 22721)", unidade: "evento", quantidade: 1, valorUnitario: 15000, valorTotal: 15000 },
          { descricao: "Recursos Humanos — Dia do Químico (CATSER 14591)", unidade: "evento", quantidade: 1, valorUnitario: 12000, valorTotal: 12000 },
          { descricao: "Itens de apoio para 250 pessoas — Dia do Químico (CATSER 17019)", unidade: "evento", quantidade: 1, valorUnitario: 17000, valorTotal: 17000 },
          { descricao: "Atração Musical — Dia do Químico (CATSER 12610)", unidade: "evento", quantidade: 1, valorUnitario: 6000, valorTotal: 6000 },
          { descricao: "Buffet para 250 pessoas — Dia do Químico (CATSER 15210)", unidade: "evento", quantidade: 1, valorUnitario: 49900, valorTotal: 49900 },
          // GRUPO 2 - Encerramento (11/12/2025)
          { descricao: "Espaço — Encerramento CFQ 2025 (CATSER 22721)", unidade: "evento", quantidade: 1, valorUnitario: 15000, valorTotal: 15000 },
          { descricao: "Recursos Humanos — Encerramento CFQ 2025 (CATSER 14591)", unidade: "evento", quantidade: 1, valorUnitario: 10000, valorTotal: 10000 },
          { descricao: "Itens de apoio para 250 pessoas — Encerramento CFQ 2025 (CATSER 17019)", unidade: "evento", quantidade: 1, valorUnitario: 13800, valorTotal: 13800 },
          { descricao: "Atração Musical — Encerramento CFQ 2025 (CATSER 12610)", unidade: "evento", quantidade: 1, valorUnitario: 6000, valorTotal: 6000 },
          { descricao: "Buffet para 250 pessoas — Encerramento CFQ 2025 (CATSER 15210)", unidade: "evento", quantidade: 1, valorUnitario: 49900, valorTotal: 49900 },
        ],
      },
      parcelas: {
        create: [
          { numero: 1, prazoDias: dias(diaQuimico), descricao: "Grupo 1 — Dia do Químico (26/06/2025)", valorEstimado: 99900 },
          { numero: 2, prazoDias: dias(encerramento), descricao: "Grupo 2 — Encerramento das Atividades CFQ 2025 (11/12/2025)", valorEstimado: 94700 },
        ],
      },
    },
  });
  console.log(`\n✅ Contrato 2 criado: ${c2.numero} — ${c2.orgaoNome}`);
  console.log(`   ID: ${c2.id}`);

  console.log("\n🔗 Links pra acessar:");
  console.log(`   https://cpsystem-three.vercel.app/contratos/${c1.id}`);
  console.log(`   https://cpsystem-three.vercel.app/contratos/${c2.id}`);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
