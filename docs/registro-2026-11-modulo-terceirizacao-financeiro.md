# Registro — 07 a 11/11/2026

Módulo Terceirização (especificação do Igor), API para clientes, DRE e cobranças lidos do Asaas.

Tudo abaixo está em produção (cpsystem.app.br), no GitHub (`main`) e testado. Os detalhes de cada item estão nos commits citados.

---

## 1. Módulo Terceirização — documento do Igor

Documento: "04 - Especificações do Módulo Terceirização (ESP-001 a ESP-019)"
https://docs.google.com/document/d/1DeexyhFiJZCwaHm45KwU0vurDBcos93N0y2i_Ju1oGA

### Pronto

| Item | O que faz | Commit |
|---|---|---|
| AJ-01 a 03 | Ajustes iniciais | ade8c13 |
| ESP-001 | Regime legal (8.666 / 14.133), tipologia de mão de obra, limite de prorrogação | 61be18f |
| ESP-002 | Postos de trabalho e valor mensal do contrato | 06e3608 |
| ESP-003 | Planilha de custos por função, versionada; IA lê PDF/Excel; exporta Excel e PDF | f1d8651 |
| ESP-004 | Competências mensais automáticas (etapas: medição, doc. trabalhista, NF, ateste, pagamento) | e7a6cf1 |
| ESP-005 | Medição, glosas (com minuta de contestação por IA) e IMR | a21fa5b |
| ESP-006 | Conta vinculada (Anexo XII da IN 5/2017, editável no admin), pedidos de liberação, extratos | 59957db |
| ESP-007 | LGPD: adendo com aceite, perfil RH, CPF criptografado, auditoria de acesso | 786ccc6 |
| ESP-008 | Colaboradores, importação por planilha, alocação em postos, retenção e anonimização | 7b0c911 |
| ESP-009 | Checklist mensal de comprovação (art. 50 da 14.133 / IN 5/2017) | 000d1fc |
| ESP-010 | Dossiê da competência para o fiscal (PDF, ZIP com anexos, Excel) | 13db703 |
| ESP-011 | Módulo só no Premium e no teste; 90 dias de somente leitura ao perder o plano; contagem diária de colaboradores e faixa do mês; painel do admin | 0a474b8, b6397f5 |

### Faixas de colaboradores (Anexo B.1) — aprovadas pela Regina em 10/11

| Faixa | Colaboradores ativos (pico do mês) | Adicional mensal ao Premium |
|---|---|---|
| 1 | até 25 | incluído |
| 2 | 26 a 50 | R$ 197,00 |
| 3 | 51 a 100 | R$ 347,00 |
| 4 | 101 a 200 | R$ 597,00 |
| 5 | 201 a 400 | R$ 997,00 |
| 6 | 401 a 700 | R$ 1.497,00 |
| — | acima de 700 | sob consulta |

- Ligado em produção em 10/11 (`terceirizacao.cobrancaAtiva`). Clientes pagantes veem a faixa e recebem aviso aos 90% do limite e na mudança de faixa. Contas em teste veem a estimativa nos últimos 3 dias.
- Valores editáveis em **Admin › Terceirização · faixas**.
- **Cobrança do adicional:** ao fechar o mês, aparece em Admin › Terceirização · faixas com o botão "Lançar no Asaas". A cobrança é avulsa (competência `AAAA-MM-TERCEIRIZACAO`) e vence junto com a próxima mensalidade. Paga, **não** mexe no vencimento da assinatura.

### Falta

- **ESP-012** — convenções coletivas (CCTs) ligadas às funções. Próximo item.
- **ESP-013** — componentes de custo e janelas de repactuação.
- **ESP-014** — simulador de repactuação.
- **ESP-015** — preclusão (entendimento do TCU).
- **ESP-016** — férias e coberturas.
- **ESP-017** — documentos dos colaboradores e cotas.
- **ESP-018** — alertas.
- **ESP-019** — relatórios.

### Decisões em aberto

