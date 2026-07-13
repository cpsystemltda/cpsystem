# CP System — Pendências Empresariais e Plano de Execução

**Versão 2 · 10/06/2026 · Pré-lançamento agosto/2026**

Documento de referência das obrigações empresariais para a CP System estar pronta legal, fiscal, operacional e contratualmente até o lançamento oficial em agosto/2026.

Estruturado por bloco, com recomendação específica em cada item e cronograma de execução nas últimas seções.

> **Atualização v2 (10/06/2026):** revisão de metas, aporte, modelo de operação sem rosto e modelo de comissão do SDR. Ver seção *Visão Geral* e seção *Contratação do SDR* para detalhes.

---

## VISÃO GERAL

A CP System é um SaaS B2B brasileiro que vende para empresas que operam no mercado público. Modelo de negócio:

- **Sócios 50/50:** Regina e Igor.
- **Bootstrap (sem captação externa).**
- **Aporte inicial total: R$ 6.550** — R$ 3.275 por sócio, sendo R$ 775 já aportado + R$ 2.500 adicional pra cobrir os 3 primeiros meses de operação pré-receita estável.
- **Metas em três fases** (calibradas com benchmarks de SaaS B2B BR bootstrap — Conta Azul, Pipefy, Asaas levaram 3-5 anos pra atingir R$ 1M MRR mesmo com captação):
  - **Dez/2026 (5 meses pós-lançamento):** R$ 50.000 MRR — validação de product-market fit, primeiros 50 clientes Premium ou equivalente em mix.
  - **Dez/2027:** R$ 300.000 MRR — escala operacional comprovada, time pequeno funcionando, ~300 clientes ativos.
  - **Fev/2029:** R$ 1.000.000 MRR — meta final original mantida.
- **Lançamento oficial:** agosto/2026.
- **Operação automatizada com IA, sem rosto humano público dos sócios.** Atendimento ao cliente é feito por chat/WhatsApp por humanos (Regina e Igor, depois SDR), mas a marca é a CP System — não há personificação dos sócios em marketing público. Transparência declarada no rodapé do site: "Operamos com automação e IA para manter preço acessível. Sua empresa fala com a Equipe CP System por chat e WhatsApp."
- **SDR comissionado com modelo decrescente alinhado à retenção:**
  - **Mês 1-6 do cliente:** SDR recebe 5% do MRR daquele cliente.
  - **Mês 7-18 do cliente:** SDR recebe 2% do MRR, condicionado a o cliente ainda estar ativo.
  - **Mês 19 em diante:** zero — receita do cliente vira lucro puro da empresa.
  - **Quando contratar:** funil atingir 50+ leads acumulados (provável outubro/novembro 2026).
  - Esse modelo substitui o "3% vitalício" original — reduz passivo de longo prazo em ~70-80% e alinha o SDR com a retenção (vital pra SaaS).

### Nota sobre alinhamento entre sócios

Igor expressou desejo de atingir R$ 1M MRR já em dezembro/2026. Calibragem honesta: sem captação externa, isso exigiria ~770 vendas em 5 meses (~5/dia útil) com investimento de R$ 1,5M em marketing/vendas. **Inviável bootstrap.** Caminhos alternativos discutidos:

1. **Aceitar a calibragem em 3 fases** (recomendado) — sustentável, sem comprometer caixa.
2. **Captar anjo R$ 300-500k em troca de 10-15% de equity** — reduziria o prazo pra R$ 1M MRR pra ~18-20 meses, mas quebra a premissa "sem captação". Decisão dos sócios.

Esse documento adota a opção 1. Se a opção 2 entrar em discussão, novas pendências aparecem (term sheet, due diligence, vesting cliff revisto).

---

Esse documento é a lista de tudo que precisa estar pronto **antes** do dia 1 do lançamento para a empresa operar legalmente e sem fricção.

---

## 1. JURÍDICO E SOCIETÁRIO

### 1.1 Constituição da empresa

