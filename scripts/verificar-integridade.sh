#!/usr/bin/env bash
#
# Verificação de integridade do projeto — roda em segundos, antes de build ou deploy.
#
# Regina 31/08/2026: "garanta que isso não aconteça (...) vamos fazer de tudo pra
# nos resguardar."
#
# O QUE ACONTECEU: o projeto vive em ~/Desktop, que está sincronizado no iCloud
# com "Otimizar Armazenamento do Mac" ligado. Quando a sincronização vê duas
# versões do mesmo arquivo, ela não escolhe: renomeia uma com sufixo " 2" e
# deixa as duas. Oito arquivos de código sumiram assim num único dia —
# `page.tsx` virou `page 2.tsx` — e o build passou sem eles, porque uma página
# que não existe simplesmente deixa de ser compilada. Se tivesse subido, editar
# ata e editar contrato sumiriam do ar sem nenhum erro em lugar nenhum.
#
# O .git também foi atingido: oito cópias de `index` e um
# `refs/remotes/origin/HEAD 2` corrompido, que quebrava `git bundle`.
#
# Este script pega os dois sintomas. Sai com código 1 se achar qualquer um.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

falhou=0

echo "── Arquivos rastreados que sumiram do disco ──────────────"
faltando=$(git ls-files | while read -r f; do [ -e "$f" ] || echo "  $f"; done)
if [ -n "$faltando" ]; then
  echo "❌ FALTANDO — restaure com: git checkout -- <arquivo>"
  echo "$faltando"
  falhou=1
else
  echo "✅ nenhum"
fi

echo
echo "── Duplicatas de conflito do iCloud (\"arquivo 2.tsx\") ────"
# O .next é build descartável e o node_modules se reinstala; o que importa é
# código-fonte, migrations, scripts e o próprio .git.
dups=$(find . .git \
  \( -name "* [0-9]" -o -name "* [0-9].*" \) \
  -not -path "./node_modules/*" -not -path "./.next/*" 2>/dev/null | sed 's/^/  /')
if [ -n "$dups" ]; then
  echo "❌ ENCONTRADAS — confira se são idênticas ao original antes de apagar:"
  echo "$dups"
  echo "     diff \"arquivo 2.tsx\" arquivo.tsx"
  falhou=1
else
  echo "✅ nenhuma"
fi

echo
echo "── O GitHub tem o que está aqui? ─────────────────────────"
local_head=$(git rev-parse HEAD 2>/dev/null)
remoto=$(git ls-remote origin main 2>/dev/null | cut -f1)
if [ -z "$remoto" ]; then
  echo "⚠️  não consegui falar com o GitHub (offline?)"
elif [ "$local_head" = "$remoto" ]; then
  echo "✅ sincronizado (${local_head:0:8})"
else
  # Não é falha: pode ser commit local ainda não enviado. Mas o GitHub é a
  # cópia que sobrevive a um acidente na máquina, então vale o aviso.
  echo "⚠️  local ${local_head:0:8} · GitHub ${remoto:0:8} — falta 'git push'"
fi

echo
[ "$falhou" -eq 0 ] && echo "Tudo íntegro." || echo "Corrija os itens acima ANTES de buildar ou subir."
exit "$falhou"
