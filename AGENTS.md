<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Testar de verdade antes de dizer que está pronto

Existe banco local. **Não teste contra produção e não entregue sem testar.**

```bash
createdb cpsystem_test
export DATABASE_URL="postgresql://$USER@localhost:5432/cpsystem_test"
npx prisma migrate deploy      # o histórico reproduz o schema (conferido em 21/08)
npx tsx prisma/seed-dev.ts     # recusa rodar se a URL não for local
npx next dev
```

O seed imprime dois cookies de sessão, então dá pra entrar sem senha e exercitar
o sistema como cada perfil:

```bash
curl -b "cp_session=dev-titular" http://localhost:3000/dashboard
curl -b "cp_session=dev-colaborador" http://localhost:3000/honorarios   # deve barrar
```

Detalhes que custaram tempo e vale saber:

- `src/lib/prisma.ts` escolhe o adapter pela URL: host `neon.tech` usa o do Neon,
  qualquer outro usa `pg`. O adapter do Neon **não fala com Postgres comum e não
  dá erro claro** — só não conecta.
- `src/proxy.ts` (era `middleware.ts`) injeta o header `x-pathname`. O paywall e
  o acesso por módulo decidem a partir dele, e **falham abrindo** se ele sumir.
  Mexeu ali? Teste acesso depois.
- Mudança de schema vai por `prisma migrate`, nunca por `db push`: o push altera
  o banco sem registrar o passo, e foi assim que o histórico ficou 37 colunas
  atrás do schema (consertado em 21/08).