☐ **Abrir CNPJ da CP System**
**Recomendação:** Sociedade Limitada (LTDA), 2 quotistas (Regina e Igor) com 50% cada.
**Por quê:** SLU não funciona pra 2 sócios. EIRELI foi extinta. LTDA é o padrão atual e mais barato pra startup BR.
**Como:** plataforma Contabilizei abre CNPJ completo por R$ 99 (sai com inscrição estadual/municipal incluída) ou advogado/contador local (R$ 800-1.500).
**Documentos necessários:** RG/CPF dos sócios, comprovante de endereço da sede, contrato social, certidão negativa.
**Prazo:** 7-15 dias úteis.

☐ **Definir endereço da sede**
**Recomendação:** endereço comercial virtual de baixo custo (R$ 80-150/mês: Coworking & Office, BeerOrCoffee, Regus) **OU** endereço residencial de um dos sócios.
**Por quê:** endereço residencial dispara IPTU comercial em alguns municípios e exige autorização do condomínio. Virtual blinda e dá flexibilidade.

☐ **Capital social no contrato**
**Recomendação:** R$ 6.500 (R$ 3.250 por sócio integralizado). Espelhe o aporte total ajustado (R$ 6.550) com leve arredondamento. Esse valor inclui o aporte adicional aprovado em v2 (R$ 2.500 por sócio).
**Por quê:** capital muito baixo (R$ 100) compromete imagem se aparecer em consulta. Capital alto demais (R$ 50k) gera obrigação de integralizar.

☐ **Atividade econômica (CNAE)**
**Recomendação principal:** 6201-5/01 (Desenvolvimento de programas de computador sob encomenda) + 6202-3/00 (Desenvolvimento e licenciamento de programas customizáveis) + 6311-9/00 (Tratamento de dados, hospedagem).
**Por quê:** classifica como software/SaaS — habilita Simples Nacional Anexo III (alíquota inicial 6%).

### 1.2 Contrato Social e Acordo de Sócios

☐ **Contrato social com cláusulas mínimas:**
- Quota 50/50.
- Administração conjunta (ambos podem assinar individualmente ou exigir assinatura dupla acima de X reais — recomendo dupla acima de R$ 5.000).
- Distribuição de lucros proporcional às quotas.
- Direito de preferência em caso de saída.
- Foro de eleição: comarca onde está a sede.

☐ **Acordo de sócios em documento SEPARADO** (não vai pra Junta Comercial — fica entre os sócios):
- **Vesting reverso de 4 anos com cliff de 1 ano**: se um sócio sair antes de 12 meses, perde 100% das quotas. Entre 12 e 48 meses, perde proporcionalmente. Após 48 meses, está "vested" 100%.
- **Não-concorrência**: sócio que sair não pode criar/trabalhar em produto concorrente por 2 anos.
- **Cláusula de saída involuntária**: morte, invalidez, divórcio — quem fica tem direito de preferência na compra das quotas.
- **Drag along / tag along**: se um sócio quiser vender e aparecer comprador da maioria, o outro pode (e em alguns casos é obrigado a) vender junto.
- **Forma de resolução de conflito**: arbitragem ou foro específico.

**Recomendação prática:** advogado pessoa física especializado em startups (R$ 1.500-3.500 documento completo) **OU** modelo pronto da Mais MEI / Contabilizei (R$ 300-500) adaptado pelo casal de sócios.

**Não use modelo do Google sem revisar.** Acordo de sócios mal feito é a causa nº 1 de morte de startup brasileira por brigas societárias.

### 1.3 Marca registrada (INPI)

☐ **Registrar a marca "CP System" no INPI** nas classes:
- **Classe 9** — softwares de computador (programas baixáveis/SaaS).
- **Classe 42** — serviços de tecnologia / SaaS / consultoria em informática.

**Custo:** R$ 415 por classe (pedido) + R$ 745 por classe (concessão se aprovada). Total: ~R$ 2.320 pra ambas as classes.
**Prazo:** 12-18 meses do pedido à concessão.
**Recomendação:** fazer agora. Marca aprovada blinda contra concorrente copiar o nome e impede você de ter que rebatizar lá na frente.
**Como:** site INPI direto (Regina/Igor preenchem) ou plataforma Gerencia Marcas / Marcas Online (R$ 200-400 de honorário).

