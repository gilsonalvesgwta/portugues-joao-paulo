# Imagem que prepara o banco da plataforma: leva as migrações do repositório e o roteiro que
# as aplica. Sobe, faz o trabalho e termina. Nenhuma senha entra na imagem.
FROM postgres:15-alpine
COPY supabase/migrations /migracoes
COPY deploy/banco/aplicar.sh /aplicar.sh
USER postgres
ENTRYPOINT ["/bin/sh", "/aplicar.sh"]
