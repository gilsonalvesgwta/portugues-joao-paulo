# Português com João Paulo — plataforma

Plataforma de português do Brasil para quem fala espanhol. Este repositório guarda o código;
o plano completo está no documento "Plano mestre — Plataforma Português com João Paulo".

- **Instalar na VPS**: [`docs/INSTALACAO.md`](docs/INSTALACAO.md)
- **O que foi revisado e testado**: [`docs/REVISAO.md`](docs/REVISAO.md)

## O que já existe

| Pasta | Conteúdo | Situação |
| --- | --- | --- |
| `supabase/migrations/` | Banco de dados: 29 tabelas, regras de acesso por linha, reserva de turmas, eventos de pagamento | Testado em Postgres 16 local e no Supabase local |
| `supabase/tests/` | Testes do banco: 235 verificações de regra e 2 testes de disputa simultânea | Passando |
| `src/lib/` | Regras do aplicativo sem dependências: eventos da Greenn, quizzes, trilha por dia, agenda por fuso, e-mails em espanhol, validação do conteúdo, link do YouTube, configuração do e-mail e do banco, anotações da aula, editor de quiz, trilha por dia, cadastro e matrícula de alunos, ofertas, área do aluno, correção do quiz, conversação, reservas do aluno, limite de tentativas de senha e o Papo | 193 testes passando |
| `src/app/`, `src/components/` | Aplicativo Next.js 16 com Tailwind 4. Acesso em espanhol: login, primeiro acesso e nova senha por link de uso único. Áreas internas protegidas por papel (aluno, professor, administrador) | Funcionando. Área do aluno em espanhol: início com o dia de hoje, aula (vídeo, anotações, materiais, tarefas), quiz corrigido pelo servidor, conversação (agenda no fuso do aluno, reservar, cancelar, avaliar), Papo (tutor com IA) e «Mi cuenta» |
| `src/app/admin/` | Administração em português: painel, cursos, módulos, aulas (rascunho e publicação), anotações da aula em blocos com prévia do aluno, materiais de apoio por link, quiz da aula (perguntas de texto), tarefas, trilha por dia, lixeira, alunos (cadastro, matrícula, bloqueio, validade, papel) pagamentos (ofertas e avisos da Greenn) e conversação (temas, turmas, inscritos, presença) | Funcionando |
| `e2e/` | Testes de ponta a ponta do acesso, da administração e do envio de e-mail, com navegador de verdade, contra o Supabase local e contra a stack da VPS | 174 testes: 173 passando no Supabase local (com o Papo ligado, falando com um serviço de imitação) e 165 na stack (com o Papo desligado, como fica sem a chave). Parte deles roda de novo com a stack atrás de um Traefik, por https |
| `.github/workflows/` | Testes automáticos no GitHub: lógica, banco, instalação, compilação, tipos, fotos das telas, acesso de ponta a ponta e a imagem da VPS (construída, testada com login e publicada) | Passando |
| `Dockerfile`, `deploy/` | Imagens do aplicativo e do preparo do banco, e a stack do Portainer (Swarm + Traefik) com banco e login próprios | Stack testada em Swarm no GitHub; instalação na VPS ainda não feita |

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

1. A conta nasce sem senha, de dois jeitos: pela compra na Greenn (automático) ou pelo cadastro feito pelo
   administrador em `/admin/alunos`. Ninguém se cadastra sozinho.
2. Em `/primer-acceso` (ou `/recuperar`), a pessoa informa o e-mail. A tela responde o mesmo exista ou não a
   conta. No máximo 3 links por e-mail a cada 10 minutos.
3. O link do e-mail abre uma tela com um botão. Só o clique gasta o link, que vale uma vez e por 24 horas.
4. A pessoa escolhe a senha e entra: aluno em `/inicio`, professor e administrador em `/admin`.
5. Depois de 8 senhas erradas seguidas para o mesmo e-mail, aquele e-mail espera 15 minutos (nem a senha certa
   entra nesse tempo). Criar uma senha nova pelo link do e-mail continua funcionando.

## O que o aluno vê

Depois de entrar, o aluno cai em `/inicio` (em espanhol):

- **O curso**: quantas aulas já viu e o botão "Continuar", que leva à aula ou ao quiz que falta hoje.
- **Hoy**: os itens do dia da trilha. A aula conta como feita quando é vista, o quiz quando é respondido (mesmo
  sem acertar) e a tarefa quando o aluno marca. O dia vira quando os itens obrigatórios estão feitos. Itens que
  o aluno não pode ver (aula ou quiz em rascunho) somem da trilha dele e não travam o dia.