☐ **Registrar o software no INPI (opcional)** — Programa de Computador.
**Custo:** R$ 195.
**Por quê:** comprovação formal de autoria. Útil se houver litígio de propriedade intelectual.
**Recomendação:** fazer 6 meses após lançamento, quando o código estiver mais estável.

---

## 2. TRIBUTÁRIO E CONTÁBIL

### 2.1 Contador

☐ **Contratar contador online**
**Recomendação:** **Contabilizei** (R$ 99-149/mês plano SaaS).
**Por quê:** preço fixo, atendimento por chat, integra com Asaas via API (importa NFs automaticamente), tem plataforma própria. Conhece SaaS BR. Alternativas: Agilize, Conube — todas equivalentes em preço e qualidade.
**Custo total ano 1:** R$ 1.200-1.800.

### 2.2 Regime tributário

☐ **Optar pelo Simples Nacional — Anexo III**
**Por quê:** SaaS sob CNAE 6201/6202 entra no Anexo III, com alíquota inicial de **6%** sobre receita bruta até R$ 180.000/ano. Vai escalando até 14% no teto (R$ 4,8 milhões/ano).
**Cuidado:** se passar de R$ 4,8M/ano (vai acontecer em ~2028 no seu plano), precisa migrar pra Lucro Presumido ou Real. Contador avisa com antecedência.

**Comparativo rápido:**
- Simples até R$ 360k/ano: ~6-11% sobre receita.
- Lucro Presumido (sai do Simples): ~13-16% sobre receita.
- Lucro Real: só vale com margem baixa (não é seu caso).

**Conclusão:** Simples até o lançamento e nos primeiros anos. Reavaliar quando passar de R$ 3M de receita anual.

### 2.3 Inscrição Municipal e ISS

☐ **Inscrição Municipal ativa** (obrigatória pra emitir NFS-e).
**Como:** Contabilizei faz junto com a abertura do CNPJ. Necessária na prefeitura da sede da empresa.

☐ **Alíquota de ISS confirmada com o município**
**Faixa nacional:** 2% a 5% (depende do município). Capitais grandes: SP é 2.9%, RJ é 5%, BH é 3%.
**Recomendação:** se ainda não definiu sede, considere municípios com ISS mais baixo (Barueri 2%, Santana de Parnaíba 2%) — economia significativa em volume.

### 2.4 Certificado Digital A1

☐ **Comprar certificado digital A1 da empresa**
**Recomendação:** Certisign, Soluti, Serasa Experian.
**Custo:** R$ 180-280/ano (renovação anual).
**Por quê:** obrigatório pra emitir NFS-e automática pelo Asaas, assinar contratos digitalmente, transmitir obrigações acessórias.

### 2.5 Pró-labore e distribuição de lucros

☐ **Definir política de retirada dos sócios**
**Recomendação inicial (caixa apertado pré-receita):**
- Pró-labore mínimo (1 salário mínimo cada) — obriga INSS 11% sobre o pró-labore.
- Distribuição de lucros isenta de IR (vantagem fiscal).

**Quando atingir MRR ~R$ 30k/mês:** subir pró-labore pra R$ 3-5k cada e manter distribuição como complemento.

**Discutir com o contador na 1ª reunião.**

---

## 3. DOMÍNIOS, MARCA E E-MAIL

☐ **Registrar `cpsystem.com.br`** no Registro.br (R$ 40/ano).
☐ **Registrar `cpsystem.com`** (~R$ 60/ano via Namecheap ou GoDaddy) — proteção contra cybersquatting.
☐ **Apontar DNS pra Vercel** (substituir `cpsystem-three.vercel.app` pelo domínio próprio antes do lançamento — credibilidade B2B).
☐ **Google Workspace Business Starter** (R$ 30/usuário/mês) com e-mails:
- `regina@cpsystem.com.br`
- `igor@cpsystem.com.br`
- `contato@cpsystem.com.br` (encaminha pros dois)
- `financeiro@cpsystem.com.br`
- `ads@cpsystem.com.br`
- `suporte@cpsystem.com.br`
- `noreply@cpsystem.com.br` (transacional via Resend)

