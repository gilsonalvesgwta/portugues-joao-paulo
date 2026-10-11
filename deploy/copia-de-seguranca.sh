#!/bin/sh
# Cópia de segurança do banco da plataforma (contas, cursos, matrículas, progresso, reservas...).
# Roda na VPS, como root. Não derruba nada: a plataforma continua no ar durante a cópia.
#
#   sh copia-de-seguranca.sh [pasta]
#
# A pasta padrão é /root/copias-portuguesjp. Cada cópia é um arquivo .sql.gz com data e hora no
# nome. As cópias com mais de MANTER_DIAS dias (padrão: 14) são apagadas.
# O arquivo tem os dados dos alunos: guarde também fora da VPS, em lugar protegido.
set -eu

PASTA="${1:-/root/copias-portuguesjp}"
MANTER_DIAS="${MANTER_DIAS:-14}"

CONTEINER="$(docker ps --filter "name=portuguesjp_db" --format '{{.ID}}' | head -n 1)"
if [ -z "$CONTEINER" ]; then
  echo "ERRO: não achei o banco da plataforma (portuguesjp_db). A stack está no ar?" >&2
  exit 1
fi

mkdir -p "$PASTA"
chmod 700 "$PASTA"
ARQUIVO="$PASTA/portuguesjp-$(date +%Y-%m-%d-%H%M%S).sql.gz"

# Só os dados da plataforma: o que está nas tabelas dela (public) e as contas e senhas (auth).
# A estrutura das tabelas não entra na cópia: ela vem da própria instalação da plataforma.
# Se a cópia falhar no meio, o arquivo pela metade não fica com o nome de uma cópia boa.
docker exec "$CONTEINER" pg_dump -h 127.0.0.1 -U supabase_admin -d postgres \
  --data-only --disable-triggers --schema=public --schema=auth --exclude-table=auth.schema_migrations \
  | gzip > "$ARQUIVO.parcial"
gzip -t "$ARQUIVO.parcial"
if ! gunzip -c "$ARQUIVO.parcial" | grep -q "PostgreSQL database dump complete"; then
  rm -f "$ARQUIVO.parcial"
  echo "ERRO: a cópia saiu incompleta. Nada foi guardado." >&2
  exit 1
fi
mv "$ARQUIVO.parcial" "$ARQUIVO"
chmod 600 "$ARQUIVO"

find "$PASTA" -name 'portuguesjp-*.sql.gz' -mtime "+$MANTER_DIAS" -delete
echo "CÓPIA PRONTA: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"
