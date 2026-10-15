# Confere, linha por linha, que um arquivo de cópia só tem o que uma cópia de dados da plataforma
# tem: ajustes da sessão, as listas de linhas de cada tabela (COPY ... FROM stdin) e o acerto dos
# contadores. Qualquer outra coisa (um comando que apaga tabela, roda programa ou muda permissão)
# reprova o arquivo inteiro, e nada é restaurado. Só as tabelas da plataforma (public) e das contas
# (auth) podem receber linhas.
#
#   gunzip -c arquivo.sql.gz | awk -f conferir-copia.awk
#
# Termina com 0 quando o arquivo passa; senão escreve o motivo e termina com 1.

BEGIN { dentro = 0; reprovado = 0; listas = 0; completa = 0 }

# Dentro de uma lista de linhas, tudo é dado até a linha "\.": o banco não executa nada dali.
dentro == 1 {
  if ($0 == "\\.") dentro = 0
  next
}

/^-- PostgreSQL database dump complete$/ { completa = 1; next }
/^$/ || /^--/ { next }
/^SET [a-z_]+ = [A-Za-z0-9_']+;$/ { next }
/^SET SESSION AUTHORIZATION (DEFAULT|'?[A-Za-z0-9_]+'?);$/ { next }
/^SELECT pg_catalog\.set_config\('search_path', '', false\);$/ { next }
/^ALTER TABLE (ONLY )?(public|auth)\.[A-Za-z0-9_"]+ (DISABLE|ENABLE) TRIGGER ALL;$/ { next }
/^SELECT pg_catalog\.setval\('(public|auth)\.[A-Za-z0-9_"]+', [0-9]+, (true|false)\);$/ { next }
/^\\(un)?restrict [A-Za-z0-9]+$/ { next }
/^COPY (public|auth)\.[A-Za-z0-9_"]+ \([A-Za-z0-9_", ]*\) FROM stdin;$/ { dentro = 1; listas++; next }

{
  printf "linha %d não é de uma cópia de dados da plataforma: %s\n", NR, substr($0, 1, 60)
  reprovado = 1
  exit 1
}

END {
  if (reprovado) exit 1
  if (dentro) { print "o arquivo termina no meio de uma tabela"; exit 1 }
  if (!completa) { print "o arquivo está incompleto"; exit 1 }
  if (listas == 0) { print "o arquivo não tem dados"; exit 1 }
}