**Custo mensal Workspace:** R$ 60 (2 usuários reais — os demais são aliases gratuitos).

**Alternativa zero custo:** Zoho Mail (5 usuários grátis no plano free com domínio próprio). Mais simples mas integra menos com o resto da operação.

☐ **Pasta compartilhada Google Drive** com estrutura:
- `01-Societário` (contrato social, acordo, atas)
- `02-Fiscal` (NFs emitidas, NFs recebidas, certificado digital)
- `03-Bancário` (extratos, conciliação)
- `04-Comercial` (contratos com clientes B2B, propostas)
- `05-Marketing` (campanhas, criativos, plano)
- `06-Produto` (HANDOFF, decisões de produto)
- `07-Jurídico` (LGPD, termos, ações)

---

## 4. COMPLIANCE E LGPD

### 4.1 Documentos obrigatórios no site

☐ **Política de Privacidade pública em `/privacidade`**
Conteúdo mínimo (LGPD art. 9):
- Quais dados coleta (cadastro, uso, cookies).
- Finalidade do tratamento.
- Compartilhamento com sub-operadores (Vercel, Neon, Anthropic, Asaas, Resend).
- Direitos do titular (acesso, correção, exclusão, portabilidade).
- Contato do DPO.

☐ **Termos de Uso públicos em `/termos`**
Conteúdo mínimo:
- Definição do serviço.
- Plano de assinatura (preços, recorrência, reembolso).
- Cancelamento (regra: antes do próximo ciclo de cobrança).
- Limitação de responsabilidade.
- Foro de eleição.

☐ **Banner LGPD na home** — aceitação de cookies analíticos (Google Analytics, Vercel Analytics).

☐ **Termo de uso de IA** (opcional, mas profissionalismo B2B): declarar que o sistema usa Claude da Anthropic, com salvaguardas sobre dados de clientes.

### 4.2 DPO (Encarregado de Dados)

☐ **Nomear Encarregado (DPO)** — durante fase inicial pode ser a Regina ou o Igor (LGPD não obriga DPO externo).
**Publicar nome e contato no site** (rodapé ou na Política de Privacidade).

### 4.3 Política interna de tratamento

☐ **Política de retenção e eliminação de dados**:
- Cliente que cancela: dados pessoais excluídos 90 dias após cancelamento (exceto NFs, que ficam 5 anos por exigência fiscal).
- Logs de acesso: 6 meses (Lei Marco Civil exige mínimo de 6 meses).
- Anexos (PDFs): excluídos junto com a conta.

☐ **Procedimento de resposta a solicitação do titular** (LGPD art. 18):
- E-mail dedicado: `dpo@cpsystem.com.br`.
- Prazo de resposta: 15 dias úteis.
- Template de resposta pronto.

### 4.4 Termo de tratamento com sub-operadores

☐ **DPA (Data Processing Agreement) assinado** com:
- Vercel (DPA público em vercel.com/legal/dpa).
- Neon (DPA público).
- Anthropic (DPA público em anthropic.com/legal).
- Asaas (DPA assinável no painel).
- Resend (DPA público).

**Como:** ler, baixar, arquivar em `/07-Jurídico` do Drive. Vinculam em "aceito ao usar".

### 4.5 Recomendação de execução

**Solução zero custo:** Termoondo, Privacy Tools, ou modelos prontos da Iugu/Asaas (eles publicam modelos pra clientes).
**Solução premium:** advogado especializado LGPD (R$ 1.500-3.000 setup inicial).

**Recomendação prática:** começar com modelos prontos, evoluir conforme volume de clientes. Antes de passar de 100 clientes, contratar revisão jurídica formal.

---

## 5. FINANCEIRO E BANCÁRIO

☐ **Asaas como conta digital PJ + gateway** (decisão tomada em 10/06/2026).
- Cadastro: 7 dias úteis após CNPJ ativo.
- Habilitar emissão automática de NFS-e (precisa certificado A1 + inscrição municipal).
- Habilitar assinaturas recorrentes (cobrança automática Pix/cartão).
- Configurar webhook → CP System backend.

