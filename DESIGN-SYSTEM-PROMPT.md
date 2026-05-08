# CP System — Design System Liquid Glass

> **Prompt de execução para padronizar a estética em todas as rotas internas (app autenticado).**
> Source of truth visual: [public/dashboard-preview.html](public/dashboard-preview.html) · Imagem: [public/dashboard-preview.jpg](public/dashboard-preview.jpg)

---

## OBJETIVO

Aplicar o design Liquid Glass aprovado no preview do dashboard a TODAS as telas internas do app (`src/app/(app)/**`), mantendo 100% da lógica, dados, rotas, hierarquia de informação e funcionalidades. **Só a camada estética muda.**

A linguagem segue Apple Vision Pro / visionOS adaptada à identidade CP System: dark mode com glass real, fundo fotográfico de folhagem dourada por trás dos cards, dourado champagne como cor da marca, paleta semântica refinada (verde sage para positivo, vermelho claro para negativo, lavender/peach/azul-cinza como neutros).

---

## RESTRIÇÕES

- **NÃO altere** lógica de negócio, queries Prisma, server actions, validações, schemas, rotas ou hierarquia de informação.
- **NÃO adicione** bibliotecas pesadas. Use Tailwind v4 que já está no projeto + CSS variables.
- **NÃO use** o design system em telas públicas (landing, login, signup) — apenas em `src/app/(app)/**`.
- **MANTENHA** todos os componentes existentes funcionando (Sidebar, charts Recharts, tabelas, formulários).
- **MANTENHA** legibilidade WCAG AA — texto sobre glass tem contraste mínimo. Se um card colorido prejudicar leitura, reduza intensidade da cor (não tire o glass).

---

## 1. DESIGN TOKENS (CSS Variables)

Adicione em [src/app/globals.css](src/app/globals.css):

```css
:root {
  /* === Dourado ouro fino (cor da logo CP) === */
  --primary:        #D4AF37;
  --primary-bright: #E8C875;
  --primary-deep:   #A88947;
  --primary-glow:   rgba(212, 175, 55, 0.5);

  /* === Verde sage refinado — financeiros positivos === */
  --mint:           #5DD8B6;
  --mint-bright:    #7FE8C9;
  --mint-deep:      #2EAB85;
  --mint-glow:      rgba(93, 216, 182, 0.45);

  /* === Peach quente — atenção em andamento === */
  --rose:           #F0B8A8;
  --rose-bright:    #F5CCBE;
  --rose-glow:      rgba(240, 184, 168, 0.45);

  /* === Lavender — info secundária === */
  --lavender:       #C5B4FF;
  --lavender-glow:  rgba(197, 180, 255, 0.45);

  /* === Azul-acinzentado neutro === */
  --sky:            #B8C5D6;
  --sky-bright:     #D4DDE8;
  --sky-glow:       rgba(184, 197, 214, 0.4);

  /* === Vermelho claro suave — negativos reais === */
  --coral:          #E88A98;
  --coral-bright:   #F0A8B3;
  --coral-deep:     #C66770;
  --coral-glow:     rgba(232, 138, 152, 0.5);

  /* Texto dark mode */
  --text:        #FFFFFF;
  --text-soft:   #E8E5DC;
  --text-mute:   #A8A39A;
  --text-faint:  #5A5650;

  /* Glass surfaces */
  --glass-1:     rgba(255, 255, 255, 0.04);
  --glass-2:     rgba(255, 255, 255, 0.06);
  --glass-3:     rgba(255, 255, 255, 0.09);
  --hairline:    rgba(255, 255, 255, 0.08);

  /* Sombras */
  --shadow-sm: 0 4px 16px rgba(0, 0, 0, 0.25);
  --shadow-md: 0 8px 30px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 30px 80px -20px rgba(0, 0, 0, 0.7);

  /* Borders */
  --radius-sm:  10px;
  --radius-md:  14px;
  --radius-lg:  22px;
  --radius-xl:  28px;
  --radius-pill: 100px;

  /* Easing */
  --ease-ios: cubic-bezier(0.32, 0.72, 0, 1);
}
```

---

## 2. BACKGROUND ATMOSFÉRICO

Aplicar no layout `src/app/(app)/layout.tsx` ou em `globals.css` no `body`. Estrutura:

```html
<div class="bg-image" aria-hidden></div>
<div class="bg-blobs" aria-hidden>
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="blob blob-4"></div>
  <div class="blob blob-5"></div>
</div>
```

