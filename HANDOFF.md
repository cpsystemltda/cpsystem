# CP System — Handoff de Sessão

**Última atualização:** 2026-05-07
**HEAD atual:** `c970edb preview(hero-b): quebra forçada antes de 'do empenho' — 2 linhas por público`
**Branch principal:** `main`
**Status:** Em desenvolvimento ativo. MVP em produção, vários módulos funcionais, ajustes finais de signup/landing em curso.

---

## 1. Visão Executiva

**Produto:** CP System — SaaS LegalTech B2G (business-to-government) para gestão pós-licitação de empresas privadas que vendem para o governo brasileiro, sob a Lei 14.133/2021.

**Dono / PO:** Igor Fernandes — Grupo Contratos Públicos / Contratos Públicos Consultoria (filial Contratos Públicos System).

**Equipe Marketing/Operações:** Regina Luiza Fernandes (Grupo Reis).

**Stack escolhido (decisão 2026-05-03):** Next.js 15+ full-code (rejeitada a sugestão No-Code do plano de negócios original).

**Concorrentes diretos:**
- Controle de Empenhos (descontinuado)
- Proposta.com.br (UX ruim)
- IBIZ (R$ 17.340/mês — só grandes empresas)
- **Vácuo de mercado para MPEs com inteligência jurídica nativa.**

**Modos de acesso:**
- **EMPRESA** — multi-CNPJ até 4 (5º+ cobrança adicional)
- **ANALISTA de licitações** — vê telas de todos os clientes; ganha módulo gratuito; recebe comissão recorrente sobre empresas indicadas

**Planos comerciais:**
- **Básico** R$ 397/mês — só software
- **Premium** R$ 997/mês — software + 12 consultas jurídicas/ano + 2 peças jurídicas/ano

**Programa de embaixadores (analistas independentes):**
Bronze 3% / Prata 4% / Ouro 5% / Diamond 6% — comissão recorrente sobre clientes ativos indicados.

---

## 2. Stack Técnica

### Frontend
- **Next.js 16.2.4** (App Router, Turbopack em dev)
- **React 19.2.4** (Server Components + Server Actions)
- **TypeScript** (strict)
- **Tailwind CSS v4** (com tokens custom para identidade dourada)
- **shadcn/ui** (componentes base — baixa dependência)
- **lucide-react** (ícones)
- **Fontes:** Geist Sans/Mono (UI) + Cinzel (identidade da marca, mesma família visual da logo)

### Backend
- **Next.js Server Actions** (`src/app/actions/`)
- **NextAuth v5 beta** (auth com Prisma adapter)
- **Prisma 7.8** com adapters: `@prisma/adapter-pg` (dev) e `@prisma/adapter-neon` (prod via WebSocket)
- **bcryptjs** (hash de senhas)
- **Anthropic SDK** (`@anthropic-ai/sdk`) — extração IA de PDFs (Atas, Contratos)

### Banco
- **Postgres** via **Neon** (`sa-east-1` / `ep-bold-glade-acztxq6x`)
- Pooler: `bold-glade-acztxq6x-pooler.sa-east-1.aws.neon.tech` (DATABASE_URL)
- Direct: `bold-glade-acztxq6x.sa-east-1.aws.neon.tech` (DATABASE_URL_UNPOOLED — usado em migrations)

### Hospedagem
- **Vercel** (region `gru1` — São Paulo) — frontend + serverless functions
- Auto-deploy GitHub → Vercel **NÃO ESTÁ FUNCIONANDO** (ver gotcha em §10).

---

## 3. Estrutura do Código