- **Todas as aulas**, por módulo. Em curso "em sequência", o que está em um dia depois de hoje fica fechado, na
  tela e pelo endereço; em curso "livre", tudo abre.
- **Aula** (`/clase/...`): vídeo do YouTube, botão "Marcar como vista", quiz, tarefas, materiais e anotações.
  Enquanto o aluno assiste, a página guarda onde ele parou (o vídeo retoma dali) e marca a aula como vista
  quando o vídeo passa de 90%.
- **Quiz** (`/quiz/...`): o servidor entrega as perguntas sem a resposta e com as opções embaralhadas, corrige,
  grava a tentativa e mostra o que estava certo. O aluno pode repetir; vale a melhor nota.
- A equipe abre as mesmas telas para ver o curso como o aluno ("Abrir a área do aluno", no painel): tudo aberto,
  sem rascunhos, e nada do que faz fica gravado.

## Como o professor organiza o conteúdo

Em `/admin`, o curso é dividido em módulos e cada módulo reúne aulas.

- A aula nasce como rascunho e só aparece para o aluno depois de publicada, em um curso também publicado.
- O vídeo fica no YouTube: o professor cola o link na aula. O vídeo precisa estar como Não listado ou Público,
  com a incorporação permitida. Quem tem o link de um vídeo não listado consegue abrir direto no YouTube.
- Aula não é publicada sem vídeo, e o número da aula não se repete dentro do curso.
- **Materiais de apoio** são links (Google Drive ou parecido). Os de uma aula ficam na tela da aula; os do curso
  inteiro (um guia de estudo, por exemplo) ficam na tela do curso, e o aluno os vê na tela inicial.
- Os materiais de apoio (PDFs e afins) ficam fora da plataforma, no Google Drive ou parecido: o professor
  cadastra o título e o link na tela da aula. Só link `https://` é aceito, na tela e no banco.
- A trilha por dia diz o que o aluno faz em cada dia, a contar da matrícula dele: aulas, quizzes e tarefas,
  cada um obrigatório ou opcional. O editor monta sozinho um dia por aula (com o quiz e as tarefas dela) e o
  professor ajusta. É gravada de uma vez dentro do banco (função `salvar_trilha`), e os itens que já existiam são
  movidos, não recriados: o que o aluno já marcou como feito continua valendo. Aula e tarefa que estão na trilha
  não vão para a lixeira.
- As tarefas (o que o aluno faz além do vídeo e do quiz) pertencem a um curso e podem ser ligadas a uma aula.
  Têm título e instrução em espanhol e um link opcional, só `https://`. Vão para a lixeira e podem ser restauradas.
- O quiz da aula tem, por enquanto, três tipos de pergunta: múltipla escolha, completar a frase e ordenar a
  frase. É gravado de uma vez dentro do banco (função `salvar_quiz`): ou entra inteiro, ou nada muda. O aluno
  nunca lê a tabela de perguntas, que guarda o gabarito. Não há perguntas com áudio nesta primeira versão.
- As anotações da aula (o resumo que o aluno lê junto com o vídeo) são montadas em blocos: capa, seção numerada,
  texto, pares de exemplo, cartões de termo, certo e errado, nota do professor, vocabulário e tabela-resumo.
  O texto do professor é sempre texto: nunca vira HTML. O único destaque é `**negrito**`.
- "Apagar" é mover para a lixeira: o item some para o aluno, pode ser restaurado e volta como rascunho.
  Curso só vai para a lixeira sem módulos; módulo, só sem aulas.

## Aulas de conversação ao vivo (equipe)

Em `/admin/conversacao`, para o professor e o administrador:

- **Tema**: o assunto da aula (título, nível, descrição, o que o aluno vai aprender e um material por link).
  Tema com turma marcada não é arquivado.
- **Turma**: tema, data e hora (no horário de Brasília; a tela mostra como fica em Madri, Buenos Aires, Bogotá
  e Cidade do México), duração, vagas e o **link da sala**, que o professor cria no Google Meet e cola. Sem link
  a turma não é criada, porque ele vai no e-mail de quem reserva.
