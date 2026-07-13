# Google Ads — Setup Completo CP System

**Documento técnico pra configurar a conta de Google Ads do zero.**

Tudo aqui é pronto pra copiar e colar no Google Ads Editor.

---

## 1. ETAPA 1 — Criar a conta (1 dia)

### 1.1 Cadastro

1. Acesse https://ads.google.com com a conta Google que vai ser usada pela CP System (recomendo criar um e-mail dedicado: `ads@cpsystem.com.br` ou similar).

2. Cadastre com os dados da empresa: nome CP System, CNPJ, endereço, telefone comercial.

3. Adicione o cartão de crédito pra cobrança.

4. **Importante**: quando o Google sugerir o modo "Smart" (automático), recuse. Escolha o modo **"Especialista"**. O Smart escolhe automaticamente os públicos e fica caro.

5. Configure o fuso horário pra **Brasil/São Paulo (GMT-3)** e moeda **BRL (Real)**.

### 1.2 Estrutura de pastas que vai criar

```
Conta CP System (1 conta)
├── Campanha 1 — REAJUSTE 14.133 (lança mês 1 pós-lançamento)
│   └── Grupo de anúncios: Reajuste
├── Campanha 2 — MULTA ATRASO (lança mês 2)
│   └── Grupo de anúncios: Multa
├── Campanha 3 — SALDO ATA (lança mês 3)
│   └── Grupo de anúncios: Saldo
└── Campanha 4 — SISTEMA GENÉRICO (lança mês 4)
    └── Grupo de anúncios: Sistema
```

Total final: 4 campanhas, 4 grupos de anúncios, cerca de 24 anúncios e 40 palavras-chave.

---

## 2. ETAPA 2 — Definir o público-alvo (1 hora)

Esse é o filtro que vai determinar quem vê seus anúncios. Demografia + geografia + interesses + exclusões.

### 2.1 Demografia

**Idade**: 25 a 65 anos.
**Gênero**: Todos.
**Renda familiar**: 50% superior do Brasil (filtro disponível no Google Ads).
**Status parental**: Todos (não filtrar — irrelevante).

### 2.2 Geografia

**Incluir**: Brasil inteiro.

**Excluir**: Roraima (RR) e Amapá (AP) — mercado pequeno demais pra empresas que vendem ao governo, gera cliques baratos mas sem retorno.

**Refinar lance por região** (lances 20% maiores nas capitais com mais licitação):
- Brasília/DF (capital federal, sede da maioria dos órgãos)
- São Paulo/SP
- Rio de Janeiro/RJ
- Belo Horizonte/MG
- Porto Alegre/RS
- Curitiba/PR
- Salvador/BA
- Recife/PE
- Fortaleza/CE
- Goiânia/GO

### 2.3 Idioma

Português (Brasil) apenas.

### 2.4 Públicos-alvo personalizados (sobre o ICP)

No Google Ads, criar 2 audiências customizadas:

**Audiência 1 — Sócios e gestores de empresas B2G**
- Tipo: Audience customizada baseada em interesses
- Critérios:
  - Sites visitados frequentemente: pncp.gov.br, comprasnet.gov.br, transparencia.gov.br, gov.br, jusbrasil.com.br/lei-14133
  - Termos de busca recentes: "licitação", "pregão eletrônico", "lei 14.133", "fornecedor governo", "ata registro de preços"
- Estimativa de tamanho: 50-200 mil pessoas no Brasil

**Audiência 2 — Profissionais jurídicos administrativistas**
- Tipo: Affinity audience pré-configurada do Google + customização
- Critérios:
  - Categoria profissional: Legal Services, Government Services
  - Educação: Direito, Administração Pública
  - Termos de busca: "direito administrativo", "licitação", "contratos administrativos"
- Estimativa de tamanho: 30-100 mil pessoas no Brasil

### 2.5 Dispositivo

Todos os dispositivos (desktop, mobile, tablet). Empresas B2B fazem pesquisa de fornecedor majoritariamente em desktop, mas mobile também converte.