```
~/Desktop/cp-system/
├── prisma/
│   └── schema.prisma           # 30+ models — Conta, Usuario, Empresa, Ata, Contrato, etc.
├── public/
│   ├── cp-monograma.png        # logo principal (CP dourado)
│   └── ...
├── scripts/                    # tsx — utilitários de banco
│   ├── reset-dados.ts          # apaga TUDO exceto super admins
│   ├── ensure-igor-super-admin.ts   # idempotente — cria/atualiza Igor
│   ├── listar-super-admins.ts  # read-only diagnostic
│   ├── create-super-admin.ts   # cria novo super admin
│   ├── seed-test-data.ts
│   ├── seed-timeline-test.ts
│   ├── simular-contrato.ts
│   ├── upload-contratos-reais.ts
│   ├── count-rows.ts
│   ├── release-lock.ts
│   ├── mark-migration-applied.ts
│   └── process-logo.mjs
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx          # login premium com 2 botões empresa/analista
│   │   │   └── signup/page.tsx         # signup multi-step (EMPRESA | ANALISTA)
│   │   ├── (app)/                      # área autenticada
│   │   │   ├── layout.tsx              # sidebar + bandeira de empresa em foco
│   │   │   ├── dashboard/              # KPIs, mapa de operações
│   │   │   ├── atas/                   # Atas de Registro de Preços
│   │   │   ├── contratos/              # Contratos administrativos
│   │   │   ├── contratacoes/nova/      # Wizard: ata | contrato | empenho
│   │   │   ├── execucao/               # Timeline logística (empenhado→entregue→pago)
│   │   │   ├── conta/                  # Cobrança, checkout, assinatura
│   │   │   ├── juridico/               # IA jurídica + consultas (Premium)
│   │   │   ├── relatorios/
│   │   │   ├── auditoria/
│   │   │   ├── empresas/               # multi-CNPJ
│   │   │   ├── equipe/                 # convites, papéis
│   │   │   ├── embaixadores/           # programa de afiliados
│   │   │   ├── admin/gateway/          # admin: configuração ASAAS
│   │   │   └── admin-plataforma/       # painel super admin (Igor)
│   │   │       ├── atividade/
│   │   │       ├── clientes/
│   │   │       ├── financeiro/
│   │   │       └── reset-cadastros/    # botão pra apagar testes
│   │   ├── actions/                    # Server Actions (auth, contratos, etc.)
│   │   ├── api/
│   │   │   ├── anexos/[filename]/      # download seguro de uploads
│   │   │   ├── cron/regua-cobranca/    # Vercel Cron — cobrança recorrente
│   │   │   ├── export/[tipo]/          # exportações CSV/Excel
│   │   │   ├── extrair-empresa/        # IA extrai dados de PDF
│   │   │   └── webhooks/[provider]/    # webhooks do gateway (ASAAS)
│   │   ├── preview-hero/               # ⚠️  TEMPORÁRIO — apagar quando aprovar landing nova
│   │   │   ├── a/page.tsx              # preview "Editorial de luxo" (creme + Cinzel)
│   │   │   └── b/page.tsx              # preview "Fintech premium dark" (escolha da Regina)
│   │   ├── page.tsx                    # landing pública (vai ser substituída pela versão B aprovada)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── Logo.tsx                    # 3 modes: mark | full | brand
│   │   ├── Sidebar.tsx                 # navegação por role
│   │   ├── Field.tsx                   # input genérico
│   │   ├── SubmitButton.tsx            # botão com pending state
│   │   ├── CampoCnpj.tsx               # máscara + autocomplete via BrasilAPI
│   │   ├── CampoCpf.tsx                # máscara 000.000.000-00 + limite 11 dígitos
│   │   ├── CampoCep.tsx                # ViaCEP autocomplete
│   │   ├── CampoCartao.tsx             # 4 campos cartão + Luhn
│   │   ├── CampoBanco.tsx              # dropdown bancos brasileiros
│   │   ├── CampoMultiplo.tsx           # múltiplos e-mails/telefones (botão +)
│   │   ├── CampoTelefone.tsx           # máscara (00) 00000-0000 + ícone
│   │   ├── DashboardCharts.tsx
│   │   ├── MapaBrasil.tsx              # d3-geo
│   │   ├── TimelineExecucao.tsx
│   │   ├── AnaliseJuridicaIA.tsx
│   │   ├── UploadPdfPanel.tsx          # extração de PDF via IA
│   │   ├── NavigationProgress.tsx      # barra de progresso de rota
│   │   └── ...
│   ├── lib/
│   │   ├── auth.ts                     # NextAuth config + helpers (getUsuarioAtual)
│   │   ├── validators.ts               # Zod schemas + OPCOES_NATUREZA_JURIDICA
│   │   ├── bancos.ts                   # lista bancos brasileiros
│   │   ├── cartao.ts                   # validação Luhn
│   │   ├── cnaes.ts                    # base CNAE
│   │   └── ...
│   └── generated/
│       └── prisma/                     # Prisma Client gerado (não comitar manualmente)
├── uploads/                            # anexos locais (dev — em prod fica em S3 ou similar)
├── AGENTS.md                           # contexto pra agents AI
├── CLAUDE.md                           # contexto pra Claude Code
├── README.md
├── HANDOFF.md                          # este arquivo
├── package.json
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── prisma.config.ts
├── vercel.json
└── .env.example / .env.production.example
```

