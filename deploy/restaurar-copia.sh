#!/bin/sh
# Restaura uma cópia de segurança feita por copia-de-seguranca.sh. Roda na VPS, como root.
#
#   sh restaurar-copia.sh /root/copias-portuguesjp/portuguesjp-AAAA-MM-DD-HHMMSS.sql.gz
#
# ATENÇÃO: troca TODOS os dados atuais da plataforma pelos da cópia. O que foi feito depois da
# cópia (compras, aulas assistidas, reservas) se perde. A plataforma fica fora do ar por cerca
# de um minuto. Se algo falhar no meio, nada é trocado: o banco continua como estava.
#
# A cópia tem só os dados. Ela entra em uma plataforma já instalada, na mesma versão em que a
# cópia foi feita ou em uma mais nova (para mudar de VPS: instale a plataforma na VPS nova,
# espere ela subir e então restaure a cópia).
set -eu

ARQUIVO="${1:-}"
if [ -z "$ARQUIVO" ] || [ ! -f "$ARQUIVO" ]; then
  echo "Uso: sh restaurar-copia.sh <arquivo .sql.gz da cópia>" >&2
  exit 1
fi
gzip -t "$ARQUIVO"
if ! gunzip -c "$ARQUIVO" | grep -q "PostgreSQL database dump complete"; then
  echo "ERRO: este arquivo não é uma cópia completa." >&2
  exit 1
fi

CONTEINER="$(docker ps --filter "name=portuguesjp_db" --format '{{.ID}}' | head -n 1)"
if [ -z "$CONTEINER" ]; then
  echo "ERRO: não achei o banco da plataforma (portuguesjp_db). A stack está no ar?" >&2
  exit 1
fi

if [ "${CONFIRMAR:-}" != "sim" ]; then
  echo "Isto troca TODOS os dados atuais da plataforma pelos de: $ARQUIVO"
  printf "Para continuar, escreva RESTAURAR e aperte Enter: "
  read -r RESPOSTA
  if [ "$RESPOSTA" != "RESTAURAR" ]; then
    echo "Cancelado. Nada foi mudado."
    exit 1
  fi
fi

# O aplicativo, o login e o serviço de dados param enquanto o banco é trocado.
SERVICOS="$(docker service ls --format '{{.Name}}' | grep -E '(^|_)portuguesjp_(app|auth|rest)$' || true)"
parar() { for servico in $SERVICOS; do docker service scale --detach "$servico=0" > /dev/null; done; }
voltar() { for servico in $SERVICOS; do docker service scale --detach "$servico=1" > /dev/null; done; }
trap voltar EXIT

echo "Parando o aplicativo, o login e o serviço de dados..."
parar
sleep 10

echo "Restaurando..."
# As tabelas que a cópia traz são esvaziadas e recebem os dados dela (uma tabela que a cópia não
# traz, criada por uma versão mais nova da plataforma, fica como está). Tudo em uma transação só,
# parando no primeiro erro: ou a cópia entra inteira, ou nada muda.
TABELAS="$(gunzip -c "$ARQUIVO" | awk '
  dentro == 1 { if ($0 == "\\.") dentro = 0; next }
  /^COPY / { dentro = 1; lista = lista (lista == "" ? "" : ", ") $2 }
  END { print lista }
')"
{ printf 'TRUNCATE TABLE %s CASCADE;\n' "$TABELAS"; gunzip -c "$ARQUIVO"; } | docker exec -i "$CONTEINER" psql -X -q -h 127.0.0.1 -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 --single-transaction -f - > /dev/null

echo "Ligando de novo o aplicativo, o login e o serviço de dados..."
voltar
trap - EXIT
echo "RESTAURAÇÃO PRONTA. Em cerca de um minuto a plataforma volta ao ar, com os dados da cópia."