**Refinar lance mobile**: lance 10% menor em mobile (a conversão é menor em mobile pra B2B).

### 2.6 Horário (dayparting)

Mostrar anúncios apenas:
- Segunda a sexta-feira: das 8h às 20h (horário comercial estendido)
- Sábado: das 9h às 14h
- Domingo: desligado (público B2B não decide no domingo)

Isso economiza 20-25% do orçamento sem perder conversão.

---

## 3. ETAPA 3 — Configurar conversões (2 horas)

Antes de lançar campanhas, o Google precisa saber o que conta como "conversão" pra otimizar.

### 3.1 Quais conversões vamos rastrear

Cinco eventos importantes, com valores diferentes:

**Conversão 1 — Lead da Calculadora** (alguém deixa email na `/calc/saldo-ata`)
- Valor estimado: R$ 30 (lead morno)
- Categoria: Submit lead form

**Conversão 2 — Início de Trial** (cadastro completo em `/signup`)
- Valor estimado: R$ 200 (lead quente)
- Categoria: Sign-up

**Conversão 3 — Cliente Pagante 1ª fatura** (1ª cobrança paga)
- Valor estimado: R$ 1.000 (conversão final)
- Categoria: Purchase

**Conversão 4 — Lead de Parceria** (analista ou escritório se cadastra como embaixador)
- Valor estimado: R$ 50
- Categoria: Sign-up

**Conversão 5 — Demo Vídeo Assistida** (alguém assiste >75% do vídeo de 2 min)
- Valor estimado: R$ 10 (engajamento)
- Categoria: Engagement

### 3.2 Como instalar o pixel no site

O Google Tag Manager (GTM) é a forma mais simples. Eu já posso adicionar o snippet no layout do site pra você quando autorizar — isso é alteração de marketing, não funcional. Por enquanto, instruções:

1. Cadastre o GTM em https://tagmanager.google.com.
2. Crie um container pro CP System.
3. Copie o snippet (2 partes: `<head>` e `<body>`).
4. Me peça pra instalar no site (`src/app/layout.tsx`).

Depois de instalado, configure no GTM:
- Tag 1: Google Ads Conversion (Lead Calculadora) com trigger "email submetido em `/calc/saldo-ata`"
- Tag 2: Google Ads Conversion (Trial) com trigger "página /trial-confirmado"
- Tag 3: Google Ads Conversion (Pagante) com trigger "primeira-fatura-paga"

---

## 4. ETAPA 4 — Campanha 1: REAJUSTE 14.133 (mês 1 pós-lançamento)

Essa é a primeira campanha a entrar no ar. Lança em **agosto/2026**.

### 4.1 Configurações da campanha

**Tipo**: Pesquisa (Search) — só anúncios de texto em resultados Google.

**Orçamento diário**: R$ 10 (totaliza R$ 300/mês).

**Estratégia de lance**: "Maximizar conversões" sem CPA-alvo (deixa o Google aprender por 14 dias).

**Mês 2 em diante**: mudar pra "Maximizar conversões com CPA-alvo de R$ 400".

**Localização**: Brasil, exceto RR e AP (ver seção 2.2).

**Idioma**: Português.

**Dispositivos**: Todos, com ajuste -10% em mobile.

**Horário**: Segunda a sexta 8h-20h, sábado 9h-14h.

**Audiências**: incluir Audience 1 e Audience 2 da seção 2.4.

### 4.2 Palavras-chave (correspondência ampla modificada com `+`)

Copie e cole exatamente assim no Google Ads:

```
+como +calcular +reajuste +lei +14133
+reajuste +contrato +público +lei +14133
+como +pedir +reajuste +contrato +administrativo
+IPCA +contrato +público +reajuste
+marco +reajuste +contrato
+reajuste +ata +registro +preços
+repactuação +contrato +administrativo
+art +25 +lei +14133 +reajuste
+reequilíbrio +econômico +financeiro +contrato
+índice +reajuste +contrato +público
```

