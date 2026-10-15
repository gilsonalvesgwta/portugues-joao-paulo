# Imagem do banco da plataforma, com dois trabalhos (o arquivo da stack escolhe qual):
# - preparo (aplicar.sh, o padrão): leva as migrações do repositório e as aplica. Sobe, faz o
#   trabalho e termina;
# - cópias de segurança (copias.sh): fica no ar, faz a cópia automática de cada dia e atende os
#   pedidos de cópia e de restauração feitos pela administração.
# Nenhuma senha entra na imagem.
FROM postgres:15-alpine
# Fuso horário, para a cópia automática sair na hora certa de Brasília.
RUN apk add --no-cache tzdata
COPY supabase/migrations /migracoes
COPY deploy/banco/aplicar.sh /aplicar.sh
COPY deploy/banco/copias.sh /copias.sh
COPY deploy/banco/conferir-copia.awk /conferir-copia.awk
# A pasta das cópias pertence ao mesmo usuário do aplicativo (1000), que também lê e grava nela.
# Um volume novo montado aqui nasce com esse dono.
RUN mkdir -p /copias && chown 1000:1000 /copias && chmod 700 /copias
USER postgres
ENTRYPOINT ["/bin/sh", "/aplicar.sh"]