- O link da sala não é lido na tabela de turmas: o aluno só o recebe nas reservas dele.
- Com gente inscrita, o tema, a data e a hora não mudam mais; para mudar o horário, cancela-se a turma.
- **Cancelar a turma** cancela as reservas (o crédito da semana volta) e avisa cada inscrito por e-mail.
- **Inscritos**: quem reservou, a presença (marcada a partir do início da aula) e a avaliação que cada um deu.
- **Regras de reserva** (só o administrador): quantos dias de agenda o aluno vê, até quando reserva e até
  quando cancela. Quantas aulas cada aluno reserva por semana vem da matrícula.

## Aulas de conversação ao vivo (aluno)

Em `/conversacion`, em espanhol, para quem tem conversação na matrícula:

- A **agenda** dos próximos dias aparece no fuso do aluno, por dia e por período (mañana, tarde, noche), com o
  tema, o nível, as vagas que restam e o que ele vai aprender. Dá para filtrar por nível.
- **Reservar** é um toque. O banco confere, de uma vez só, vaga, limite da semana (segunda a domingo, no fuso
  do aluno), prazo e janela; a última vaga nunca vai para dois alunos.
- Reserva feita: o **link da sala** aparece em «Mis reservas» e vai por e-mail, com o material da aula.
- **Cancelar** dentro do prazo devolve a reserva à semana e a vaga à turma, e sai um e-mail de confirmação.
- Depois da aula, o aluno **avalia** de 1 a 5, com comentário opcional; o professor vê na turma.
- Se o aparelho está em outro fuso, a tela oferece trocar. Em `/cuenta` («Mi cuenta») o aluno muda o nome, o
  fuso e a senha. O e-mail e o papel não mudam por ali.
- A equipe abre a mesma tela como prévia, sem reservar e sem o link.

**Lembretes por e-mail.** O servidor confere a cada 5 minutos (`LEMBRETES_INTERVALO_SEG`; 0 desliga) e manda um
lembrete **24 horas antes** e outro **1 hora antes**, com o link da sala e a hora no fuso do aluno. Cada lembrete
sai uma vez só por reserva; quem reservou em cima da hora não recebe (acabou de receber a confirmação); reserva
ou turma cancelada não recebe. Se o envio falhar, o servidor tenta de novo depois de 10 minutos, até 5 vezes.

## Papo, o tutor com inteligência artificial

Em `/papo`, o aluno com curso ativo pratica português por escrito. O tutor explica em espanhol (o
idioma do aluno) e dá as palavras, as frases corrigidas e os exemplos em português.

- **Opcional.** Só existe quando a instalação tem a chave de API da OpenAI (`OPENAI_API_KEY`; na stack,
  `CHAVE_DA_OPENAI`) ou, no lugar dela, a da Anthropic (`ANTHROPIC_API_KEY`; na stack, `CHAVE_DA_ANTHROPIC`). Com
  as duas, vale a da OpenAI. Sem chave, o link some do menu e a tela avisa que o tutor não está disponível.
- O servidor fala com o serviço; a chave nunca vai para o navegador. Para o modelo vão as instruções do
  tutor, o nome do aluno (como forma de tratamento) e as últimas mensagens da conversa.
  O e-mail e os demais dados do aluno não vão.
- **Limite por dia** (40 mensagens por pessoa, contadas no fuso do aluno; o administrador muda no painel, de 0
  a 500). Duas mensagens ao mesmo tempo não furam o limite. Se o tutor não responde, a mensagem não é contada.
- O aluno lê só as próprias conversas e não grava nada direto no banco; quem grava é o servidor.
- A resposta do tutor é sempre mostrada como texto, nunca como HTML.
- "Empezar una conversación nueva" guarda a anterior e faz o tutor esquecer o que foi dito.
- O modelo padrão é `gpt-6-luna` na OpenAI e `claude-haiku-4-5-20251001` na Anthropic (`PAPO_MODELO` troca). Cada
  mensagem tem custo na conta do serviço; o painel mostra quantas foram enviadas nos últimos 7 dias.
- O painel tem o botão **Testar o Papo**: manda uma mensagem curta ao serviço, sem contar no limite de ninguém, e
  diz em palavras simples por que falhou (chave recusada, conta sem crédito, modelo desconhecido, serviço fora do ar).
- Nos testes, a OpenAI é imitada por um servidor do próprio teste: nenhum pedido sai para fora.

## Como o administrador cuida dos alunos

Em `/admin/alunos`, que só o administrador abre (o professor cuida do conteúdo e não vê alunos nem matrículas):