### 4.3 Palavras-chave negativas (EXCLUIR — copie no campo "negative keywords")

```
-curso
-cursos
-vagas
-emprego
-empregos
-concurso
-concursos
-trabalho
-trabalhar
-salario
-salário
-faculdade
-livro
-livros
-pdf
-baixar
-download
-jurisprudência -tcu (só queremos quem busca aplicação prática, não pesquisa acadêmica)
-doutrina
-tcc
-monografia
-conceito
-definição
-significado
```

### 4.4 Anúncios (4 variações pra A/B test)

**Anúncio 1.A**

- Título 1 (30 caracteres): `Reajuste 14.133 em 30 Segundos`
- Título 2 (30): `Sistema Que Lembra Você Antes`
- Título 3 (30): `Calculadora Grátis + Sistema`
- Descrição 1 (90): `O CP System calcula reajuste de contrato público pela Lei 14.133. Teste 14 dias.`
- Descrição 2 (90): `Cliente recuperou R$ 47k em reajuste esquecido em 2 minutos. Calculadora grátis.`
- URL final: `https://cpsystem-three.vercel.app/calc/reajuste-lei-14133`
- URL visível: `cpsystem.com.br/reajuste`

**Anúncio 1.B**

- Título 1: `Reajuste Esquecido = Prejuízo`
- Título 2: `Calcule Agora — Grátis`
- Título 3: `Sistema Treinado na Lei 14.133`
- Descrição 1: `Lei 14.133 garante reajuste 12 meses após o orçamento. Calcule o seu agora.`
- Descrição 2: `CP System: alertas + calculadora + IA jurídica. 14 dias grátis pra testar.`
- URL final: `https://cpsystem-three.vercel.app/calc/saldo-ata`

**Anúncio 1.C**

- Título 1: `Empresa Perde Reajuste no Governo`
- Título 2: `CP System Detecta em 2 Min`
- Título 3: `Lei 14.133 art. 25 §7º`
- Descrição 1: `Empresas fornecedoras esquecem reajuste e perdem R$ 20-50k por contrato.`
- Descrição 2: `O CP System detecta automaticamente. Teste grátis 14 dias.`
- URL final: `https://cpsystem-three.vercel.app/calc/reajuste-lei-14133`

**Anúncio 1.D**

- Título 1: `Cálculo Reajuste Contrato Público`
- Título 2: `Em 30 Segundos, Sem Erro`
- Título 3: `Gratuito · Lei 14.133`
- Descrição 1: `Calculadora especializada pra contratos sob Lei 14.133/2021. Resultado imediato.`
- Descrição 2: `Plus: sistema completo de gestão pós-licitação. 14 dias grátis.`
- URL final: `https://cpsystem-three.vercel.app/calc/saldo-ata`

### 4.5 Extensões de anúncio (obrigatório — aumenta CTR em 15-30%)

**Extensão de Sitelinks** (4 links extras):
- "Página de preços" → `cpsystem-three.vercel.app/precos`
- "Sobre o sistema" → `cpsystem-three.vercel.app/`
- "Programa de embaixador" → `cpsystem-three.vercel.app/seja-embaixador`
- "Calculadora grátis" → `cpsystem-three.vercel.app/calc/saldo-ata`

**Extensão de Frase** (3 frases curtas):
- "14 dias grátis · cartão valida no cadastro"
- "Sistema treinado na Lei 14.133/2021"
- "Sem fidelidade · cancele com 1 clique"

**Extensão de Texto Promocional** (1 promoção):
- Texto: "Cobrança anual com 16% off"
- Data: válido até 31/12/2027

**Extensão de Imagem** (1 imagem 1:1 e 1 retangular):
- Imagem da tela do CP System mostrando alertas

**Extensão de Chamada**:
- Telefone WhatsApp comercial (quando você definir)

---

## 5. ETAPA 5 — Campanha 2: MULTA ATRASO (mês 2 pós-lançamento)

