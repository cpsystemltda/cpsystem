// Textos de ajuda exibidos como tooltip ao lado dos campos.
// Centralizado pra revisar tudo num lugar e manter linguagem consistente —
// jurídica/administrativa porém acessível, sem jargão excessivo.

export const AJUDA = {
  // ─── Cadastro de empresa (signup) ───
  porte:
    "Classificação tributária pela Receita Federal:\n" +
    "• MEI: faturamento anual até R$ 81 mil\n" +
    "• ME (Microempresa): até R$ 360 mil\n" +
    "• EPP (Pequeno Porte): até R$ 4,8 milhões\n" +
    "• Médio: até R$ 300 milhões\n" +
    "• Grande: acima disso.\n" +
    "Determina benefícios em licitações (Lei Complementar 123).",

  cnaePrincipal:
    "Código que classifica a atividade econômica principal da empresa (formato 7 dígitos com pontuação, ex.: 6201-5/01). " +
    "Consulta em cnaepesquisa.com.br ou no Cartão CNPJ da Receita.",

  cnaesSecundarios:
    "CNAEs das demais atividades exercidas. Separe múltiplos códigos por vírgula. " +
    "Importante porque algumas licitações exigem CNAE compatível com o objeto.",

  naturezaJuridica:
    "Forma jurídica da empresa segundo o IBGE. Exemplos comuns:\n" +
    "• 206-2: Sociedade Empresária Limitada (LTDA)\n" +
    "• 213-5: EIRELI\n" +
    "• 230-5: SLU (Sociedade Limitada Unipessoal)\n" +
    "• 213-5: Empresário Individual (MEI)\n" +
    "Está no Cartão CNPJ.",

  // ─── Cadastro de analista ───
  cpfAnalista:
    "CPF do analista pessoa física. É usado pelas empresas como chave de vínculo — compartilhe-o com seus clientes para que possam te localizar.",

  bancoAnalista:
    "Conta bancária para recebimento de honorários. As empresas que te vinculam usam esses dados pra fazer o repasse.",

  pixAnalista:
    "Chave PIX (CPF, e-mail, celular ou aleatória) — alternativa rápida à conta bancária. Pelo menos uma das duas formas é recomendada.",

  // ─── Atas ───
  tipoOrgaoAta:
    "Papel do órgão na Ata de Registro de Preços (Lei 14.133):\n" +
    "• Gerenciador: conduz o processo e administra a ata.\n" +
    "• Participante: integra a ata desde o início, com quantitativo próprio.\n" +
    "• Carona (não-participante): adere depois — limitado a 50% do quantitativo por órgão e 200% no total.",

  vigenciaAta:
    "Prazo máximo de 1 (um) ano com possibilidade de prorrogação por mais 1 ano (total: 2 anos). Após esse período, a ata se encerra e não pode mais ser usada.",

  marcoReajuste:
    "Marco inicial do prazo de 12 meses para reajuste de preços:\n" +
    "• Orçamento estimado: usar a data da elaboração do orçamento que embasou a licitação.\n" +
    "• Assinatura da ata: usar a data de assinatura do edital/ata.\n" +
    "• Omisso: edital silente — adotar a data limite da proposta.\n" +
    "Configurável por ata.",

  itemLote:
    "Item de lote vs unitário:\n" +
    "• Unitário: cada item é precificado isoladamente.\n" +
    "• Lote: vários itens precificados em conjunto — vencedor é único.",

  // ─── Contratos ───
  tipoContrato:
    "Categoria do objeto contratado:\n" +
    "• FORNECIMENTO: entrega única ou parcelada de bem.\n" +
    "• FORNECIMENTO_CONTINUO: bem entregue de forma continuada (ex.: combustível).\n" +
    "• SERVICOS: prestação pontual.\n" +
    "• SERVICOS_CONTINUOS: prestação continuada (limpeza, vigilância).\n" +
    "• SERVICOS_DEDICACAO_EXCLUSIVA: equipe alocada exclusivamente.\n" +
    "• LOCACAO: aluguel de bens.\n" +
    "• OBRAS_ENGENHARIA: obras e serviços de engenharia.",

  origemContrato:
    "De onde nasce o contrato:\n" +
    "• Ata SRP: derivado de Ata de Registro de Preços (consome saldo).\n" +
    "• Autônomo: contratação direta (dispensa, inexigibilidade, pregão tradicional).",

  garantiaContrato:
    "Tipo de garantia exigida pelo edital (Lei 14.133, art. 96):\n" +
    "• Caução em dinheiro ou títulos da dívida pública.\n" +
    "• Seguro-garantia.\n" +
    "• Fiança bancária.\n" +
    "Pode-se exigir 5% do valor do contrato (até 10% em casos excepcionais).",

  // ─── Empenhos / Instrumentos ───
  tipoInstrumentoEmpenho:
    "Tipo do instrumento que materializa o compromisso:\n" +
    "• Nota de Empenho (NE): reserva orçamentária — mais comum.\n" +
    "• Carta-Contrato: substitui contrato em valores menores.\n" +
    "• Autorização de Compra (AC): formaliza aquisição.\n" +
    "• Ordem de Serviço (OS): formaliza prestação de serviço.",

  statusEmpenho:
    "Fluxo do empenho até o pagamento:\n" +
    "EMPENHADO → PEDIDO_RECEBIDO → EM_TRANSITO → ENTREGUE → NF_EMITIDA → NF_ENCAMINHADA → PAGO.",

  // ─── Reajuste ───
  indiceReajuste:
    "Índice contratual de reajuste:\n" +
    "• IPCA: oficial da inflação (IBGE).\n" +
    "• INPC: famílias de menor renda (IBGE).\n" +
    "• IGP-M: \"índice do aluguel\" (FGV).\n" +
    "O índice usado deve estar previsto no edital.",

  // ─── Garantia ───
  tipoGarantia:
    "Modalidade da garantia contratual:\n" +
    "• Caução: depósito em dinheiro ou títulos.\n" +
    "• Seguro-garantia: apólice de seguradora.\n" +
    "• Fiança bancária: carta de banco autorizado.",

  endossoGarantia:
    "Aditivo à apólice/carta de garantia quando há prorrogação do contrato ou aumento de valor. " +
    "A garantia precisa cobrir todo o período e o valor atualizado do contrato.",

  // ─── Comissão / Vínculo ───
  percentualComissao:
    "Percentual da comissão variável: aplicado sobre o valor do empenho efetivamente pago pelo órgão à empresa. " +
    "Típico: 5% a 10% — combinado entre empresa e analista.",

  fixoMensal:
    "Honorário fixo mensal cobrado pelo analista independente de produção. " +
    "Cobrado mesmo se não houver empenhos no mês. Geralmente entre R$ 500 e R$ 3.000.",

  diaVencimentoFixo:
    "Dia do mês em que o honorário fixo vence. " +
    "Quando o dia não existe no mês (ex.: 31 em fevereiro), o sistema usa o último dia do mês.",
};

export type ChaveAjuda = keyof typeof AJUDA;