☐ **Cartão de crédito PJ** — Asaas oferece (cartão Asaas Mastercard PJ, grátis). Alternativas: Cora, Nubank PJ.
**Limite inicial:** R$ 2.000-5.000 (vai escalando com movimento da conta).
**Uso:** cobrir Vercel, Anthropic, Resend, Apollo, ElevenLabs, Google Ads.

☐ **Reserva técnica de 3 meses de custo operacional**
**Estimativa custo fixo mensal pré-SDR (agosto/2026):**
- Vercel: ~R$ 100
- Anthropic API: ~R$ 200-500 (depende de uso)
- Neon: ~R$ 100
- Resend: ~R$ 100
- Asaas: 0 (cobra por transação)
- Apollo: R$ 100
- ElevenLabs: R$ 50
- Google Workspace: R$ 60
- Z-API (quando ligar): R$ 90
- Contador: R$ 99
- Google Ads M1: R$ 300
- **Total: ~R$ 1.300/mês**

**Reserva sugerida:** R$ 4.000 disponíveis em conta. Aporte sócios cobre.

☐ **Política de despesa entre sócios**:
- Despesas abaixo de R$ 500: qualquer um pode autorizar.
- R$ 500 a R$ 2.000: avisar o outro antes (sem precisar aprovação formal).
- Acima de R$ 2.000: decisão conjunta documentada (WhatsApp basta).

☐ **Pasta `02-Fiscal` no Drive** com NFs entrando e saindo, atualizada mensalmente. O contador puxa daí no fechamento.

---

## 6. INTEGRAÇÕES E PROVEDORES

**Já contratados/configurados:**
- ✅ Vercel (hospedagem)
- ✅ Neon (banco PostgreSQL prod)
- ✅ Anthropic (Claude — IA do sistema)

**Pendente de contratar/configurar:**

☐ **Resend** — e-mail transacional. Plano free até 3.000 e-mails/mês. Sobe pro plano pago (~R$ 100/mês) quando passar.

☐ **Asaas** — gateway + NFS-e + conta digital.

☐ **Z-API** — WhatsApp programático. Plano básico R$ 89/mês.
**Por quê:** o Asaas já manda boleto/cobrança por WhatsApp nativo, mas mensagens personalizadas do CP System (cobranças, notificações de prazo, lembretes) precisam de canal próprio com identidade da marca.

☐ **Apollo.io** — prospecção B2B (LinkedIn Sales Navigator alternativa).
Plano básico ~R$ 100/mês.

☐ **ElevenLabs** — vozes IA pra vídeos institucionais e webinars.
Plano básico ~R$ 50/mês.

☐ **Tawk.to** — chatbot do site. Grátis com marca d'água; pago R$ 50/mês remove a marca.

☐ **Google Ads** — orçamento agosto/2026: R$ 300/mês escalando até R$ 2.700 em janeiro/2027.

☐ **Google Workspace** — e-mails corporativos. R$ 60/mês (2 usuários).

---

## 7. CONTRATAÇÃO DO SDR (outubro/novembro 2026)

Só ativar quando o funil atingir 50+ leads acumulados. Itens preparatórios:

☐ **Modelo de contrato PJ** pronto pra assinatura quando o SDR entrar.
Cláusulas mínimas:
- Prestação de serviço autônoma (não vínculo empregatício).
- **Comissão decrescente alinhada à retenção** (modelo aprovado em 10/06/2026):
  - **5% do MRR mensal do cliente nos meses 1 a 6 da assinatura.**
  - **2% do MRR mensal do cliente nos meses 7 a 18, condicionado a o cliente continuar ativo.**
  - **Mês 19 em diante: comissão zera.** Cliente vira receita pura da empresa.
  - SDR perde direito à comissão dos meses subsequentes se o cliente cancelar ou ficar inadimplente por mais de 60 dias.
  - Exemplo prático: cliente Premium R$ 997/mês → SDR recebe ~R$ 50/mês nos primeiros 6 meses (R$ 299 total) + ~R$ 20/mês nos meses 7-18 (R$ 239 total). Comissão acumulada máxima por cliente: ~R$ 538 em 18 meses.