```css
body { background: #050505; }

.bg-image {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    linear-gradient(135deg, rgba(8, 8, 14, 0.55) 0%, rgba(15, 13, 30, 0.65) 100%),
    url('https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=2400&q=85&auto=format&fit=crop');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}

.bg-blobs { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.blob { position: absolute; border-radius: 50%; filter: blur(140px); mix-blend-mode: screen; }
.blob-1 { width: 700px; height: 700px; background: radial-gradient(circle, rgba(212, 175, 55, 0.4), transparent 70%); top: -150px; left: -100px; }
.blob-2 { width: 600px; height: 600px; background: radial-gradient(circle, rgba(240, 184, 168, 0.35), transparent 70%); top: 30%; right: -150px; }
.blob-3 { width: 800px; height: 800px; background: radial-gradient(circle, rgba(197, 180, 255, 0.32), transparent 70%); top: 55%; left: -200px; }
.blob-4 { width: 700px; height: 700px; background: radial-gradient(circle, rgba(93, 216, 182, 0.28), transparent 70%); bottom: -200px; right: 10%; }
.blob-5 { width: 500px; height: 500px; background: radial-gradient(circle, rgba(184, 197, 214, 0.32), transparent 70%); top: 75%; left: 35%; }

.bg-blobs::after {
  content: ''; position: absolute; inset: 0; opacity: 0.4; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' /%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.18 0' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E");
}

main, .app-shell { position: relative; z-index: 1; }
```

> **Importante:** o glass só funciona porque tem essa imagem + blobs por trás. Se remover, o blur fica preto e perde a estética. Mantenha.

---

## 3. COMPONENTE BASE — `.glass`

Container principal de qualquer card/painel/seção interna:

```css
.glass {
  position: relative;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-radius: var(--radius-xl);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -1px 0 rgba(0, 0, 0, 0.3),
    0 30px 80px -20px rgba(0, 0, 0, 0.7),
    0 8px 30px -4px rgba(0, 0, 0, 0.4);
}
.glass::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
  background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.18) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
}

.glass-tile {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(30px) saturate(160%);
  -webkit-backdrop-filter: blur(30px) saturate(160%);
  border-radius: var(--radius-lg);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 4px 16px rgba(0, 0, 0, 0.25);
}
.glass-tile::before { /* mesma técnica de borda gradient — copiar de .glass::before */ }

@supports not (backdrop-filter: blur(1px)) {
  .glass, .glass-tile { background: rgba(20, 20, 28, 0.85); }
}
```

---

## 4. CARDS COLORIDOS — `.t-{cor}`

Cards com cor temática preenchendo todo o card, mantendo o glass. Aplicar em qualquer `.glass-tile`:

```css
.t-primary {
  background:
    linear-gradient(135deg, rgba(212, 175, 55, 0.38) 0%, rgba(212, 175, 55, 0.14) 100%),
    rgba(255, 255, 255, 0.03);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 0 0 0.5px rgba(212, 175, 55, 0.4),
    0 4px 20px rgba(0, 0, 0, 0.3);
}
.t-mint     { background: linear-gradient(135deg, rgba(93, 216, 182, 0.38), rgba(93, 216, 182, 0.14)), rgba(255,255,255,0.03);
              box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(93, 216, 182, 0.4), 0 4px 20px rgba(0,0,0,0.3); }
.t-rose     { background: linear-gradient(135deg, rgba(240, 184, 168, 0.38), rgba(240, 184, 168, 0.14)), rgba(255,255,255,0.03);
              box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(240, 184, 168, 0.4), 0 4px 20px rgba(0,0,0,0.3); }
.t-lavender { background: linear-gradient(135deg, rgba(197, 180, 255, 0.38), rgba(197, 180, 255, 0.14)), rgba(255,255,255,0.03);
              box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(197, 180, 255, 0.4), 0 4px 20px rgba(0,0,0,0.3); }
.t-sky      { background: linear-gradient(135deg, rgba(184, 197, 214, 0.38), rgba(184, 197, 214, 0.14)), rgba(255,255,255,0.03);
              box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(184, 197, 214, 0.4), 0 4px 20px rgba(0,0,0,0.3); }
.t-coral    { background: linear-gradient(135deg, rgba(232, 138, 152, 0.38), rgba(232, 138, 152, 0.14)), rgba(255,255,255,0.03);
              box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(232, 138, 152, 0.4), 0 4px 20px rgba(0,0,0,0.3); }
```

---

## 5. SEMÂNTICA DE CORES (regra obrigatória)

