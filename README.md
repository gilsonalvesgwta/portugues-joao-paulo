# Português com João Paulo — plataforma

Plataforma de português do Brasil para quem fala espanhol. Este repositório guarda o código;
o plano completo está no documento "Plano mestre — Plataforma Português com João Paulo".

## O que já existe

| Pasta | Conteúdo | Situação |
| --- | --- | --- |
| `supabase/migrations/` | Banco de dados: 29 tabelas, regras de acesso por linha, reserva de turmas, eventos de pagamento | Testado em Postgres 16 local e no Supabase local |
| `supabase/tests/` | Testes do banco: 63 verificações de regra e 2 testes de disputa simultânea | Passando |
| `src/lib/` | Regras do aplicativo sem dependências: eventos da Greenn, quizzes, trilha por dia, agenda por fuso, e-mails em espanhol, validação do conteúdo | 60 testes passando |
| `src/app/`, `src/components/` | Aplicativo Next.js 16 com Tailwind 4. Acesso em espanhol: login, primeiro acesso e nova senha por link de uso único. Áreas internas protegidas por papel (aluno, professor, administrador) | Acesso funcionando; `/inicio` ainda é tela de espera |
| `src/app/admin/` | Administração em português: painel, cursos, módulos, aulas (rascunho e publicação) e lixeira | Funcionando. Faltam anotações, envio de vídeo, materiais, quizzes, tarefas e trilha |
| `e2e/` | Testes de ponta a ponta do acesso e da administração, com navegador de verdade e Supabase local | 24 testes passando |
| `.github/workflows/` | Testes automáticos no GitHub: lógica, banco, instalação, compilação, tipos, fotos das telas e acesso de ponta a ponta | Passando |

## Como rodar o aplicativo

Precisa do Node 22.18 ou mais novo.

```bash
npm ci
npm run dev        # abre em http://localhost:3000
npm test           # testes da lógica (não precisam de pacotes)
npm run typecheck
npm run build && npm start
npm run capturas   # fotografa as telas; exige o aplicativo no ar e `npx playwright install chromium`
```

Para o login funcionar, copie `.env.example` para `.env.local` e preencha. Com Docker instalado, um
Supabase local sobe com `npm run supabase:subir`; o endereço e as chaves saem em `npx supabase status`.
Depois, com o aplicativo no ar, `npm run e2e` roda os testes de ponta a ponta.

## Como o aluno entra

1. A conta nasce sem senha (pela compra, na fase de pagamento, ou criada pela administração). Ninguém se
   cadastra sozinho.
2. Em `/primer-acceso` (ou `/recuperar`), a pessoa informa o e-mail. A tela responde o mesmo exista ou não a
   conta. No máximo 3 links por e-mail a cada 10 minutos.
3. O link do e-mail abre uma tela com um botão. Só o clique gasta o link, que vale uma vez.
4. A pessoa escolhe a senha e entra: aluno em `/inicio`, professor e administrador em `/admin`.

## Como o professor organiza o conteúdo

Em `/admin`, o curso é dividido em módulos e cada módulo reúne aulas.

- A aula nasce como rascunho e só aparece para o aluno depois de publicada, em um curso também publicado.
- Aula não é publicada sem vídeo, e o número da aula não se repete dentro do curso.
- "Apagar" é mover para a lixeira: o item some para o aluno, pode ser restaurado e volta como rascunho.
  Curso só vai para a lixeira sem módulos; módulo, só sem aulas.

## Saída dos testes no GitHub

A cada envio, o GitHub publica no ramo `ci-saida` o fim de cada registro, o relatório de segurança dos
pacotes e as fotos das telas em tamanho de computador e de celular (pasta `capturas`). O ramo é
sobrescrito a cada execução.

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

- O envio de e-mail de verdade ainda não existe: falta escolher o serviço (Resend ou Amazon SES). Com
  `EMAIL_DRIVER=arquivo`, os e-mails são gravados na pasta `EMAIL_PASTA`, o que serve aos testes. Com qualquer
  outro valor o aplicativo recusa enviar, para um e-mail nunca se perder em silêncio.

- As funções `registrar_evento_pagamento` e `aplicar_evento_pagamento` seguem a documentação pública do
  webhook da Greenn. Os campos serão conferidos com eventos reais (compra-teste nacional e internacional)
  antes de ir para produção.
- A tabela `perguntas` não tem regra de leitura para o aluno porque guarda o gabarito. O servidor entrega as
  perguntas sem a resposta e faz a correção.