- **Novo aluno**: nome e e-mail. A conta nasce sem senha; a pessoa recebe um e-mail em espanhol com o link para
  criar a senha. No mesmo passo dá para matricular em um curso.
- **Matrícula**: uma por pessoa e por curso. Tem validade opcional ("Acesso até", que vale até o fim daquele dia
  no horário de Brasília), aulas de conversação incluídas ou não, e reservas por semana. O primeiro dia da trilha
  conta a partir da matrícula.
- **Bloquear e liberar o acesso** não mexe na validade. Matrícula ativa com a validade vencida não dá acesso.
- **Cadastro**: corrigir o nome e trocar o e-mail (a pessoa passa a entrar com o e-mail novo, com a mesma senha).
- **Papel**: aluno, professor ou administrador. Ninguém muda o próprio papel, então sempre sobra um administrador.
- **Link de acesso**: reenvia o e-mail para criar ou trocar a senha, no máximo 3 por endereço a cada 10 minutos.
  A ficha mostra a última entrada da pessoa e os últimos envios.
- Toda mudança em matrícula, papel e e-mail fica gravada em `registro_alteracoes`, com quem fez.
- **Apagar a conta** (quando a pessoa pede para sair de vez): só de aluno, e só com o e-mail da pessoa escrito
  para confirmar. Somem o login, o cadastro, as matrículas, o progresso, as reservas e as avaliações. Os avisos de
  compra ficam, sem o nome e o e-mail. Não tem volta; para só tirar o acesso, o caminho é bloquear a matrícula.

## Como a compra na Greenn vira matrícula

A Greenn chama `https://DOMINIO/api/greenn/SEGREDO` a cada mudança de uma venda ou de uma assinatura. O segredo
(variável `GREENN_WEBHOOK_SEGREDO`, 24 letras e números ou mais) faz parte do endereço; sem ele, a resposta é a
de uma página que não existe.

- **Oferta**: em `/admin/pagamentos`, o administrador liga o código do produto na Greenn ao curso, com os dias
  de acesso (em branco, sem prazo) e a conversação.
- **Venda paga**: cria a conta (se não existir), faz a matrícula e manda o e-mail. Quem nunca entrou recebe o link
  para criar a senha; quem já tem senha recebe só o aviso com o botão de entrar.
- **Comprar de novo** com o acesso em dia soma os dias; a compra nunca encurta um acesso sem prazo.
- **Reembolso ou estorno**: encerra o acesso na hora.
- **Assinatura**: cada cobrança paga estende o acesso até o fim do período pago. Cancelada ou sem pagamento, o
  acesso vai até o fim do período já pago.
- **Aviso repetido** não é aplicado duas vezes. **Carrinho abandonado** não é guardado.
- **Produto sem oferta** (ou com a oferta desativada): o aviso fica pendente, sem criar conta. Depois de cadastrar
  a oferta, o administrador manda processar de novo; ou dispensa o aviso.
- Do aviso da Greenn, são descartados antes de guardar: documento, endereço e telefone do comprador, dados de
  boleto e Pix e os rastros de anúncio da venda.
- Tipo de aviso que a plataforma não usa (reclamação aberta, por exemplo) fica guardado, sem pedir atenção.

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

## Instalação na VPS

A plataforma roda na VPS com banco e login próprios, separados de qualquer outro projeto. São cinco serviços,
todos com nome começado por `portuguesjp_`:

| Serviço | O que faz | Memória medida no teste |
| --- | --- | --- |
| `portuguesjp_app` | O aplicativo (área do aluno e administração). É o único alcançado pelo Traefik | cerca de 105 MB |
| `portuguesjp_db` | Banco de dados (mesma imagem do Supabase) | cerca de 145 MB |
| `portuguesjp_auth` | Login: contas, senhas e sessões | cerca de 21 MB |
| `portuguesjp_rest` | Leitura e gravação das tabelas, com as regras de acesso do banco | cerca de 29 MB |
| `portuguesjp_banco` | Prepara o banco e aplica as atualizações. Sobe, faz o trabalho e termina (aparece como 0/1) | — |

A memória foi medida com o banco quase vazio, logo depois dos testes; com alunos de verdade o banco usa mais.

- `deploy/portainer-stack.yml` é a stack para o Portainer (Docker Swarm + Traefik). Não abre porta nenhuma, e
  as senhas entram pelas variáveis da stack, nunca pelo arquivo.