| Tom | Quando usar |
|-----|------------|
| **Dourado** (`t-primary`) | Total / identidade da marca / atenção sem urgência (valores contratados, atas vigentes, próximos a renovar, próximo prazo, item ativo na sidebar) |
| **Verde sage** (`t-mint`) | Financeiro positivo concluído (valores executados, recebidos, contratos vigentes, em renovação automática, órgãos atendidos, "Em dia", "Entregue") |
| **Peach** (`t-rose`) | Atenção em andamento, em movimento (valores a receber, "Em trânsito") |
| **Lavender** (`t-lavender`) | Info secundária / saldo / agrupamento (valores a executar, contínuos ativos, contratos em execução, "NF emitida") |
| **Azul-cinza** (`t-sky`) | Info estatística neutra (empenhos em execução, "NF encaminhada") |
| **Vermelho claro** (`t-coral`) | Negativo real / alerta sério (reajuste vencendo, processos apuratórios em andamento, risco de multa, atraso "Sim — N dias", "Multa", "Impedimento") |

---

## 6. TIPOGRAFIA

- Stack: `'Inter', -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif` (já carregado em `globals.css`)
- Logo "CP" mantém Playfair Display (assinatura visual da marca)
- Pesos: 500 (body), 600-700 (UI), 800-900 (display/números)
- Letter-spacing negativo nos títulos: -0.025em a -0.05em
- Números KPI: `font-variant-numeric: tabular-nums lining-nums; letter-spacing: -0.045em`
- Eyebrows uppercase: `letter-spacing: 0.22em; font-weight: 700; font-size: 10px`

```css
.eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-mute); }
.display { font-weight: 800; letter-spacing: -0.045em; font-variant-numeric: tabular-nums; }
.title-1 { font-size: 30px; font-weight: 800; letter-spacing: -0.04em; }   /* títulos de bloco */
.title-2 { font-size: 22px; font-weight: 700; letter-spacing: -0.025em; }  /* subtítulos */
.headline { font-size: 17px; font-weight: 600; letter-spacing: -0.012em; } /* chart-title */
.body    { font-size: 14px; font-weight: 500; letter-spacing: -0.005em; }
```

---

## 7. COMPONENTES PADRONIZADOS

### Botão primário (CTA)
```css
.btn-primary {
  background: linear-gradient(135deg, var(--primary-bright), var(--primary));
  color: #0A0A0A;
  height: 48px; padding: 0 26px;
  border-radius: var(--radius-pill);
  font-size: 14px; font-weight: 800; letter-spacing: -0.01em;
  box-shadow: 0 8px 32px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.5);
  transition: transform 200ms var(--ease-ios);
}
.btn-primary:hover { transform: translateY(-1px); }
.btn-primary:active { transform: scale(0.98); }
```

### Sidebar
- Container: `.glass` com `border-radius: 28px`, sticky, `width: 260px`
- Item ativo: gradient dourado (`linear-gradient(135deg, var(--primary-bright), var(--primary))`) com texto `#0A0A0A`
- Item normal: `color: var(--text-soft)`; hover `background: rgba(255,255,255,0.05)`
- Ícones: stroke-width 1.8, color `var(--primary)` quando inativos / `#0A0A0A` quando ativo
- 3 grupos: VISÃO GERAL · MÓDULOS · CONTA (estrutura aprovada no preview)

### Header (topbar)
- `.glass` com padding 30px 36px, radius 28px
- Eyebrow dourado `var(--primary)` com data
- Título: `font-size: 52px; font-weight: 800; letter-spacing: -0.05em`
- "Nome do usuário" em italic (`<em>`) com gradient dourado
- Botão "+ Nova ação" pill dourado à direita

### Tabelas
```css
table { width: 100%; border-collapse: collapse; }
thead th {
  padding: 14px 24px; font-size: 9px; font-weight: 700; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--text-mute);
  background: rgba(0, 0, 0, 0.2); border-bottom: 0.5px solid var(--hairline);
}
tbody td { padding: 17px 24px; border-bottom: 0.5px solid rgba(255,255,255,0.05); font-size: 13px; color: var(--text-soft); font-weight: 500; }
tbody tr:hover { background: rgba(255,255,255,0.025); }
.row-alert { background: rgba(232, 138, 152, 0.06); }  /* linhas com alerta */
```

### Badges (status pills)
```css
.badge { padding: 5px 12px; border-radius: var(--radius-pill); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border: 0.5px solid; backdrop-filter: blur(10px); }
.badge.b-empenhado    { color: var(--text-mute);     border-color: var(--hairline);              background: rgba(255,255,255,0.04); }
.badge.b-pedido       { color: var(--primary-bright);border-color: rgba(212,175,55,0.4);         background: rgba(212,175,55,0.12); }
.badge.b-transito     { color: var(--rose);          border-color: rgba(240,184,168,0.4);        background: rgba(240,184,168,0.12); }
.badge.b-entregue     { color: var(--mint);          border-color: rgba(93,216,182,0.4);         background: rgba(93,216,182,0.12); }
.badge.b-nf-emitida   { color: var(--lavender);      border-color: rgba(197,180,255,0.4);        background: rgba(197,180,255,0.12); }
.badge.b-nf-encam     { color: var(--sky);           border-color: rgba(184,197,214,0.4);        background: rgba(184,197,214,0.12); }
.badge.b-multa        { color: var(--coral);         border-color: rgba(232,138,152,0.4);        background: rgba(232,138,152,0.12); }
.badge.b-impedimento  { color: var(--rose);          border-color: rgba(240,184,168,0.4);        background: rgba(240,184,168,0.12); }
```

