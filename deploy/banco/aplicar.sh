#!/bin/sh
# Prepara o banco da plataforma. Roda uma vez a cada instalação ou atualização e termina:
#   1. espera o banco responder;
#   2. define a senha dos usuários internos que o serviço de login e o de dados usam;
#   3. aplica, em ordem, as migrações que ainda não foram aplicadas (cada uma inteira ou nada);
#   4. avisa o serviço de dados para reler as tabelas.
# Pode rodar quantas vezes for preciso: o que já foi feito não é refeito.
set -eu

: "${PGHOST:?Falta PGHOST (o nome do serviço do banco)}"
: "${POSTGRES_PASSWORD:?Falta POSTGRES_PASSWORD (a senha do banco)}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-postgres}"
export PGPASSWORD="$POSTGRES_PASSWORD"
export PGCONNECT_TIMEOUT=5
PASTA="${PASTA_DAS_MIGRACOES:-/migracoes}"

# psql sem arquivo de preferências, parando no primeiro erro. Uso: sql <usuario> [opções do psql]
sql() {
  usuario="$1"
  shift
  psql -X -q -v ON_ERROR_STOP=1 -U "$usuario" "$@"
}

esperar() { # descrição, tentativas, comando...
  descricao="$1"
  limite="$2"
  shift 2
  tentativa=0
  until "$@" > /dev/null 2>&1; do
    tentativa=$((tentativa + 1))
    if [ "$tentativa" -ge "$limite" ]; then
      echo "ERRO: $descricao não ficou pronto a tempo."
      exit 1
    fi
    sleep 5
  done
}

echo "Esperando o banco em $PGHOST:$PGPORT..."
esperar "o banco" 60 sql supabase_admin -Atc "select 1"

echo "Definindo a senha dos usuários internos..."
sql supabase_admin -v senha="$POSTGRES_PASSWORD" <<'SQL'
alter role authenticator with login password :'senha';
alter role supabase_auth_admin with login password :'senha';
SQL

tem_usuarios() {
  [ "$(sql postgres -Atc "select to_regclass('auth.users') is not null")" = "t" ]
}
echo "Esperando as tabelas de login..."
esperar "o serviço de login" 60 tem_usuarios

sql postgres <<'SQL'
create schema if not exists controle;
create table if not exists controle.migracoes (
  nome        text primary key,
  aplicada_em timestamptz not null default now()
);
SQL

aplicadas=0
for arquivo in "$PASTA"/*.sql; do
  [ -f "$arquivo" ] || continue
  nome="$(basename "$arquivo")"
  case "$nome" in
    *[!0-9A-Za-z_.-]*) echo "ERRO: nome de migração inesperado: $nome"; exit 1 ;;
  esac
  if [ "$(sql postgres -Atc "select count(*) from controle.migracoes where nome = '$nome'")" = "1" ]; then
    echo "já aplicada: $nome"
    continue
  fi
  echo "aplicando: $nome"
  sql postgres --single-transaction -f "$arquivo" -c "insert into controle.migracoes (nome) values ('$nome')"
  aplicadas=$((aplicadas + 1))
done

sql postgres -c "notify pgrst, 'reload schema'"
echo "BANCO PRONTO ($aplicadas migração(ões) aplicada(s) agora)."