### Convenções
- **kebab-case na raiz** (`cp-system`) — restrição npm.
- **Server Actions** em `src/app/actions/` (auth, contratacoes, etc.).
- **Páginas autenticadas** dentro de `(app)` — middleware redireciona pra `/login` se não logado.
- **Logo** sempre via `<Logo variant="md" mode="brand" />` — não importar o PNG direto.
- **Campos de formulário** sempre via componentes `Campo*` (têm máscara, validação, autocomplete).

---

## 4. Banco — Modelos Prisma chave

**Hierarquia:**
```
Conta (1) ──> (n) Usuario        # 1 conta = 1 empresa cadastrada (multi-CNPJ até 4)
        ──> (n) Empresa          # CNPJs vinculados a essa conta
        ──> (1) MetodoPagamento
        ──> (n) Cobranca
Empresa (1) ──> (n) Ata
            ──> (n) Contrato     # contratos NÃO-SRP
            ──> (n) Empenho      # ARP/SRP cascateado da Ata
            ──> (n) Garantia
Ata (1) ──> (n) AtaItem          # itens cadastrados (com saldo)
       ──> (n) OrgaoNaAta        # órgão+município que aderiu
       ──> (n) Empenho           # empenhos derivados — abate saldo
Contrato (1) ──> (n) Empenho
              ──> (n) ParcelaContrato
              ──> (n) TermoAditivo
              ──> (n) Apostilamento
              ──> (n) Reajuste
Analista (1) ──> (n) VinculoAnalista ──> Empresa
              ──> (n) Comissao
```

**Status keys importantes:**
- `Conta.statusAssinatura`: `TRIAL | ATIVA | INADIMPLENTE | CANCELADA`
- `Conta.plano`: `BASICO | PREMIUM`
- `Empenho.statusLogistica`: `EMPENHADO | ASSINADO | EM_ESTOQUE | ENTREGUE | NF_EMITIDA | NF_ENTREGUE | PAGO`
- `Usuario.perfil`: `ADMIN | OPERADOR | LEITURA`
- `Usuario.superAdmin`: boolean — protege do reset

**Auditoria:** `LogAuditoria` registra ações sensíveis (criação/edição de Atas, Contratos, mudanças financeiras).

---

## 5. Autenticação

**Stack:** NextAuth v5 beta + Prisma adapter + Credentials provider (email/senha com bcrypt).

**Super admins atuais (produção):**
- `regina@cpsystem.com.br` — Regina Luiza
- `igor@contratospublicos.com.br` — Igor Fernandes (senha atual: `senha-forte-12345`)

**Fluxo de signup:**
1. `/signup?tipo=EMPRESA` ou `?tipo=ANALISTA` — abre o card correspondente
2. **EMPRESA** preenche: Nome completo, CNPJ (autopreenche via BrasilAPI), endereço, e-mail, telefone, senha, opcional analista vinculado, plano, cartão
3. **ANALISTA** preenche: nome, CPF, e-mail, telefone, endereço, dados PJ (opcional), dados bancários, PIX
4. Server Action `signupAction` / `signupAnalistaAction` cria `Conta + Usuario`, hash bcrypt, sessão.