- Pagamento mensal até dia 10 do mês seguinte.
- Sigilo de dados de clientes (cláusula de NDA embutida).
- Propriedade dos leads e CRM permanece da CP System.
- Cláusula de não-concorrência: 12 meses após desligamento, não pode trabalhar em concorrente direto.
- Rescisão imotivada por qualquer parte com aviso de 30 dias.
- **Continuidade da comissão pós-rescisão:** SDR que sair continua recebendo a comissão dos clientes que já fechou, dentro da janela de 18 meses contados a partir da assinatura de cada cliente. Após esse prazo (ou cancelamento do cliente), comissão zera. Sem direito a clientes fechados após sua saída.

☐ **NDA separado** assinado antes do acesso ao CRM (Notion).

☐ **CNPJ MEI ou Simples do SDR** verificado e em dia antes do primeiro pagamento.

☐ **Acessos isolados:**
- Usuário próprio no CP System (modo analista) — não compartilhar Regina/Igor.
- E-mail próprio `sdr@cpsystem.com.br`.
- Acesso ao Notion (CRM) com permissão limitada.
- WhatsApp comercial: linha dedicada (não compartilhar Regina pessoal).

---

## 8. SEGUROS (não urgente — pós-lançamento)

☐ **Responsabilidade civil profissional** — cobre se cliente sofrer dano patrimonial por erro/falha do sistema.
**Custo:** R$ 100-300/mês.
**Recomendação:** contratar quando passar de 30 clientes ativos.

☐ **Cyber Security** — cobre vazamento de dados, ransomware, ações regulatórias LGPD.
**Custo:** R$ 200-500/mês.
**Recomendação:** contratar quando passar de 100 clientes.

---

## CRONOGRAMA DE EXECUÇÃO

### Semana 1 (10/06 a 16/06)

☐ Reunião dos sócios pra fechar:
- Endereço da sede (virtual ou residencial de um).
- Valor do capital social.
- Cláusulas-chave do acordo de sócios (vesting, não-concorrência).
- Pró-labore (sim agora ou só distribuição).

☐ Contratar Contabilizei (R$ 99/mês) e iniciar abertura do CNPJ.

☐ Registrar `cpsystem.com.br` no Registro.br (R$ 40).

### Semana 2 (17/06 a 23/06)

☐ CNPJ ativo (Contabilizei conclui).
☐ Comprar certificado digital A1.
☐ Cadastrar Asaas.
☐ Apontar DNS do `cpsystem.com.br` no Vercel.
☐ Criar Google Workspace e os 7 e-mails corporativos.

### Semana 3 (24/06 a 30/06)

☐ Habilitar emissão de NFS-e no Asaas (depende certificado + inscrição municipal).
☐ Configurar webhook Asaas → CP System.
☐ Iniciar pedido de marca no INPI (classes 9 e 42).
☐ Publicar Política de Privacidade e Termos de Uso atualizados.

### Semana 4 (01/07 a 07/07)

☐ Acordo de sócios finalizado e assinado.
☐ Modelo de contrato PJ do SDR pronto e guardado.
☐ Política de retenção de dados e procedimento DPO documentados.
☐ Pasta Google Drive organizada com estrutura.

### Semanas 5-8 (julho/2026)

☐ Testes end-to-end: NF emitida sozinha após pagamento, e-mail/WhatsApp chegando, cancelamento funcionando.
☐ Reserva técnica R$ 4.000 em conta.
☐ DPA assinados com todos os sub-operadores.

### Agosto/2026 — Lançamento oficial

✅ Tudo acima checado. Sistema vai ao ar.

---

## CUSTO TOTAL PRÉ-LANÇAMENTO ESTIMADO

**Itens únicos (one-shot):**
- Abertura CNPJ via Contabilizei: R$ 99 (incluso no primeiro mês).
- Certificado digital A1: R$ 250.
- INPI 2 classes (pedido): R$ 830.
- Acordo de sócios (modelo + revisão): R$ 500.
- Domínios .com.br + .com: R$ 100.
- **Subtotal único: R$ 1.780**

