#!/bin/sh
# Serviço de cópias de segurança da plataforma. Fica no ar o tempo todo, ao lado do banco:
#   - todo dia, a partir de HORA_DA_COPIA (padrão: 3 da manhã, horário de Brasília), faz a cópia
#     automática do dia, e apaga as automáticas com mais de MANTER_DIAS dias (padrão: 14);
#   - atende os pedidos que a administração deixa na pasta de pedidos: fazer uma cópia agora ou
#     restaurar uma cópia.
#
# A pasta das cópias (PASTA, padrão /copias) é um volume que o aplicativo também enxerga:
#   arquivos/   as cópias (portuguesjp-AAAA-MM-DD-HHMMSS-tipo.sql.gz)
#   pedidos/    um arquivo por pedido da administração, apagado assim que é lido
#   estado/     vivo (sinal de vida), trabalhando (o que está sendo feito), config e historico.log
#
# A cópia tem os dados da plataforma (tabelas, contas e senhas). A estrutura das tabelas vem da
# própria instalação: por isso uma cópia entra em outra VPS, desde que a plataforma instalada lá
# seja da mesma versão ou mais nova.
set -u

: "${PGHOST:?Falta PGHOST (o nome do serviço do banco)}"
: "${POSTGRES_PASSWORD:?Falta POSTGRES_PASSWORD (a senha do banco)}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-postgres}"
export PGUSER=supabase_admin
export PGPASSWORD="$POSTGRES_PASSWORD"
export PGCONNECT_TIMEOUT=10
export TZ="${TZ:-America/Sao_Paulo}"

PASTA="${PASTA:-/copias}"
HORA_DA_COPIA="${HORA_DA_COPIA:-3}"
MANTER_DIAS="${MANTER_DIAS:-14}"
INTERVALO="${INTERVALO:-5}"
ESPERA_DEPOIS_DE_FALHA="${ESPERA_DEPOIS_DE_FALHA:-1800}"
CONFERIR="${CONFERIR:-/conferir-copia.awk}"

ARQUIVOS="$PASTA/arquivos"
PEDIDOS="$PASTA/pedidos"
ESTADO="$PASTA/estado"
NOME_VALIDO='^portuguesjp-[0-9A-Za-z_-]+\.sql\.gz$'

umask 077
if ! mkdir -p "$ARQUIVOS" "$PEDIDOS" "$ESTADO" 2> /dev/null || ! touch "$ESTADO/vivo" 2> /dev/null; then
  echo "ERRO: não consigo gravar em $PASTA. O volume das cópias precisa pertencer ao usuário $(id -u)."
  exit 1
fi
# O aplicativo grava pedidos e cópias enviadas aqui, com o mesmo usuário deste serviço.
chmod 700 "$PASTA" "$ARQUIVOS" "$PEDIDOS" "$ESTADO"

agora() { date +%s; }

# Uma linha no histórico que a administração mostra: quando, o quê, deu certo?, arquivo, mensagem.
anotar() { # acao, resultado (ok|erro), arquivo, mensagem
  mensagem="$(printf '%s' "$4" | tr '\t\r\n' '   ' | cut -c1-400)"
  printf '%s\t%s\t%s\t%s\t%s\n' "$(agora)" "$1" "$2" "$3" "$mensagem" >> "$ESTADO/historico.log"
  if [ "$(wc -l < "$ESTADO/historico.log")" -gt 300 ]; then
    tail -n 200 "$ESTADO/historico.log" > "$ESTADO/historico.tmp" && mv "$ESTADO/historico.tmp" "$ESTADO/historico.log"
  fi
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1 $2 $3 $mensagem"
}

trabalhando() { printf '%s\t%s\t%s\n' "$(agora)" "$1" "${2:-}" > "$ESTADO/trabalhando"; }
descansando() { rm -f "$ESTADO/trabalhando"; }

sql() { psql -X -q -v ON_ERROR_STOP=1 -Atc "$1"; }