**Fluxo de login:**
- `/login` — 2 cards (empresa | analista) decidem o destino pós-login
- Empresa → `/dashboard`
- Analista → `/painel-analista`
- Super admin (Igor/Regina) → vê todos os módulos

---

## 6. Componentes de UI Custom (importantes)

| Componente | Função | Onde usado |
|---|---|---|
| `CampoCnpj` | Máscara + autocomplete BrasilAPI (preenche razão social, porte, endereço) | signup empresa, signup analista (PJ), empresas/nova |
| `CampoCpf` | Máscara `000.000.000-00`, limite 11 dígitos | signup analista |
| `CampoCep` | Máscara + autocomplete ViaCEP (preenche endereço) | signups, empresas/nova |
| `CampoCartao` | 4 inputs (número, nome, validade, CVV) + Luhn | signup empresa (após escolher plano) |
| `CampoBanco` | Dropdown bancos brasileiros | signup analista |
| `CampoMultiplo` | Múltiplos valores (e-mails, telefones) com botão "+ Adicionar mais" | signup empresa |
| `CampoTelefone` | Máscara `(00) 00000-0000`, limite 11 dígitos | signup analista |
| `Logo` | 3 modos (mark/full/brand) — usar sempre via componente | header, login, signup, sidebar |
| `Sidebar` | Navegação por role; rotula "Dashboard" pra não confundir analista | layout (app) |
| `NavigationProgress` | Barra de progresso de navegação | layout root |
| `MapaBrasil` | Mapa interativo d3-geo de operações | dashboard |
| `UploadPdfPanel` | Extração IA de PDF (Ata, Contrato, Empenho) via Anthropic | atas/[id], contratos/[id], wizard |

---

## 7. Infraestrutura

### Vercel
- **Projeto:** `cp-system/cpsystem`
- **URL produção:** `https://cpsystem-three.vercel.app`
- **Domínio futuro:** `cpsystem.tec.br` (Igor ainda NÃO COMPROU em Registro.br)
- **Region:** `gru1` (São Paulo) — configurada em `vercel.json`
- **Vercel Cron:** `/api/cron/regua-cobranca` (cobra inadimplentes diariamente)

### Neon Postgres
- **Project:** Neon `bold-glade-acztxq6x` (sa-east-1)
- **Driver:** Em prod usa `@prisma/adapter-neon` com WebSocket (sem cold start de connection pool)
- **Migrations:** sempre via `DATABASE_URL_UNPOOLED` (ver `package.json` scripts.build)

---

## 8. Variáveis de Ambiente

Arquivos:
- `.env` — dev local (gitignored)
- `.env.development` — dev (commitado, sem secrets)
- `.env.production` — prod (gitignored, segredos reais)
- `.env.example` / `.env.production.example` — templates

**Vars críticas:**

| Var | Onde configurar | Pra quê |
|---|---|---|
| `DATABASE_URL` | Vercel + .env | Pooled connection (runtime) |
| `DATABASE_URL_UNPOOLED` | Vercel + .env | Direct connection (migrations) |
| `AUTH_SECRET` | Vercel + .env | NextAuth — gerar com `openssl rand -base64 32` |
| `AUTH_URL` | Vercel | URL pública (mudar quando configurar `cpsystem.tec.br`) |
| `ANTHROPIC_API_KEY` | Vercel + .env | Extração IA de PDF (modelo `claude-haiku-4-5`) |
| `GATEWAY_PROVIDER` | Vercel | `DEMO` (atual) → `ASAAS` (quando Igor abrir conta) |
| `ASAAS_API_KEY` | Vercel | **PENDENTE** — Igor precisa fornecer |
| `ASAAS_WEBHOOK_SECRET` | Vercel | **PENDENTE** |
| `BLOB_READ_WRITE_TOKEN` | Vercel | Storage de uploads (se usar Vercel Blob) |