- Cláusula de cobrança por faixa (Anexo B.2) nos Termos de Uso e tabela de faixas na página de planos — aguardando revisão do Igor (enviada a ele em 10/11).
- Adendo LGPD: nome e e-mail do encarregado de dados; onde publicar a lista de suboperadores; conferir as Resoluções ANPD 15/2024 e 19/2024 citadas.
- Se Notas e Conciliação devem mostrar as competências.

### Cliente piloto: Sonne da Amazônia

- Contrato 005/2023 com a Prefeitura de Cantá/RR, 170 postos. Teste até **14/11/2026**.
- Em 10/11 a Isabela recebeu pelo WhatsApp a apresentação do módulo com 5 telas (dados de demonstração). Ela ainda precisa aceitar o adendo LGPD para o módulo abrir.

---

## 2. API do CP System (pedido do Léo / Green) — commit 3bd1ea5

- Documentação pública: https://cpsystem.app.br/desenvolvedores
- O administrador da conta gera o token em **Conta › Integrações › API do CP System** (o token aparece uma vez; no banco fica só o hash).
- Endpoints: `/api/v1/status`, `/eventos`, `/execucoes`, `/execucoes/{id}`, `/execucoes/{id}/pagamento` (baixa, mesmo efeito do botão "Pago"), `/contratos`, `/atas`.
- Escopos `leitura` e `pagamentos:escrita`; 120 chamadas por minuto.
- Testada em produção em 09/11 (token temporário na conta de teste, apagado depois). Orientações enviadas ao Léo e ao Igor em 09/11.
- Pendente do Léo: descrição completa do item (o outro pedido do vídeo).

---

## 3. Financeiro: Clientes, DRE e cobranças lidos do Asaas

### Clientes (admin)
- Cada cliente mostra a última cobrança paga e o próximo pagamento, lidos do Asaas.
- Construtora Modelo marcada como **conta de teste** (`Conta.contaTeste`, migration `20261109160000_conta_teste`): fica fora de MRR, DRE e métricas.
- Coluna "Colaboradores · faixa" e filtro "Usa Módulo Terceirização".

### DRE (commits de634d7, fb52a9e, ced4ac7, fd7440d)
- **Receita:** cobranças do Asaas. O mês de cada cobrança vem do nosso registro (`Cobranca.competencia`); sem registro, do vencimento original no Asaas.
- **Taxas do Asaas:** pelo extrato (PIX, cartão, mensageria, nota, antecipação).
- **Despesas:** todas as saídas da conta Asaas, classificadas pelo destinatário. A categoria pode ser trocada na tela, no quadro "Saídas da conta Asaas". Comissões de analistas ficam na linha própria.
- **Aportes dos sócios** (PIX direto na chave, sem cobrança) **não são receita**: quadro próprio. Até 09/11: Igor R$ 4.950,00; Regina R$ 4.200,00.
- **Retiradas e reembolsos aos sócios:** fora do resultado.
- **Não aparece no DRE:** despesas pagas fora do Asaas (cartão, outro banco: Vercel, Anthropic, Neon, Z-API). Precisam ser lançadas à mão no formulário da página.

### Monitor de cobranças (commits b6397f5, 89236c4, fd7440d)
- Todo dia às 11h (cron `ciclo-de-vida`) confere no Asaas cada cliente pagante e avisa no grupo de Suporte:
  - cobrança em dobro (mesmo mês e mesmo valor);
  - cobrança vencida e não paga;
  - cliente sem próxima cobrança;
  - vencimento fora do dia escolhido;
  - adicional de faixa ainda não lançado.
- Só aponta. Não cria, altera nem cancela cobrança.
- Conferência manual (somente leitura): `GET /api/admin/financeiro-asaas?secret=CRON_SECRET` (`&monitor=1` roda o monitor; `&saidas=1` mostra o extrato bruto).

### Caso Green (20/11)
Não é cobrança em dobro. O PIX de 21/10 quitou outubro, mas o Asaas remarcou a data dele para 20/11 depois da troca de cartão. A cobrança avulsa pendente de 20/11 é a de novembro, legítima.

---

## 4. Correções de tela encontradas no caminho

- Conta vinculada: alertas mostravam "R$ 20000.00"; agora em reais formatados (0634f53).
- Conta vinculada: status da competência aparecia "em execucao"; agora usa o rótulo correto (0634f53).