# A cópia sai com um cabeçalho (de quando é, de que versão da plataforma) e os dados.
# As linhas \restrict e \unrestrict, que versões novas do pg_dump escrevem, ficam de fora: assim o
# arquivo também entra por um psql mais antigo (o do roteiro restaurar-copia.sh, por exemplo).
copiar() { # tipo; escreve o nome do arquivo em $FEITA
  c_tipo="$1"
  FEITA=""
  c_ultima="$(sql "select coalesce(max(nome), '') from controle.migracoes" 2> "$ESTADO/erro.txt")" || {
    ERRO="O banco não respondeu: $(head -c 300 "$ESTADO/erro.txt")"
    return 1
  }
  c_nome="portuguesjp-$(date +%Y-%m-%d-%H%M%S)-$c_tipo.sql.gz"
  c_parcial="$ARQUIVOS/.parcial-$c_nome"
  {
    echo "-- Cópia de segurança da plataforma Português com João Paulo"
    echo "-- formato: 1"
    echo "-- feita-em: $(date '+%Y-%m-%d %H:%M:%S %z')"
    echo "-- ultima-migracao: $c_ultima"
    echo "-- tipo: $c_tipo"
    if pg_dump --data-only --disable-triggers --schema=public --schema=auth --exclude-table=auth.schema_migrations 2> "$ESTADO/erro.txt"; then
      :
    else
      echo "-- FALHOU"
    fi
  } | awk '
    dentro == 1 { if ($0 == "\\.") dentro = 0; print; next }
    /^COPY / { dentro = 1 }
    /^\\(un)?restrict / { next }
    { print }
  ' | gzip > "$c_parcial"
  if ! gzip -t "$c_parcial" 2> /dev/null || ! gunzip -c "$c_parcial" | tail -n 5 | grep -q '^-- PostgreSQL database dump complete$'; then
    ERRO="A cópia saiu incompleta e foi descartada. $(head -c 300 "$ESTADO/erro.txt")"
    rm -f "$c_parcial"
    return 1
  fi
  mv "$c_parcial" "$ARQUIVOS/$c_nome"
  FEITA="$c_nome"
  return 0
}

tamanho() { du -h "$1" | cut -f1; }

fazer_copia() { # tipo
  trabalhando copiar "$1"
  if copiar "$1"; then
    anotar copiar ok "$FEITA" "Cópia pronta ($(tamanho "$ARQUIVOS/$FEITA"))."
    descansando
    return 0
  fi
  anotar copiar erro "" "$ERRO"
  descansando
  return 1
}

# Troca todos os dados da plataforma pelos de uma cópia. Antes, confere o arquivo e guarda uma
# cópia do que existe agora (tipo "antes-de-restaurar"), para dar para voltar atrás.
# Tudo em uma transação só: ou a cópia entra inteira, ou nada muda.
restaurar() { # arquivo
  nome="$1"
  arquivo="$ARQUIVOS/$nome"
  trabalhando restaurar "$nome"
  if ! printf '%s' "$nome" | grep -Eq "$NOME_VALIDO" || [ ! -f "$arquivo" ]; then
    anotar restaurar erro "$nome" "Essa cópia não existe mais."
    descansando
    return 1
  fi
  if ! gzip -t "$arquivo" 2> /dev/null; then
    anotar restaurar erro "$nome" "O arquivo está danificado ou não é uma cópia (.sql.gz). Nada foi mudado."
    descansando
    return 1
  fi
  if ! motivo="$(gunzip -c "$arquivo" | awk -f "$CONFERIR")"; then
    anotar restaurar erro "$nome" "Este arquivo não é uma cópia de dados da plataforma ($motivo). Nada foi mudado."
    descansando
    return 1
  fi
  # A cópia diz de que versão da plataforma ela é. Uma cópia de uma versão mais nova do que a
  # instalada pode ter dados que esta versão ainda não sabe guardar.
  versao="$(gunzip -c "$arquivo" | head -n 12 | sed -n 's/^-- ultima-migracao: \([0-9A-Za-z_.-]*\)$/\1/p' | head -n 1)"
  if [ -n "$versao" ]; then
    conhecida="$(sql "select count(*) from controle.migracoes where nome = '$versao'" 2> /dev/null || echo "?")"
    if [ "$conhecida" = "0" ]; then
      anotar restaurar erro "$nome" "Esta cópia é de uma versão mais nova da plataforma. Atualize esta instalação e restaure de novo. Nada foi mudado."
      descansando
      return 1
    fi
  fi
  if ! copiar antes-de-restaurar; then
    anotar restaurar erro "$nome" "Não consegui guardar uma cópia do que existe agora, então não restaurei nada. $ERRO"
    descansando
    return 1
  fi
  antes="$FEITA"

  # As tabelas que a cópia traz são esvaziadas e recebem os dados dela. Uma tabela que a cópia não
  # traz (criada por uma versão mais nova da plataforma, com valores iniciais) fica como está.
  # Quem estiver usando a plataforma espera alguns segundos; se o banco não liberar as tabelas em
  # um minuto, nada é feito.
  tabelas="$(gunzip -c "$arquivo" | awk '
    dentro == 1 { if ($0 == "\\.") dentro = 0; next }
    /^COPY / { dentro = 1; lista = lista (lista == "" ? "" : ", ") $2 }
    END { print lista }
  ')"
  if {
    echo "SET lock_timeout = '60s';"
    echo "TRUNCATE TABLE $tabelas CASCADE;"
    gunzip -c "$arquivo"
  } | psql -X -q -v ON_ERROR_STOP=1 --single-transaction -f - > /dev/null 2> "$ESTADO/erro.txt"; then
    anotar copiar ok "$antes" "Cópia do que existia antes da restauração ($(tamanho "$ARQUIVOS/$antes"))."
    anotar restaurar ok "$nome" "Restauração pronta. Os dados de antes estão na cópia $antes."
    descansando
    return 0
  fi
  # Nada mudou: a cópia do "antes" é igual ao que está no banco e não precisa ficar.
  rm -f "$ARQUIVOS/$antes"
  anotar restaurar erro "$nome" "A restauração não foi feita e nada mudou. Motivo: $(grep -m 1 'ERROR\|ERRO\|FATAL' "$ESTADO/erro.txt" | sed 's/^psql:[^ ]*: //' | head -c 300)"
  descansando
  return 1
}