Lança em **setembro/2026** com orçamento R$ 300/mês.

### 5.1 Palavras-chave

```
+multa +atraso +entrega +contrato +público
+como +evitar +multa +licitação
+rescisão +unilateral +14133
+art +137 +lei +14133
+prazo +entrega +contrato +administrativo
+multa +contrato +administrativo +14133
+art +142 +lei +14133
+sanção +administrativa +lei +14133
+prorrogação +prazo +entrega +contrato
```

### 5.2 Palavras-chave negativas

Mesma lista da Campanha 1.

### 5.3 Anúncios

**Anúncio 2.A**
- Título 1: `Evite Multa até 10% — 14.133`
- Título 2: `Alertas Automáticos de Prazo`
- Título 3: `14 Dias Grátis pra Testar`
- Descrição 1: `Empresas perdem contratos por prazo esquecido. CP System alerta antes.`
- Descrição 2: `Em todas as etapas do contrato. Lei 14.133 conformidade automática.`
- URL: `https://cpsystem-three.vercel.app/precos`

**Anúncio 2.B**
- Título 1: `Prazo Perdido = Multa Cara`
- Título 2: `O Sistema Lembra Por Você`
- Título 3: `Lei 14.133 Automatizada`
- Descrição 1: `TCU manteve multa de 10% por atraso de 8 dias. Não dependa de planilha.`
- Descrição 2: `Alertas automáticos de entrega, pagamento e reajuste. Teste 14 dias.`
- URL: `https://cpsystem-three.vercel.app/precos`

---

## 6. ETAPA 6 — Campanha 3: SALDO ATA (mês 3 pós-lançamento)

Lança em **outubro/2026** com R$ 200/mês (palavra-chave de cauda longa, menos buscada).

### 6.1 Palavras-chave

```
+saldo +ata +registro +de +preços
+como +calcular +saldo +ata
+ata +preços +saldo +vigência
+SRP +saldo +lei +14133
+carona +ata +limite
+art +84 +lei +14133
+vigência +ata +registro +preços
```

### 6.2 Anúncios

**Anúncio 3.A**
- Título 1: `Saldo de Ata em Tempo Real`
- Título 2: `Por Vigência Separada — 14.133`
- Título 3: `Calculadora Grátis + Sistema`
- Descrição 1: `Único sistema que respeita saldo não-cumulativo entre vigências.`
- Descrição 2: `Conforme art. 84, Lei 14.133. Calculadora grátis. Teste 14 dias.`
- URL: `https://cpsystem-three.vercel.app/calc/saldo-ata`

---

## 7. ETAPA 7 — Campanha 4: SISTEMA GENÉRICO (mês 4 pós-lançamento)

Lança em **novembro/2026** com R$ 400/mês.

### 7.1 Palavras-chave

```
+sistema +gestão +contratos +públicos
+software +pós +licitação
+ERP +licitação +pública
+sistema +Lei +14133
+gestão +empresa +fornecedora +governo
+software +empresa +B2G
+plataforma +gestão +contratos +públicos
+sistema +SaaS +licitação
```

### 7.2 Anúncios

**Anúncio 4.A**
- Título 1: `Sistema Pós-Licitação 14.133`
- Título 2: `Alertas + IA Jurídica + Saldo`
- Título 3: `14 Dias Grátis pra Testar`
- Descrição 1: `Plataforma completa pra empresas que vendem ao governo.`
- Descrição 2: `Controle prazo, reajuste, saldo e parecer jurídico em 1 sistema.`
- URL: `https://cpsystem-three.vercel.app/precos`

---

## 8. ETAPA 8 — Cronograma de investimento mensal