---

## 9. Como Rodar Localmente

```bash
cd ~/Desktop/cp-system

# 1. Instalar deps (gera Prisma Client via postinstall)
npm install

# 2. Aplicar migrations no Postgres local (ou Neon dev)
DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma migrate deploy

# 3. Subir dev server (Turbopack — recompila ~10x mais rápido)
npm run dev
# → http://localhost:3000  (ou 3001 se 3000 ocupado)

# 4. (opcional) seed dados de teste
npx tsx scripts/seed-test-data.ts
```

**Atalhos úteis:**

| Comando | O que faz |
|---|---|
| `npx tsx scripts/listar-super-admins.ts` | Lista super admins (read-only) |
| `npx tsx scripts/reset-dados.ts` | Apaga tudo exceto super admins |
| `npx tsx scripts/ensure-igor-super-admin.ts` | Cria/atualiza Igor com senha `senha-forte-12345` |
| `npx tsx scripts/create-super-admin.ts <email> <senha>` | Cria novo super admin |
| `npx tsx scripts/seed-test-data.ts` | Popula banco com 3 empresas, contratos, empenhos |
| `npx tsx scripts/simular-contrato.ts` | Simula timeline completa de execução |

**Dica pra rodar script contra produção:**
```bash
cd ~/Desktop/cp-system
set -a && . ./.env.production && set +a
npx tsx scripts/<nome>.ts
```

---

## 10. Deploy

### ⚠️ GOTCHA CRÍTICO — auto-deploy GitHub→Vercel NÃO funciona

**Sintoma:** push para `main` não dispara deploy na Vercel. Os deploys recentes estão todos como `Username: reginaluiza-2960` em vez do GitHub.

**Workaround atual (sempre fazer):**
```bash
cd ~/Desktop/cp-system
git push origin main
vercel --prod --yes        # build ~45s
```

**Causa provável (a investigar):**
1. Git Integration desconectada nas Settings do projeto Vercel
2. `main` não marcada como branch de produção
3. Webhook GitHub quebrado

**Próximo passo recomendado:** abrir Vercel → Project → Settings → Git → reconectar com o repo `Agenciavrfinance/cpsystem` ou recriar webhook.

### Comandos de deploy
```bash
# Deploy de produção (manual, atual)
vercel --prod --yes

# Deploy de preview (PR/branch isolado)
vercel --yes

# Listar deploys recentes
vercel ls

# Inspecionar build de um deploy específico
vercel inspect <deployment-url>
```

### Variáveis de ambiente em Vercel
- Configurar tudo em: `Vercel → Project → Settings → Environment Variables`
- Cada var precisa ser definida pra ambiente: `Production / Preview / Development`
- Após mudar var, fazer **Redeploy** (não basta o `vercel --prod`).

---

## 11. Pendências em Aberto

### Bloqueia uso comercial
1. **Igor comprar `cpsystem.tec.br`** em Registro.br (R$ 40/ano).
2. **Conta ASAAS** — Igor abrir + enviar API key + configurar `ASAAS_API_KEY` no Vercel.
3. **Tokenização PCI real do cartão** (depende ASAAS).
4. **Auto-deploy GitHub→Vercel** — investigar e corrigir (§10).

### Pequenos ajustes
5. **Aplicar Hero Opção 3 (versão B) na landing real** — copy aprovada está em `src/app/preview-hero/b/page.tsx`. Substituir o `Hero()` em `src/app/page.tsx`. Em seguida **APAGAR** as duas pastas `src/app/preview-hero/a/` e `src/app/preview-hero/b/` (são temporárias).
6. **Chave PIX no signup analista** ainda usa `<Field>` simples — não tem máscara dinâmica conforme tipo (CPF/CNPJ/EMAIL/TELEFONE). Bom melhorar pra paridade com os outros campos.

