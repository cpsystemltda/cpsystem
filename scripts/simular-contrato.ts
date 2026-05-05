import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  // Igor é o dono — pegamos a empresa dele
  const igor = await p.usuario.findFirst({
    where: { email: "igor@contratospublicos.com.br" },
    include: { conta: true },
  });
  if (!igor) throw new Error("Igor não encontrado");

  const empresa = await p.empresa.findFirst({ where: { contaId: igor.contaId } });
  if (!empresa) throw new Error("Nenhuma empresa cadastrada para o Igor");
  console.log("Usando empresa:", empresa.nomeFantasia || empresa.razaoSocial);

  // Datas realistas
  const hoje = new Date();
  const assinatura = new Date(hoje); assinatura.setDate(hoje.getDate() - 7);
  const publicacao = new Date(assinatura); publicacao.setDate(assinatura.getDate() + 2);
  const vigenciaInicio = new Date(assinatura);
  const vigenciaFim = new Date(assinatura); vigenciaFim.setMonth(assinatura.getMonth() + 12);

  const contrato = await p.contrato.create({
    data: {
      empresaId: empresa.id,
      tipo: "FORNECIMENTO",
      numero: "082/2024",
      processoAdministrativo: "12.345.678/2024-00",
      procedimentoSelecao: "PREGAO_ELETRONICO",
      numeroLicitacao: "PE 015/2024",
      orgaoNome: "Tribunal Regional Federal — 1ª Região",
      orgaoCnpj: "26991956000128",
      orgaoEndereco: "SAS Quadra 4, Bloco N, Asa Sul, Brasília — DF",
      orgaoEmail: "compras@trf1.jus.br",
      orgaoTelefone: "(61) 3314-5000",
      objeto: "Fornecimento de equipamentos de informática (notebooks e monitores) para reposição do parque tecnológico da seção judiciária",
      dataAssinatura: assinatura,
      dataPublicacao: publicacao,
      vigenciaInicio,
      vigenciaFim,
      prazoEntregaDias: 45,
      prazoPagamentoDias: 30,
      modalidadeEntrega: "PARCELADA",
      marcoInicialPrazo: "ORDEM_FORNECIMENTO",
      itens: {
        create: [
          {
            descricao: "Notebook Dell Latitude 5440, i7-1355U, 16GB, 512GB SSD, tela 14\" FHD",
            unidade: "un",
            quantidade: 30,
            marca: "DELL",
            valorUnitario: 8500,
            valorTotal: 30 * 8500,
          },
          {
            descricao: "Monitor LG 27UN550-W, 27\" 4K UHD IPS",
            unidade: "un",
            quantidade: 30,
            marca: "LG",
            valorUnitario: 2900,
            valorTotal: 30 * 2900,
          },
        ],
      },
      parcelas: {
        create: [
          { numero: 1, prazoDias: 45, descricao: "15 notebooks + 15 monitores (Brasília)", valorEstimado: (15 * 8500) + (15 * 2900) },
          { numero: 2, prazoDias: 90, descricao: "15 notebooks + 15 monitores (filiais)", valorEstimado: (15 * 8500) + (15 * 2900) },
        ],
      },
    },
  });

  console.log("\n✅ Contrato criado:");
  console.log(`   Número: ${contrato.numero}`);
  console.log(`   Órgão: ${contrato.orgaoNome}`);
  console.log(`   Modalidade: ${contrato.modalidadeEntrega}`);
  console.log(`   ID: ${contrato.id}`);
  console.log(`\n🔗 https://cpsystem-three.vercel.app/contratos/${contrato.id}`);
  console.log(`🔗 http://localhost:3001/contratos/${contrato.id}`);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