**Custo mensal a partir de julho/2026 (pré-SDR):**
- Contabilizei: R$ 99
- Google Workspace: R$ 60
- Asaas: 0 (cobra por transação)
- Apollo: R$ 100
- ElevenLabs: R$ 50
- Anthropic + Vercel + Neon + Resend: ~R$ 400-700 (escala com uso)
- Z-API (a partir de M2): R$ 89
- Tawk.to: R$ 50 (opcional)
- Google Ads (a partir de M1): R$ 300 → R$ 2.700 (escala)
- **Subtotal mês 1 lançamento: ~R$ 1.200-1.500**

**Reserva técnica recomendada:** R$ 4.000.

**Total pra estar 100% pronto pra lançar com 3 meses de fôlego: ~R$ 6.000-7.000.**

**Aporte combinado dos sócios definido em v2 (10/06/2026): R$ 6.550** (R$ 3.275 cada — sendo R$ 775 já aportado + R$ 2.500 adicional). Cobre o subtotal único + ~3 meses de operação. Suficiente.

Caso a operação demande mais caixa nos meses 4-6, opções:
1. Aporte complementar dos sócios (proporcional 50/50).
2. Cartão de crédito PJ Asaas com pagamento dentro do mesmo ciclo.
3. **Não recomendado** ampliar gasto em Google Ads sem retorno comprovado — manter R$ 300/mês até validar conversão.

---

## DECISÕES PENDENTES — PRECISAM SER TOMADAS PELOS SÓCIOS

1. ☐ **Endereço da sede** — virtual ou residencial?
2. ☐ **Valor exato do capital social** — R$ 6.500 (recomendação v2, espelhando aporte ajustado de R$ 6.550)?
3. ✅ **Aporte adicional definido em v2:** R$ 2.500 por sócio (total R$ 6.550). Confirmar prazo de transferência pros sócios.
4. ☐ **Vesting reverso no acordo de sócios** — aceitam a regra 4 anos com cliff de 1?
5. ☐ **Pró-labore desde já** — sim (mínimo R$ 1.412 cada) ou só distribuição quando entrar receita?
6. ☐ **Quem fica como DPO** — Regina ou Igor?
7. ☐ **Endereço fiscal** — qual município (escolher por alíquota de ISS pode economizar).
8. ☐ **Alinhamento Regina + Igor sobre meta de R$ 1M MRR** — confirmar fev/2029 como objetivo final, com checkpoints dez/2026 (R$ 50k) e dez/2027 (R$ 300k)? OU abrir discussão sobre captação anjo?

---

## RECOMENDAÇÕES FINAIS

**Prioridade absoluta esta semana:**
1. Sentar com o Igor 2 horas e decidir os 7 itens da seção anterior.
2. Contratar Contabilizei e abrir CNPJ. Sem CNPJ ativo, nada do resto se move.
3. Registrar marca CP System no INPI no mesmo dia (12-18 meses pra ficar pronta — começar cedo).

**O erro mais caro que pode cometer:**
- Lançar sem acordo de sócios assinado. Briga societária no futuro destrói a empresa em 6 meses.
- Lançar sem Política de Privacidade. ANPD aplica multa de até 2% do faturamento.

**O que NÃO se preocupar agora:**
- Seguros (cyber, RC profissional) — só quando passar de 30-100 clientes.
- Trademark internacional — só faz sentido quando faturar fora do Brasil.
- Marca registrada em mais classes além de 9 e 42 — escala depois.
- Investidor anjo / VC — bootstrap até pelo menos R$ 50k MRR antes de pensar nisso.

**Próximo passo prático que dá pra fazer hoje:**
- Abrir conta Contabilizei (sai com CNPJ + inscrição municipal + contador junto): https://www.contabilizei.com.br/abertura-de-empresa/
- Em paralelo, ir no Registro.br e registrar `cpsystem.com.br` (R$ 40, 5 minutos).

---

*Documento vivo — atualizar à medida que itens forem concluídos.*