### Roadmap (já aprovado, não implementado)
7. **IA jurídica completa** (Módulo 7) — só esqueleto da página criado.
8. **Programa de embaixadores** — UI parcial, falta cálculo automático de comissão.
9. **Painel admin do Igor** (Módulo 8) — métricas SaaS (MRR, Churn, LTV, CAC) ainda placeholder.
10. **Notificações WhatsApp** (recurso Premium) — não implementado.
11. **Onboarding assistido** (Premium) — não implementado.

### Estratégia comercial (decidida, não codificada)
12. **Domínio `.tec.br`** — DNS apontar pra Vercel, A/CNAME, e configurar Zoho Mail Free + Resend.
13. **Resend** — implementar envio de e-mails transacionais (confirmação cadastro, reset senha).

---

## 12. Decisões Importantes (memória do projeto)

### Negócio
- **Cobrança:** cliente cadastra cartão no signup mas só é cobrado após trial de 14 dias.
- **Validação cartão hoje:** só Luhn/formato. Tokenização PCI real depende do ASAAS.
- **Filtro de signup:** mantém bloqueio do mesmo e-mail criar duas contas (empresa + analista). Removida apenas a sensibilidade case (maiúsculo/minúsculo).
- **Comissões só pra ANALISTA** — empresa não vê em UI principal. Por isso "comissões" foi tirada da lista do hero.
- **Igor é super admin** mas ele cadastra empresas de teste como conta normal. Por isso `reset-dados.ts` preserva super admins mas apaga conta-empresa.

### Técnicas
- **React 19 + useRef:** sempre passar argumento (`useRef<T | undefined>(undefined)`) — sem isso, build quebra.
- **`useSearchParams`:** evitar (exige Suspense boundary). Usar `window.location.search` em `useEffect` pra ler query params.
- **Prisma migrate em build:** usa `DATABASE_URL_UNPOOLED` (pooled não suporta DDL).
- **Driver Neon:** WebSocket adapter em prod baixou latência 3-5x vs serverless padrão.
- **Vercel region `gru1`:** crítico — sem isso, queries Brasil↔US/EU adicionam ~150ms.
- **Performance:** N+1 eliminado em Atas/Contratos via `Promise.all`. Skeletons + `useOptimistic` em ações que mudam estado.

### UX
- **Logo:** sempre via componente `<Logo>`. Não usar tag `<img>` direto.
- **Sidebar:** o item "Dashboard" do analista DEVE estar rotulado — sem isso, analista clica em outras seções e perde acesso (já corrigido).
- **NavigationProgress:** sem animação de girar (Regina não gostou).
- **Login:** dois botões empresa/analista no topo — atalhos pro signup correto.
- **Signup ordem:** PJ do analista vem ANTES dos dados bancários. Plano + pagamento no FINAL.
- **Pagamento condicional:** seção de cartão só aparece após escolher plano.
- **Submit bloqueado:** botão "Criar conta" desabilitado se plano não selecionado.
- **Hero da landing (em curso de aprovação):** dual-audience (empresa | analista), opção B (preto premium) com Cinzel reservado pra detalhes.

---

## 13. Histórico Recente (últimos 30 commits)