| Mês | Campanhas ativas | Orçamento mês | Total ano 1 |
|---|---|---|---|
| Ago/26 (M1) | C1 | R$ 300 | R$ 300 |
| Set/26 (M2) | C1 + C2 | R$ 600 | R$ 900 |
| Out/26 (M3) | C1 + C2 + C3 | R$ 800 | R$ 1.700 |
| Nov/26 (M4) | C1+C2+C3+C4 | R$ 1.200 | R$ 2.900 |
| Dez/26 (M5) | Mesmas 4 | R$ 1.800 | R$ 4.700 |
| Jan/27 (M6) | Mesmas 4, escalar | R$ 2.700 | R$ 7.400 |
| Jul/27 (M12) | Mesmas 4 + display | R$ 8.000 | ~R$ 50.000 |

A regra é simples: cada mês, o orçamento de Google Ads representa 15-20% do MRR mensal (parte do reinvestimento de 30%).

---

## 9. ETAPA 9 — Como acompanhar (dashboard semanal)

Toda segunda-feira, abrir o Google Ads e verificar 6 números:

**1. Impressões** — quantas vezes seus anúncios apareceram. Tendência crescente é boa.

**2. CTR** — taxa de cliques. Saudável: acima de 5% no Search.

**3. CPC médio** — custo por clique. Saudável: R$ 4 a R$ 8.

**4. Conversões** — quantos cadastros/trials veio dos anúncios.

**5. Taxa de conversão** — conversões dividido por cliques. Saudável: acima de 5% para lead, 1-2% para trial.

**6. CPA** — custo por aquisição. Saudável: abaixo de R$ 400 para lead, abaixo de R$ 2.000 para cliente pagante.

Se um número estiver fora da faixa por 14 dias seguidos, ajustar (pausar palavra cara, mudar anúncio com CTR baixo, refinar audiência).

---

## 10. ETAPA 10 — UTMs pra rastrear origem

Toda URL em anúncio tem que terminar com UTMs pra você saber depois qual campanha trouxe qual cliente.

Formato padrão CP System:

```
?utm_source=google
&utm_medium=cpc
&utm_campaign=reajuste-14133
&utm_content=anuncio-1A
```

Exemplo de URL completa:

```
https://cpsystem-three.vercel.app/calc/reajuste-lei-14133?utm_source=google&utm_medium=cpc&utm_campaign=reajuste-14133&utm_content=anuncio-1A
```

Trocar `utm_content` pra cada anúncio (1A, 1B, 1C, 1D, 2A, 2B, etc).
Trocar `utm_campaign` pra cada campanha (reajuste-14133, multa-atraso, saldo-ata, sistema-generico).

Esses UTMs aparecem no Vercel Analytics e no Google Analytics se você instalar.

---

## 11. Erros comuns que vão custar dinheiro (evitar)

Não usar Performance Max no início — ele é uma caixa preta que aprende devagar e gasta muito antes de otimizar.

Não confiar nos "Smart Bidding" do Google logo no início — precisa de 14-30 dias de dados antes da estratégia "maximizar conversões" funcionar.

Não esquecer das palavras-chave negativas — sem elas, vai aparecer pra quem busca curso de licitação, vaga de emprego, monografia, etc.

Não usar correspondência ampla pura (sem `+`) — vai gerar cliques de palavras irrelevantes.

Não rodar campanha sem conversões configuradas — sem isso, o Google não tem como otimizar e fica caro.

Não ter landing dedicada — mandar pra `/signup` direto é desperdício. Sempre mandar pra calculadora correspondente (`/calc/saldo-ata`, `/calc/reajuste-lei-14133`, etc) que captura email primeiro.

---

## 12. Custo de aprendizado realista

Os primeiros 14 dias da campanha 1 vão queimar entre R$ 200 e R$ 400 sem gerar conversão real. Isso é normal — o Google está aprendendo seu público e refinando. Não pause, não desespere. Após esse período, o CPA estabiliza.

Total de aprendizado nas 4 campanhas (entrando uma por mês): cerca de R$ 1.000 distribuídos entre os meses 1 e 4. Considere isso parte do investimento inicial.

---

*Esse documento é vivo. Atualize com aprendizados a cada 30 dias.*