- O GitHub publica as duas imagens a cada mudança no ramo principal: `ghcr.io/gilsonalvesgwta/portugues-joao-paulo`
  e `ghcr.io/gilsonalvesgwta/portugues-joao-paulo-banco`. Nenhuma leva chave dentro.
- O aplicativo assina as próprias chaves de acesso ao banco a partir de `SUPABASE_JWT_SECRET`, e cria o primeiro
  administrador a partir de `ADMIN_EMAIL` e `ADMIN_SENHA_INICIAL` (só enquanto não existir nenhum).
- A cada mudança, o GitHub sobe esse mesmo arquivo em Docker Swarm e roda todos os testes de ponta a ponta
  contra ele; depois põe um Traefik na frente, montado como o da VPS (`deploy/teste-traefik.yml`), e repete por
  https os testes de acesso e a jornada da aluna. Ficam para a instalação de verdade: o certificado do Let's
  Encrypt e a caixa de e-mail.

### Cópia de segurança

Dois roteiros, para rodar na VPS como root:

- `sh deploy/copia-de-seguranca.sh [pasta]` grava os dados da plataforma (tabelas, contas e senhas) em um arquivo
  `.sql.gz` com data e hora, sem tirar nada do ar. Guarda 14 dias (`MANTER_DIAS`). A pasta padrão é
  `/root/copias-portuguesjp`. O arquivo tem dados dos alunos: vale guardar também fora da VPS.
- `sh deploy/restaurar-copia.sh <arquivo>` troca todos os dados atuais pelos da cópia (pede confirmação). Para a
  plataforma por cerca de um minuto; se falhar no meio, nada muda. A cópia entra em uma plataforma já instalada,
  na mesma versão ou em uma mais nova.

A cada mudança, o GitHub roda os dois na stack de teste: copia, estraga o banco de propósito, restaura, confere
as contagens e refaz os testes de login, de conteúdo e da área do aluno.

O passo a passo está em [`docs/INSTALACAO.md`](docs/INSTALACAO.md), e o resumo do que foi revisado e testado em
[`docs/REVISAO.md`](docs/REVISAO.md).

## Proteções do aplicativo

- A sessão fica em cookie `httpOnly` (os programas da página não leem) e, em https, `secure`.
- Toda resposta leva cabeçalhos de segurança (`next.config.mjs`): a plataforma não abre dentro de outra página,
  formulários só enviam para ela mesma e os únicos quadros de fora são os do YouTube.
- 8 senhas erradas seguidas para o mesmo e-mail: espera de 15 minutos (`src/lib/tentativas.ts`).
- Endereço que não existe e tela que falha têm páginas próprias, sem detalhe técnico.

## Pontos provisórios

- O envio de e-mail por SMTP (`EMAIL_DRIVER=smtp`) foi testado contra uma caixa de teste, sem senha e sem
  cifra. Usuário, senha e cifra da caixa de verdade (Hostinger) só são conferidos na instalação, pelo botão
  "Enviar e-mail de teste" do painel. Com `EMAIL_DRIVER=arquivo`, os e-mails são gravados em `EMAIL_PASTA`.
- O recebimento dos avisos da Greenn foi conferido com um aviso de venda de verdade (outubro de 2026): o formato
  bate com o que a plataforma lê. Continua testado só com avisos simulados. A Greenn manda também um cabeçalho
  `x-webhook-token`, que a plataforma ainda não confere (a proteção é o segredo do endereço). Antes de vender,
  falta uma compra de teste do próprio produto, o reembolso dela, e saber como a Greenn se comporta quando a
  plataforma responde com erro.
- No Supabase, toda função e toda tabela nova do esquema `public` nasce liberada para quem está logado. As
  migrações fecham tudo e liberam só o que as telas usam; os testes do banco conferem a lista (seção "Nada fica
  liberado por esquecimento"). Ao criar função nova em uma migração: tirar a permissão de `public` e `anon` e
  liberar pelo nome só se a tela precisar.
- A tabela `perguntas` não tem regra de leitura para o aluno porque guarda o gabarito. O servidor entrega as
  perguntas sem a resposta e faz a correção.
- O registro do vídeo (onde o aluno parou e a marca de aula vista) conversa com o reprodutor pela ferramenta
  oficial do YouTube. Nos testes ela é imitada, porque o YouTube não é chamado: o caminho inteiro foi exercitado,
  menos o YouTube de verdade. Se a ferramenta não carregar, o vídeo toca do mesmo jeito e o aluno marca a aula
  no botão.
