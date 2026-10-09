# Português com João Paulo — plataforma

Plataforma de português do Brasil para quem fala espanhol. Este repositório guarda o código;
o plano completo está no documento "Plano mestre — Plataforma Português com João Paulo".

## O que já existe

| Pasta | Conteúdo | Situação |
| --- | --- | --- |
| `supabase/migrations/` | Banco de dados: 29 tabelas, regras de acesso por linha, reserva de turmas, eventos de pagamento | Testado em Postgres 16 local |
| `supabase/tests/` | Testes do banco: 63 verificações de regra e 2 testes de disputa simultânea | Passando |
| `src/lib/` | Regras do aplicativo sem dependências: eventos da Greenn, quizzes, trilha por dia, agenda por fuso, e-mails em espanhol | 43 testes passando |

As telas do aplicativo (Next.js) ainda não foram iniciadas. O que está em `src/lib/` é a lógica que elas vão usar.

## Como rodar os testes da lógica

Precisa só do Node 22.18 ou mais novo; não há pacotes para instalar.

```bash
npm test          # node --test "src/**/*.test.ts"
npm run typecheck # exige o TypeScript 5.8+ instalado
```

## Como rodar os testes do banco

Precisa de um Postgres 16 local e do `psql`. O script recria o banco `jp_teste` do zero.

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres ./supabase/tests/rodar.sh
```

Nunca aponte o script para o banco de produção: `00_ambiente_local.sql` recria papéis e o esquema `auth`
que o Supabase já tem, e `01_dados_de_teste.sql` insere pessoas e turmas fictícias.

## Como aplicar no Supabase

Aplique só os arquivos de `supabase/migrations/`, em ordem. Eles usam `auth.users`, `auth.uid()` e os papéis
`anon`, `authenticated` e `service_role`, que o Supabase já cria.

## Pontos provisórios

- As funções `registrar_evento_pagamento` e `aplicar_evento_pagamento` seguem a documentação pública do
  webhook da Greenn. Os campos serão conferidos com eventos reais (compra-teste nacional e internacional)
  antes de ir para produção.
- A tabela `perguntas` não tem regra de leitura para o aluno porque guarda o gabarito. O servidor entrega as
  perguntas sem a resposta e faz a correção.
