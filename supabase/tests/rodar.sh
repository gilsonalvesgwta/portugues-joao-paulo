#!/usr/bin/env bash
# Roda todos os testes do banco em um Postgres local descartável.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/rodar.sh
# Recria o banco "jp_teste" do zero a cada execução. Nunca apontar para produção.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
BANCO="jp_teste"
SAIDA="$(mktemp -d)"
trap 'rm -rf "$SAIDA"' EXIT

psql -q -d postgres -c "drop database if exists $BANCO" -c "create database $BANCO"
P=(psql -q -v ON_ERROR_STOP=1 -d "$BANCO")

"${P[@]}" -f "$AQUI/00_ambiente_local.sql"
for m in "$RAIZ"/supabase/migrations/*.sql; do "${P[@]}" -f "$m"; done
"${P[@]}" -f "$AQUI/01_dados_de_teste.sql"

echo "== Regras de acesso, reserva e pagamento =="
if ! "${P[@]}" -f "$AQUI/02_regras.sql" >"$SAIDA/regras.txt" 2>&1; then
  grep -E "ok - |FALHOU|ERROR" "$SAIDA/regras.txt" || cat "$SAIDA/regras.txt"
  echo "REGRAS: FALHOU"; exit 1
fi
grep -E "ok - |REGRAS" "$SAIDA/regras.txt" | sed -E 's/^.*NOTICE:  //'

uid() { printf '00000000-0000-0000-0000-%012d' "$1"; }
tid() { printf '11111111-0000-0000-0000-%012d' "$1"; }

# Uma sessão por aluno; a transação fica aberta meio segundo para as sessões se sobreporem de verdade.
reservar() { # aluno turma arquivo
  psql -q -d "$BANCO" -v ON_ERROR_STOP=1 \
    -c "set role authenticated" \
    -c "select set_config('request.jwt.claims', '{\"sub\":\"$(uid "$1")\"}', false)" \
    -c "begin; select (reservar_turma('$(tid "$2")')).situacao; select pg_sleep(0.5); commit;" \
    >"$3" 2>&1 || true
}

echo "== Disputa: 11 alunos ao mesmo tempo, 10 vagas =="
for a in $(seq 21 31); do reservar "$a" 108 "$SAIDA/vaga_$a.txt" & done
wait
CONFIRMADAS=$("${P[@]}" -At -c "select count(*) from reservas where turma_id = '$(tid 108)' and situacao = 'confirmada'")
LOTADAS=$(grep -l "turma_lotada" "$SAIDA"/vaga_*.txt | wc -l | tr -d ' ')
echo "reservas confirmadas: $CONFIRMADAS (esperado 10) · recusadas por turma lotada: $LOTADAS (esperado 1)"

echo "== Disputa: 1 aluno pede 3 turmas da mesma semana ao mesmo tempo, limite de 2 =="
for t in 109 110 111; do reservar 40 "$t" "$SAIDA/limite_$t.txt" & done
wait
DO_ALUNO=$("${P[@]}" -At -c "select count(*) from reservas where aluno_id = '$(uid 40)' and situacao = 'confirmada'")
NO_LIMITE=$(grep -l "limite_semanal" "$SAIDA"/limite_*.txt | wc -l | tr -d ' ')
echo "reservas confirmadas: $DO_ALUNO (esperado 2) · recusadas pelo limite semanal: $NO_LIMITE (esperado 1)"

if [[ "$CONFIRMADAS" == "10" && "$LOTADAS" == "1" && "$DO_ALUNO" == "2" && "$NO_LIMITE" == "1" ]]; then
  echo "DISPUTA: todos os testes passaram"
else
  echo "DISPUTA: FALHOU"; cat "$SAIDA"/*.txt; exit 1
fi