```
c970edb preview(hero-b): quebra forçada antes de 'do empenho' — 2 linhas por público
e279734 preview(hero-b): voltar pro texto corrido com text-balance
d7a54e0 preview(hero-b): corrigir fineline — remove 'sem cartão'
4b94d0d preview(hero-b): diagramação 2 colunas pra subtítulo dual-audience
871d0ef preview(hero-b): aplicar Opção 3 — público duplo empresa + analista
19b9834 chore: previews A e B do hero pra escolha visual
f0af4a0 fix(signup-analista): máscara automática + limite de 11 dígitos no telefone
f083855 fix(signup-analista): máscara automática + limite de 11 dígitos no CPF
172f529 fix(signup): trocar 'Nome do responsável' por 'Nome completo' no topo da seção Empresa
c1c0b4f fix(signup): plano sem default + pagamento condicional + bloqueio do submit
b9525f0 fix(signup): trocar useSearchParams por window.location.search
198ae14 fix(login+signup): botões empresa/analista no login + reordenação do signup
48bf28e fix(login): tirar 'Da licitação ganha ao pagamento' + texto único + logo maior
52cfaa1 fix: remover animação de girar da logo ao navegar
434e559 fix(sidebar/analista): rotular 'Dashboard' no menu pro analista voltar fácil
6fe612e feat: 4 pendências do Igor — sidebar, banco, múltiplos contatos
12037d2 feat(signup): cartão de crédito validado + logo nova em todo lugar
239d63a fix(build): usar DATABASE_URL_UNPOOLED pra prisma migrate deploy
f68339b feat(signup+login): logo correta, plano no cadastro, autopreenchimento e UX premium
3135283 fix(signup): preservar valores, listar erros e Select pra natureza jurídica
1f154f5 fix: useRef do timer com tipo undefined (React 19 + clearTimeout)
f22ac60 fix: useRef sem argumento quebra build no React 19
05b67c4 feat: admin-plataforma, IA jurídica, contexto de empresa e régua de cobrança
5b08282 perf: turbopack no dev — recompilação 10x mais rápida localmente
fa39bf7 feat: logo girando + barra de progresso azul durante navegação
14a44f7 perf: região GRU1 + driver Neon WebSocket — maior ganho de latência
0fbd3cc perf: eliminar N+1 em Contratos e Atas — tudo em 1 Promise.all
2b85894 perf: eliminar queries sequenciais no layout — sub-500ms
3a0c8de perf: skeleton loading + revalidatePath cirúrgico + useOptimistic
c88ebfe perf: AvancarStatus com useOptimistic — resposta imediata ao registrar marco
```

---

## 14. Como Continuar (passos pro Claude Code do VSCode)

1. **Abrir o projeto:** `code ~/Desktop/cp-system`
2. **Ler na ordem:** `HANDOFF.md` (este) → `CLAUDE.md` → `AGENTS.md` → `README.md`
3. **Verificar saúde:**
   ```bash
   git status              # esperar "working tree clean"
   git log --oneline -5    # ver HEAD recente
   npm run dev             # subir servidor
   ```
4. **Próxima tarefa imediata (em curso quando este handoff foi criado):**
   - Aplicar o hero da Opção 3 (versão B) na landing real (`src/app/page.tsx`).
   - Conteúdo a copiar: `src/app/preview-hero/b/page.tsx` (substituir o componente `Hero()` em `page.tsx`).
   - Apagar `src/app/preview-hero/` inteira após aplicação.
   - Commit + `vercel --prod --yes`.
5. **Outras pendências em ordem de prioridade:** ver §11.

---

## 15. Pessoas + Convenções de Comunicação

- **Regina Luiza** = quem está conduzindo o desenvolvimento via Claude. Marketing/operações do Grupo Reis. Tem **autonomia total** — espera execução sem aprovação intermediária; só confirma em ações destrutivas, caras ou sem credencial.
- **Igor Fernandes** = PO. Toma decisões de produto. Está testando a plataforma e mandando apontamentos via WhatsApp/docx (referenciados como "apontamentos do Igor").
- **Linguagem do código:** comentários e mensagens de commit em **português**. Variáveis em português também (`razaoSocial`, `cnpj`, `responsavel`).
- **Padrão de commit:** `feat: ...`, `fix: ...`, `perf: ...`, `chore: ...` — em português, descritivo, com contexto da decisão.

---

## 16. Referências

- **AGENTS.md** — instruções pra agents AI (claude-code, cursor, etc.)
- **CLAUDE.md** — contexto principal pra Claude Code
- **README.md** — visão pública do projeto
- **prisma/schema.prisma** — verdade dos dados
- **`.env.production.example`** — template de env vars
- **`vercel.json`** — config de region + cron
- **Plano de Negócios original:** `~/Desktop/System R&I/Plano de Negócios.docx`
- **Lean Canvas:** `~/Desktop/System R&I/Lean Canvas.pdf`

---

**Fim do handoff.** Boa continuação 🟡
