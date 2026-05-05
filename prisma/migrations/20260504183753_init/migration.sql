-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('EMPRESA', 'ANALISTA');

-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('BASICO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('TRIAL', 'ATIVA', 'INADIMPLENTE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('ASAAS', 'STRIPE', 'DEMO');

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'OPERACIONAL', 'VISUALIZADOR');

-- CreateEnum
CREATE TYPE "PorteEmpresa" AS ENUM ('MEI', 'ME', 'EPP', 'MEDIA', 'GRANDE');

-- CreateEnum
CREATE TYPE "TierEmbaixador" AS ENUM ('BRONZE', 'PRATA', 'OURO', 'DIAMOND');

-- CreateEnum
CREATE TYPE "StatusVinculoAnalista" AS ENUM ('ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoObjeto" AS ENUM ('FORNECIMENTO', 'FORNECIMENTO_CONTINUO', 'SERVICOS', 'SERVICOS_CONTINUOS');

-- CreateEnum
CREATE TYPE "ProcedimentoSelecao" AS ENUM ('PREGAO_ELETRONICO', 'PREGAO_ELETRONICO_INTERNACIONAL', 'PREGAO_PRESENCIAL', 'CONCORRENCIA', 'CONCURSO', 'LEILAO', 'DIALOGO_COMPETITIVO', 'DISPENSA', 'INEXIGIBILIDADE');

-- CreateEnum
CREATE TYPE "Moeda" AS ENUM ('BRL', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "TipoOrgaoNaAta" AS ENUM ('GERENCIADOR', 'PARTICIPANTE', 'CARONA');

-- CreateEnum
CREATE TYPE "FuncaoPontoFocal" AS ENUM ('GESTOR', 'FISCAL_TECNICO', 'FISCAL_ADMINISTRATIVO', 'RESPONSAVEL_SETOR', 'CONTATO_GERAL');

-- CreateEnum
CREATE TYPE "StatusExecucao" AS ENUM ('EMPENHADO', 'PEDIDO_RECEBIDO', 'EM_TRANSITO', 'ENTREGUE', 'NF_EMITIDA', 'NF_ENCAMINHADA', 'PAGO');

-- CreateEnum
CREATE TYPE "NaturezaAlteracao" AS ENUM ('VALOR', 'PRAZO_VIGENCIA', 'PRAZO_ENTREGA', 'ESCOPO', 'REAJUSTE', 'REEQUILIBRIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "InstrumentoReajuste" AS ENUM ('TERMO_ADITIVO', 'APOSTILAMENTO');

-- CreateEnum
CREATE TYPE "IndiceReajuste" AS ENUM ('IPCA', 'IGPM', 'INCC', 'INPC', 'CONTRATUAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusNotificacao" AS ENUM ('RECEBIDA', 'EM_TRATATIVA', 'RESPONDIDA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "FaseProcedimento" AS ENUM ('ABERTURA', 'NOTIFICACAO_DEFESA', 'DEFESA_APRESENTADA', 'PEDIDO_PROVAS', 'DEFERIMENTO_PROVAS', 'NOTIFICACAO_ALEGACOES', 'ALEGACOES_FINAIS', 'DECISAO_1A_INSTANCIA', 'RECURSO', 'DECISAO_FINAL', 'ARQUIVAMENTO', 'PENALIDADE_APLICADA');

-- CreateEnum
CREATE TYPE "TipoPenalidade" AS ENUM ('ADVERTENCIA', 'MULTA', 'IMPEDIMENTO_LICITAR', 'DECLARACAO_INIDONEIDADE');

-- CreateEnum
CREATE TYPE "ModalidadeGarantia" AS ENUM ('SEGURO_GARANTIA', 'FIANCA_BANCARIA', 'CAUCAO_DINHEIRO', 'TITULOS_DIVIDA_PUBLICA');

-- CreateEnum
CREATE TYPE "CategoriaAnexo" AS ENUM ('CONTRATUAL', 'ADITIVO', 'APOSTILAMENTO', 'GARANTIA', 'NOTIFICACAO', 'PROCEDIMENTO', 'NF', 'COMPROVANTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('CRIAR', 'ATUALIZAR', 'EXCLUIR', 'LOGIN', 'LOGOUT', 'EXPORTAR', 'UPLOAD', 'DOWNLOAD');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('CARTAO_CREDITO', 'PIX', 'BOLETO', 'TRANSFERENCIA_BANCARIA');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('PENDENTE', 'PROCESSANDO', 'PAGA', 'ATRASADA', 'CANCELADA', 'ESTORNADA');

-- CreateEnum
CREATE TYPE "TipoNotificacaoSistema" AS ENUM ('PRAZO_PROXIMO', 'STATUS_PAGO', 'NOVA_EXECUCAO', 'VINCULO_CRIADO', 'VINCULO_ENCERRADO', 'COMISSAO_DISPONIVEL', 'AVISO_VENCIMENTO_FATURA');

-- CreateTable
CREATE TABLE "Conta" (
    "id" TEXT NOT NULL,
    "tipo" "TipoConta" NOT NULL DEFAULT 'EMPRESA',
    "plano" "Plano" NOT NULL DEFAULT 'BASICO',
    "statusAssinatura" "StatusAssinatura" NOT NULL DEFAULT 'TRIAL',
    "trialAteEm" TIMESTAMP(3),
    "proximoVencimento" TIMESTAMP(3),
    "termosAceitosEm" TIMESTAMP(3),
    "embaixadorId" TEXT,
    "gatewayProvider" "GatewayProvider",
    "gatewayCustomerId" TEXT,
    "gatewaySubscriptionId" TEXT,
    "ultimaTentativaCobranca" TIMESTAMP(3),
    "bloqueadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'ADMIN',
    "superAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "contaId" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "porte" "PorteEmpresa" NOT NULL,
    "cnaePrincipal" TEXT NOT NULL,
    "cnaesSecundarios" TEXT,
    "naturezaJuridica" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefones" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "contaId" TEXT NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analista" (
    "id" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "contaCorrente" TEXT,
    "pix" TEXT,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "cnpj" TEXT,
    "divulgacaoUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "contaId" TEXT,

    CONSTRAINT "Analista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinculoAnalista" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "analistaId" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "percentualComissao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixoMensal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diaVencimentoFixo" INTEGER NOT NULL DEFAULT 5,
    "status" "StatusVinculoAnalista" NOT NULL DEFAULT 'ATIVO',
    "encerradoEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VinculoAnalista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagamentoFixoMensal" (
    "id" TEXT NOT NULL,
    "vinculoId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "paga" BOOLEAN NOT NULL DEFAULT false,
    "pagaEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagamentoFixoMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comissao" (
    "id" TEXT NOT NULL,
    "analistaId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valorBase" DOUBLE PRECISION NOT NULL,
    "tier" "TierEmbaixador" NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "paga" BOOLEAN NOT NULL DEFAULT false,
    "pagaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ata" (
    "id" TEXT NOT NULL,
    "tipo" "TipoObjeto" NOT NULL,
    "numero" TEXT NOT NULL,
    "processoAdministrativo" TEXT NOT NULL,
    "procedimentoSelecao" "ProcedimentoSelecao" NOT NULL,
    "numeroLicitacao" TEXT,
    "orgaoNome" TEXT NOT NULL,
    "orgaoCnpj" TEXT NOT NULL,
    "orgaoEndereco" TEXT NOT NULL,
    "orgaoEmail" TEXT,
    "orgaoTelefone" TEXT,
    "objeto" TEXT NOT NULL,
    "dataAssinatura" TIMESTAMP(3) NOT NULL,
    "dataPublicacao" TIMESTAMP(3),
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3) NOT NULL,
    "prazoEntregaDias" INTEGER,
    "prazoPagamentoDias" INTEGER,
    "marcoOrcamentoEstimado" TIMESTAMP(3),
    "aceitaCarona" BOOLEAN NOT NULL DEFAULT false,
    "idAtaPncp" TEXT,
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "empresaId" TEXT NOT NULL,

    CONSTRAINT "Ata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtaItem" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "marca" TEXT,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "moeda" "Moeda" NOT NULL DEFAULT 'BRL',
    "ataId" TEXT NOT NULL,

    CONSTRAINT "AtaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgaoNaAta" (
    "id" TEXT NOT NULL,
    "ataId" TEXT NOT NULL,
    "tipo" "TipoOrgaoNaAta" NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "limiteValor" DOUBLE PRECISION,
    "limitePct" DOUBLE PRECISION,

    CONSTRAINT "OrgaoNaAta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnderecoEntrega" (
    "id" TEXT NOT NULL,
    "rotulo" TEXT,
    "endereco" TEXT NOT NULL,
    "ataId" TEXT,
    "contratoId" TEXT,
    "empenhoId" TEXT,
    "orgaoNaAtaId" TEXT,

    CONSTRAINT "EnderecoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PontoFocal" (
    "id" TEXT NOT NULL,
    "funcao" "FuncaoPontoFocal" NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "ataId" TEXT,
    "contratoId" TEXT,
    "empenhoId" TEXT,
    "orgaoNaAtaId" TEXT,

    CONSTRAINT "PontoFocal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" TEXT NOT NULL,
    "tipo" "TipoObjeto" NOT NULL,
    "numero" TEXT NOT NULL,
    "numeroNotaEmpenho" TEXT,
    "processoAdministrativo" TEXT NOT NULL,
    "procedimentoSelecao" "ProcedimentoSelecao" NOT NULL,
    "numeroLicitacao" TEXT,
    "orgaoNome" TEXT NOT NULL,
    "orgaoCnpj" TEXT NOT NULL,
    "orgaoEndereco" TEXT NOT NULL,
    "orgaoEmail" TEXT,
    "orgaoTelefone" TEXT,
    "objeto" TEXT NOT NULL,
    "dataAssinatura" TIMESTAMP(3) NOT NULL,
    "dataPublicacao" TIMESTAMP(3),
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3) NOT NULL,
    "prazoEntregaDias" INTEGER,
    "prazoPagamentoDias" INTEGER,
    "marcoOrcamentoEstimado" TIMESTAMP(3),
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ataId" TEXT,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoItem" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "marca" TEXT,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "moeda" "Moeda" NOT NULL DEFAULT 'BRL',
    "contratoId" TEXT NOT NULL,
    "ataItemId" TEXT,

    CONSTRAINT "ContratoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empenho" (
    "id" TEXT NOT NULL,
    "tipo" "TipoObjeto" NOT NULL,
    "numero" TEXT NOT NULL,
    "identificador" TEXT,
    "processoAdministrativo" TEXT NOT NULL,
    "procedimentoSelecao" "ProcedimentoSelecao" NOT NULL,
    "numeroLicitacao" TEXT,
    "orgaoNome" TEXT NOT NULL,
    "orgaoCnpj" TEXT NOT NULL,
    "orgaoEndereco" TEXT NOT NULL,
    "orgaoEmail" TEXT,
    "orgaoTelefone" TEXT,
    "objeto" TEXT NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "dataPrevistaExecucao" TIMESTAMP(3),
    "dataPrevistaPagamento" TIMESTAMP(3),
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3) NOT NULL,
    "prazoEntregaDias" INTEGER,
    "prazoPagamentoDias" INTEGER,
    "status" "StatusExecucao" NOT NULL DEFAULT 'EMPENHADO',
    "dataPedidoRecebido" TIMESTAMP(3),
    "dataDespacho" TIMESTAMP(3),
    "dataEntrega" TIMESTAMP(3),
    "dataNfEmitida" TIMESTAMP(3),
    "dataNfEncaminhada" TIMESTAMP(3),
    "dataPagamento" TIMESTAMP(3),
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ataId" TEXT,
    "contratoId" TEXT,

    CONSTRAINT "Empenho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpenhoItem" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "marca" TEXT,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "moeda" "Moeda" NOT NULL DEFAULT 'BRL',
    "empenhoId" TEXT NOT NULL,
    "ataItemId" TEXT,

    CONSTRAINT "EmpenhoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermoAditivo" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "dataAssinatura" TIMESTAMP(3) NOT NULL,
    "natureza" TEXT NOT NULL,
    "alteraValor" BOOLEAN NOT NULL DEFAULT false,
    "novoValor" DOUBLE PRECISION,
    "alteraPrazoVigencia" BOOLEAN NOT NULL DEFAULT false,
    "novaVigenciaFim" TIMESTAMP(3),
    "alteraPrazoEntrega" BOOLEAN NOT NULL DEFAULT false,
    "novoPrazoEntregaDias" INTEGER,
    "observacoes" TEXT,
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contratoId" TEXT,
    "empenhoId" TEXT,

    CONSTRAINT "TermoAditivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apostilamento" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "dataAssinatura" TIMESTAMP(3) NOT NULL,
    "natureza" TEXT NOT NULL,
    "alteraValor" BOOLEAN NOT NULL DEFAULT false,
    "novoValor" DOUBLE PRECISION,
    "alteraPrazoVigencia" BOOLEAN NOT NULL DEFAULT false,
    "novaVigenciaFim" TIMESTAMP(3),
    "alteraPrazoEntrega" BOOLEAN NOT NULL DEFAULT false,
    "novoPrazoEntregaDias" INTEGER,
    "observacoes" TEXT,
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contratoId" TEXT,
    "empenhoId" TEXT,

    CONSTRAINT "Apostilamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reajuste" (
    "id" TEXT NOT NULL,
    "dataPedido" TIMESTAMP(3) NOT NULL,
    "dataAprovacao" TIMESTAMP(3),
    "indice" "IndiceReajuste" NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL,
    "valorAnterior" DOUBLE PRECISION NOT NULL,
    "valorNovo" DOUBLE PRECISION NOT NULL,
    "instrumento" "InstrumentoReajuste" NOT NULL,
    "instrumentoNumero" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contratoId" TEXT,
    "empenhoId" TEXT,

    CONSTRAINT "Reajuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "assunto" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataRecebimento" TIMESTAMP(3) NOT NULL,
    "prazoResposta" INTEGER,
    "status" "StatusNotificacao" NOT NULL DEFAULT 'RECEBIDA',
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ataId" TEXT,
    "contratoId" TEXT,
    "empenhoId" TEXT,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AndamentoNotificacao" (
    "id" TEXT NOT NULL,
    "notificacaoId" TEXT NOT NULL,
    "status" "StatusNotificacao" NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataEvento" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AndamentoNotificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedimentoApuratorio" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "notificacaoNumero" TEXT,
    "assunto" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "comissao" TEXT,
    "autoridade" TEXT,
    "dataAbertura" TIMESTAMP(3) NOT NULL,
    "prazoDefesaDias" INTEGER NOT NULL DEFAULT 15,
    "prazoRecursoDias" INTEGER NOT NULL DEFAULT 15,
    "arquivado" BOOLEAN NOT NULL DEFAULT false,
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ataId" TEXT,
    "contratoId" TEXT,
    "empenhoId" TEXT,

    CONSTRAINT "ProcedimentoApuratorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AndamentoProcedimento" (
    "id" TEXT NOT NULL,
    "procedimentoId" TEXT NOT NULL,
    "fase" "FaseProcedimento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataEvento" TIMESTAMP(3) NOT NULL,
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AndamentoProcedimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penalidade" (
    "id" TEXT NOT NULL,
    "procedimentoId" TEXT NOT NULL,
    "tipo" "TipoPenalidade" NOT NULL,
    "valor" DOUBLE PRECISION,
    "duracaoMeses" INTEGER,
    "fundamentacao" TEXT,
    "dataAplicacao" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Penalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garantia" (
    "id" TEXT NOT NULL,
    "modalidade" "ModalidadeGarantia" NOT NULL,
    "seguradora" TEXT,
    "banco" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "descricao" TEXT,
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "contratoId" TEXT,
    "empenhoId" TEXT,

    CONSTRAINT "Garantia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endosso" (
    "id" TEXT NOT NULL,
    "garantiaId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "observacoes" TEXT,
    "arquivoPdfUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Endosso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "tamanhoBytes" INTEGER,
    "categoria" "CategoriaAnexo" NOT NULL DEFAULT 'OUTRO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ataId" TEXT,
    "contratoId" TEXT,
    "empenhoId" TEXT,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anotacao" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ataId" TEXT,
    "contratoId" TEXT,
    "empenhoId" TEXT,

    CONSTRAINT "Anotacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" "AcaoAuditoria" NOT NULL,
    "recurso" TEXT NOT NULL,
    "recursoId" TEXT,
    "resumo" TEXT,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "plano" "Plano" NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'PENDENTE',
    "vencimento" TIMESTAMP(3) NOT NULL,
    "pagaEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "gatewayChargeId" TEXT,
    "gatewayInvoiceUrl" TEXT,
    "pixQrCode" TEXT,
    "pixCopiaCola" TEXT,
    "boletoUrl" TEXT,
    "observacoes" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodoPagamento" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "forma" "FormaPagamento" NOT NULL,
    "apelido" TEXT,
    "bandeira" TEXT,
    "ultimosDigitos" TEXT,
    "validadeMes" INTEGER,
    "validadeAno" INTEGER,
    "gatewayTokenId" TEXT,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetodoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoGateway" (
    "id" TEXT NOT NULL,
    "cobrancaId" TEXT,
    "provider" "GatewayProvider" NOT NULL,
    "evento" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacaoSistema" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacaoSistema" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "link" TEXT,
    "recursoTipo" TEXT,
    "recursoId" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacaoSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoGateway" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "provider" "GatewayProvider" NOT NULL DEFAULT 'DEMO',
    "ambiente" TEXT NOT NULL DEFAULT 'sandbox',
    "apiKey" TEXT,
    "webhookToken" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPor" TEXT,

    CONSTRAINT "ConfiguracaoGateway_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_contaId_idx" ON "Usuario"("contaId");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_token_key" ON "Sessao"("token");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cnpj_key" ON "Empresa"("cnpj");

-- CreateIndex
CREATE INDEX "Empresa_contaId_idx" ON "Empresa"("contaId");

-- CreateIndex
CREATE UNIQUE INDEX "Analista_cpf_key" ON "Analista"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Analista_contaId_key" ON "Analista"("contaId");

-- CreateIndex
CREATE INDEX "VinculoAnalista_contaId_idx" ON "VinculoAnalista"("contaId");

-- CreateIndex
CREATE INDEX "VinculoAnalista_analistaId_idx" ON "VinculoAnalista"("analistaId");

-- CreateIndex
CREATE INDEX "VinculoAnalista_status_idx" ON "VinculoAnalista"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoAnalista_contaId_analistaId_dataInicio_key" ON "VinculoAnalista"("contaId", "analistaId", "dataInicio");

-- CreateIndex
CREATE INDEX "PagamentoFixoMensal_vinculoId_idx" ON "PagamentoFixoMensal"("vinculoId");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoFixoMensal_vinculoId_competencia_key" ON "PagamentoFixoMensal"("vinculoId", "competencia");

-- CreateIndex
CREATE INDEX "Comissao_analistaId_idx" ON "Comissao"("analistaId");

-- CreateIndex
CREATE INDEX "Comissao_contaId_idx" ON "Comissao"("contaId");

-- CreateIndex
CREATE UNIQUE INDEX "Comissao_analistaId_contaId_competencia_key" ON "Comissao"("analistaId", "contaId", "competencia");

-- CreateIndex
CREATE INDEX "Ata_empresaId_idx" ON "Ata"("empresaId");

-- CreateIndex
CREATE INDEX "AtaItem_ataId_idx" ON "AtaItem"("ataId");

-- CreateIndex
CREATE INDEX "OrgaoNaAta_ataId_idx" ON "OrgaoNaAta"("ataId");

-- CreateIndex
CREATE INDEX "EnderecoEntrega_ataId_idx" ON "EnderecoEntrega"("ataId");

-- CreateIndex
CREATE INDEX "EnderecoEntrega_contratoId_idx" ON "EnderecoEntrega"("contratoId");

-- CreateIndex
CREATE INDEX "EnderecoEntrega_empenhoId_idx" ON "EnderecoEntrega"("empenhoId");

-- CreateIndex
CREATE INDEX "EnderecoEntrega_orgaoNaAtaId_idx" ON "EnderecoEntrega"("orgaoNaAtaId");

-- CreateIndex
CREATE INDEX "PontoFocal_ataId_idx" ON "PontoFocal"("ataId");

-- CreateIndex
CREATE INDEX "PontoFocal_contratoId_idx" ON "PontoFocal"("contratoId");

-- CreateIndex
CREATE INDEX "PontoFocal_empenhoId_idx" ON "PontoFocal"("empenhoId");

-- CreateIndex
CREATE INDEX "PontoFocal_orgaoNaAtaId_idx" ON "PontoFocal"("orgaoNaAtaId");

-- CreateIndex
CREATE INDEX "Contrato_empresaId_idx" ON "Contrato"("empresaId");

-- CreateIndex
CREATE INDEX "Contrato_ataId_idx" ON "Contrato"("ataId");

-- CreateIndex
CREATE INDEX "ContratoItem_contratoId_idx" ON "ContratoItem"("contratoId");

-- CreateIndex
CREATE INDEX "ContratoItem_ataItemId_idx" ON "ContratoItem"("ataItemId");

-- CreateIndex
CREATE INDEX "Empenho_empresaId_idx" ON "Empenho"("empresaId");

-- CreateIndex
CREATE INDEX "Empenho_ataId_idx" ON "Empenho"("ataId");

-- CreateIndex
CREATE INDEX "Empenho_contratoId_idx" ON "Empenho"("contratoId");

-- CreateIndex
CREATE INDEX "EmpenhoItem_empenhoId_idx" ON "EmpenhoItem"("empenhoId");

-- CreateIndex
CREATE INDEX "EmpenhoItem_ataItemId_idx" ON "EmpenhoItem"("ataItemId");

-- CreateIndex
CREATE INDEX "TermoAditivo_contratoId_idx" ON "TermoAditivo"("contratoId");

-- CreateIndex
CREATE INDEX "TermoAditivo_empenhoId_idx" ON "TermoAditivo"("empenhoId");

-- CreateIndex
CREATE INDEX "Apostilamento_contratoId_idx" ON "Apostilamento"("contratoId");

-- CreateIndex
CREATE INDEX "Apostilamento_empenhoId_idx" ON "Apostilamento"("empenhoId");

-- CreateIndex
CREATE INDEX "Reajuste_contratoId_idx" ON "Reajuste"("contratoId");

-- CreateIndex
CREATE INDEX "Reajuste_empenhoId_idx" ON "Reajuste"("empenhoId");

-- CreateIndex
CREATE INDEX "Notificacao_ataId_idx" ON "Notificacao"("ataId");

-- CreateIndex
CREATE INDEX "Notificacao_contratoId_idx" ON "Notificacao"("contratoId");

-- CreateIndex
CREATE INDEX "Notificacao_empenhoId_idx" ON "Notificacao"("empenhoId");

-- CreateIndex
CREATE INDEX "AndamentoNotificacao_notificacaoId_idx" ON "AndamentoNotificacao"("notificacaoId");

-- CreateIndex
CREATE INDEX "ProcedimentoApuratorio_ataId_idx" ON "ProcedimentoApuratorio"("ataId");

-- CreateIndex
CREATE INDEX "ProcedimentoApuratorio_contratoId_idx" ON "ProcedimentoApuratorio"("contratoId");

-- CreateIndex
CREATE INDEX "ProcedimentoApuratorio_empenhoId_idx" ON "ProcedimentoApuratorio"("empenhoId");

-- CreateIndex
CREATE INDEX "AndamentoProcedimento_procedimentoId_idx" ON "AndamentoProcedimento"("procedimentoId");

-- CreateIndex
CREATE INDEX "Penalidade_procedimentoId_idx" ON "Penalidade"("procedimentoId");

-- CreateIndex
CREATE INDEX "Garantia_contratoId_idx" ON "Garantia"("contratoId");

-- CreateIndex
CREATE INDEX "Garantia_empenhoId_idx" ON "Garantia"("empenhoId");

-- CreateIndex
CREATE INDEX "Endosso_garantiaId_idx" ON "Endosso"("garantiaId");

-- CreateIndex
CREATE INDEX "Anexo_ataId_idx" ON "Anexo"("ataId");

-- CreateIndex
CREATE INDEX "Anexo_contratoId_idx" ON "Anexo"("contratoId");

-- CreateIndex
CREATE INDEX "Anexo_empenhoId_idx" ON "Anexo"("empenhoId");

-- CreateIndex
CREATE INDEX "Anotacao_ataId_idx" ON "Anotacao"("ataId");

-- CreateIndex
CREATE INDEX "Anotacao_contratoId_idx" ON "Anotacao"("contratoId");

-- CreateIndex
CREATE INDEX "Anotacao_empenhoId_idx" ON "Anotacao"("empenhoId");

-- CreateIndex
CREATE INDEX "LogAuditoria_contaId_idx" ON "LogAuditoria"("contaId");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_criadoEm_idx" ON "LogAuditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "Cobranca_contaId_idx" ON "Cobranca"("contaId");

-- CreateIndex
CREATE INDEX "Cobranca_status_idx" ON "Cobranca"("status");

-- CreateIndex
CREATE INDEX "Cobranca_vencimento_idx" ON "Cobranca"("vencimento");

-- CreateIndex
CREATE INDEX "MetodoPagamento_contaId_idx" ON "MetodoPagamento"("contaId");

-- CreateIndex
CREATE INDEX "EventoGateway_cobrancaId_idx" ON "EventoGateway"("cobrancaId");

-- CreateIndex
CREATE INDEX "EventoGateway_evento_idx" ON "EventoGateway"("evento");

-- CreateIndex
CREATE INDEX "NotificacaoSistema_usuarioId_lida_idx" ON "NotificacaoSistema"("usuarioId", "lida");

-- CreateIndex
CREATE INDEX "NotificacaoSistema_criadoEm_idx" ON "NotificacaoSistema"("criadoEm");

-- AddForeignKey
ALTER TABLE "Conta" ADD CONSTRAINT "Conta_embaixadorId_fkey" FOREIGN KEY ("embaixadorId") REFERENCES "Analista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analista" ADD CONSTRAINT "Analista_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoAnalista" ADD CONSTRAINT "VinculoAnalista_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoAnalista" ADD CONSTRAINT "VinculoAnalista_analistaId_fkey" FOREIGN KEY ("analistaId") REFERENCES "Analista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoFixoMensal" ADD CONSTRAINT "PagamentoFixoMensal_vinculoId_fkey" FOREIGN KEY ("vinculoId") REFERENCES "VinculoAnalista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_analistaId_fkey" FOREIGN KEY ("analistaId") REFERENCES "Analista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ata" ADD CONSTRAINT "Ata_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtaItem" ADD CONSTRAINT "AtaItem_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgaoNaAta" ADD CONSTRAINT "OrgaoNaAta_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnderecoEntrega" ADD CONSTRAINT "EnderecoEntrega_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnderecoEntrega" ADD CONSTRAINT "EnderecoEntrega_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnderecoEntrega" ADD CONSTRAINT "EnderecoEntrega_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnderecoEntrega" ADD CONSTRAINT "EnderecoEntrega_orgaoNaAtaId_fkey" FOREIGN KEY ("orgaoNaAtaId") REFERENCES "OrgaoNaAta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoFocal" ADD CONSTRAINT "PontoFocal_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoFocal" ADD CONSTRAINT "PontoFocal_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoFocal" ADD CONSTRAINT "PontoFocal_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoFocal" ADD CONSTRAINT "PontoFocal_orgaoNaAtaId_fkey" FOREIGN KEY ("orgaoNaAtaId") REFERENCES "OrgaoNaAta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoItem" ADD CONSTRAINT "ContratoItem_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoItem" ADD CONSTRAINT "ContratoItem_ataItemId_fkey" FOREIGN KEY ("ataItemId") REFERENCES "AtaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empenho" ADD CONSTRAINT "Empenho_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empenho" ADD CONSTRAINT "Empenho_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empenho" ADD CONSTRAINT "Empenho_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpenhoItem" ADD CONSTRAINT "EmpenhoItem_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpenhoItem" ADD CONSTRAINT "EmpenhoItem_ataItemId_fkey" FOREIGN KEY ("ataItemId") REFERENCES "AtaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoAditivo" ADD CONSTRAINT "TermoAditivo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoAditivo" ADD CONSTRAINT "TermoAditivo_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apostilamento" ADD CONSTRAINT "Apostilamento_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apostilamento" ADD CONSTRAINT "Apostilamento_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reajuste" ADD CONSTRAINT "Reajuste_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reajuste" ADD CONSTRAINT "Reajuste_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AndamentoNotificacao" ADD CONSTRAINT "AndamentoNotificacao_notificacaoId_fkey" FOREIGN KEY ("notificacaoId") REFERENCES "Notificacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedimentoApuratorio" ADD CONSTRAINT "ProcedimentoApuratorio_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedimentoApuratorio" ADD CONSTRAINT "ProcedimentoApuratorio_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedimentoApuratorio" ADD CONSTRAINT "ProcedimentoApuratorio_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AndamentoProcedimento" ADD CONSTRAINT "AndamentoProcedimento_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "ProcedimentoApuratorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalidade" ADD CONSTRAINT "Penalidade_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "ProcedimentoApuratorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garantia" ADD CONSTRAINT "Garantia_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garantia" ADD CONSTRAINT "Garantia_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endosso" ADD CONSTRAINT "Endosso_garantiaId_fkey" FOREIGN KEY ("garantiaId") REFERENCES "Garantia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anotacao" ADD CONSTRAINT "Anotacao_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anotacao" ADD CONSTRAINT "Anotacao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anotacao" ADD CONSTRAINT "Anotacao_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodoPagamento" ADD CONSTRAINT "MetodoPagamento_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoGateway" ADD CONSTRAINT "EventoGateway_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacaoSistema" ADD CONSTRAINT "NotificacaoSistema_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