### Charts (Recharts)
- Cor das barras/linhas seguir a semântica: positivo `var(--mint)`, dourado `var(--primary-bright)`, alerta `var(--coral)`, neutro `var(--lavender)`
- Donut/Pie: gradient `var(--primary-bright) → var(--primary-deep)` para destaque
- Tooltip: `.glass-tile` com background `rgba(20,20,28,0.92)` e blur
- Eixo: cor `var(--text-mute)`, font 11px

### Mapa do Brasil
- Usar `public/brasil-uf.geojson` que já existe
- Estados destacados nas mesmas cores semânticas (h1=primary-bright, h2=primary, h3=mint, h4=lavender, h5=rose)
- Aplicar `filter: drop-shadow(0 0 14px var(--{cor}-glow))` nos UFs ativos
- Hover: `fill: var(--primary)`

### Inputs / Forms
```css
input, textarea, select {
  background: rgba(255,255,255,0.05);
  border: 0.5px solid var(--hairline);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  color: var(--text);
  font-size: 14px;
  transition: border-color 200ms var(--ease-ios);
}
input:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 3px var(--primary-glow); }
```

---

## 8. ONDE APLICAR

Todas as rotas em `src/app/(app)/**`. Lista das principais:

- `/dashboard` — já temos referência completa (preview)
- `/empresas` — listagem de CNPJs (cards glass, badges de status)
- `/atas`, `/atas/[id]` — listagem e detalhe de ata
- `/contratos`, `/contratos/[id]` — idem
- `/execucao`, `/execucao/[id]` — empenhos
- `/contratacoes/nova` — seletor com 3 cards (aplicar `.glass-tile` + cores)
- `/contratacoes/nova/ata`, `/contratacoes/nova/contrato`, `/contratacoes/nova/empenho` — formulários
- `/reajustes`, `/relatorios`, `/juridico`
- `/notificacoes`, `/conta/assinatura`, `/vinculos`, `/equipe`, `/embaixadores`, `/auditoria`, `/termos`
- `/painel-analista`, `/honorarios`
- `/admin`, `/admin-plataforma`

**Não aplicar em:** `src/app/(auth)/**`, `src/app/page.tsx` (landing), páginas públicas.

---

## 9. CHECKLIST DE EXECUÇÃO

- [ ] Adicionar tokens em [src/app/globals.css](src/app/globals.css)
- [ ] Adicionar background atmosférico em [src/app/(app)/layout.tsx](src/app/(app)/layout.tsx)
- [ ] Refatorar [src/components/Sidebar.tsx](src/components/Sidebar.tsx) com glass + grupos VISÃO GERAL/MÓDULOS/CONTA
- [ ] Reescrever [src/app/(app)/dashboard/page.tsx](src/app/(app)/dashboard/page.tsx) seguindo o preview
- [ ] Padronizar componentes compartilhados: criar `src/components/ui/{GlassCard,KPI,Badge,Button,Table}.tsx`
- [ ] Aplicar tokens nos charts existentes (`src/components/charts/*`)
- [ ] Substituir mapa atual pelo SVG real do Brasil (já temos `public/brasil-uf.geojson`)
- [ ] Migrar formulários (Cadastro Ata, Contrato, Empenho) — manter Zod/RHF
- [ ] Rodar `npm run typecheck` e `npm run lint`
- [ ] Conferir cada rota interna no browser

---

## 10. REFERÊNCIAS

- **Preview HTML** (source of truth visual): [public/dashboard-preview.html](public/dashboard-preview.html)
- **Imagem aprovada**: [public/dashboard-preview.jpg](public/dashboard-preview.jpg)
- **GeoJSON do Brasil**: [public/brasil-uf.geojson](public/brasil-uf.geojson)
- **Logo CP**: [public/cp-system-logo.svg](public/cp-system-logo.svg)
- **Schema Prisma**: [prisma/schema.prisma](prisma/schema.prisma)

---

## REGRA DE OURO

Se na dúvida sobre como estilizar algo novo: **abra `public/dashboard-preview.html` no browser, identifique um componente análogo, replique exatamente.** O preview é o padrão.