atender_pedidos() {
  for pedido in "$PEDIDOS"/*.pedido; do
    [ -f "$pedido" ] || continue
    acao="$(sed -n 's/^acao=//p' "$pedido" | head -n 1)"
    alvo="$(sed -n 's/^arquivo=//p' "$pedido" | head -n 1)"
    rm -f "$pedido"
    case "$acao" in
      copiar) fazer_copia manual ;;
      restaurar) restaurar "$alvo" ;;
      *) echo "pedido desconhecido ignorado: $acao" ;;
    esac
  done
}

ultima_falha_automatica=0
copia_do_dia() {
  [ "$(date +%H | sed 's/^0//')" -ge "$HORA_DA_COPIA" ] || return 0
  for existente in "$ARQUIVOS"/portuguesjp-"$(date +%Y-%m-%d)"-*-automatica.sql.gz; do
    [ -f "$existente" ] && return 0
  done
  [ $(($(agora) - ultima_falha_automatica)) -ge "$ESPERA_DEPOIS_DE_FALHA" ] || return 0
  # Banco ainda subindo, ou plataforma ainda sendo preparada: tenta de novo daqui a pouco.
  [ "$(sql "select to_regclass('controle.migracoes') is not null" 2> /dev/null)" = "t" ] || return 0
  if fazer_copia automatica; then
    find "$ARQUIVOS" -name 'portuguesjp-*-automatica.sql.gz' -mtime "+$MANTER_DIAS" -exec rm -f {} \;
  else
    ultima_falha_automatica="$(agora)"
  fi
}

# Restos de uma cópia interrompida (o serviço foi reiniciado no meio) não ficam ocupando espaço.
# Um envio pela administração parado há mais de um dia também não.
rm -f "$ARQUIVOS"/.parcial-* 2> /dev/null
find "$ARQUIVOS" -name '.enviando-*' -mmin +1440 -exec rm -f {} \;
descansando
# A administração mostra a hora da cópia automática e por quanto tempo ela fica guardada.
printf 'hora=%s\nmanter=%s\nfuso=%s\n' "$HORA_DA_COPIA" "$MANTER_DIAS" "$TZ" > "$ESTADO/config"
echo "Serviço de cópias no ar. Cópia automática todo dia a partir das ${HORA_DA_COPIA}h ($TZ), guardada por $MANTER_DIAS dias."

while true; do
  agora > "$ESTADO/vivo"
  atender_pedidos
  copia_do_dia
  sleep "$INTERVALO"
done
