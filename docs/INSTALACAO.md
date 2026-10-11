# Instalação na VPS, passo a passo

Este roteiro instala a plataforma **Português com João Paulo** na VPS que já roda o Portainer, o Traefik e os
outros projetos. A plataforma entra como uma stack própria, com banco e login próprios, e **não encosta em nada
do que já está no ar**: todos os serviços dela têm nome começado por `portuguesjp_`, ela não abre nenhuma porta
e não usa o Supabase dos outros projetos.

Tempo estimado: 40 a 60 minutos na primeira vez.

## O que ter em mãos antes de começar

| O quê | Para quê |
| --- | --- |
| Acesso ao **Portainer** da VPS | Criar a stack |
| Acesso ao **Cloudflare** (domínio `wtatech.com.br`) | Criar o endereço `portuguescomjoaopaulo.wtatech.com.br` |
| Acesso ao **GitHub** com a conta dona do repositório | Só se as imagens deixarem de estar públicas (passo 1) |
| Uma **caixa de e-mail na Hostinger** só para a plataforma (endereço e senha) | Enviar o link de acesso e os avisos aos alunos |
| Um lugar seguro para guardar senhas (gerenciador de senhas) | As senhas criadas no passo 3 |

Depois da instalação, quando existirem: o **código do produto na Greenn** (passo 10) e, se quiser o tutor com
inteligência artificial, uma **chave da Anthropic** (passo 12).

> **Regra das senhas.** Senhas e chaves vão **só** nas variáveis da stack, dentro do Portainer. Nunca em
> conversa, e-mail, WhatsApp ou no repositório.

## Antes de instalar — uma cópia da VPS como ela está hoje

Dá para guardar a VPS inteira e voltar a esse ponto: é o **snapshot** do provedor da VPS. Ele copia o disco todo,
com todos os projetos, e a restauração devolve tudo exatamente como estava.

Na Hostinger ([como fazer backup ou restaurar um VPS](https://www.hostinger.com/br/support/1583232-como-fazer-backup-ou-restaurar-um-servidor-vps/)):

1. No hPanel, abra **VPS → Gerenciar → Backups e Monitoramento → Snapshots e Backups**.
2. Clique em criar snapshot e espere terminar (o andamento aparece em **Ações recentes**).
3. Só então comece o passo 1.

O que saber antes de contar com ele:

- Só existe um snapshot por vez: criar outro apaga o anterior. Ele é apagado sozinho depois de 20 dias.
- Restaurar troca o conteúdo inteiro da VPS pelo do snapshot. Tudo o que os outros projetos gravaram depois dele se
  perde, e não dá para desfazer.
- Em outro provedor (Hetzner, DigitalOcean, Contabo) o recurso tem o mesmo nome, snapshot, no painel da VPS.

Na prática o snapshot é a rede de segurança, não o caminho normal de volta. A instalação só acrescenta coisas:
cinco serviços e dois volumes com nome `portuguesjp_`, e um endereço novo no Traefik. Para desfazer só a plataforma,
sem tocar no resto:

1. No Portainer, **Stacks → portuguesjp → Delete this stack**.
2. Em **Volumes**, remova `portuguesjp_db_dados` e `portuguesjp_db_config`.
3. No Cloudflare, apague o registro `portuguescomjoaopaulo`.

Para não arriscar nada nos outros projetos, a alternativa é instalar em uma VPS nova: veja
[Instalar em uma VPS nova, zerada](#instalar-em-uma-vps-nova-zerada), no fim deste roteiro.

## Passo 1 — Conferir que as imagens estão públicas no GitHub

A VPS baixa duas imagens do GitHub: a do aplicativo e a do preparo do banco. Elas não têm nenhuma senha dentro
(isso é conferido a cada mudança).

**Hoje as duas já estão públicas**: a cada mudança no ramo principal, o fluxo de testes tenta baixá-las sem se
identificar e escreve o resultado no arquivo `10-imagem.txt` do ramo `ci-saida` ("o pacote está público"). Não há
nada a fazer neste passo, a não ser que alguém mude a visibilidade.

Se um dia aparecer "o pacote está privado" (ou, na instalação, um erro de `pull access denied`):

1. Entre em github.com com a conta **gilsonalvesgwta**.
2. Clique na foto, no canto de cima à direita, e em **Your profile**. Abra a aba **Packages**.
3. Abra o pacote **portugues-joao-paulo**. No lado direito, clique em **Package settings**.
4. No fim da página, em **Danger Zone**, clique em **Change visibility**, escolha **Public** e confirme
   escrevendo o nome do pacote.
5. Repita para o pacote **portugues-joao-paulo-banco**.

Para manter os pacotes privados, cadastre o registro no Portainer (**Registries → Add registry → Custom registry**,
endereço `ghcr.io`, usuário do GitHub e um token com permissão `read:packages`) antes do passo 4.

## Passo 2 — Criar o endereço no Cloudflare

1. No Cloudflare, abra o domínio `wtatech.com.br` e vá em **DNS → Records → Add record**.
2. Preencha: **Type** `A` · **Name** `portuguescomjoaopaulo` · **IPv4 address** o IP da VPS (o mesmo dos outros
   endereços dela, por exemplo o de `supabase-or`).
3. **Proxy status**: deixe igual ao dos outros endereços da VPS que já funcionam. Se estiver em dúvida, use
   **DNS only** (nuvem cinza): é o que deixa o Traefik emitir o certificado sem nenhum ajuste a mais.
4. Salve. Costuma valer em um ou dois minutos.

## Passo 3 — Criar as senhas da instalação

São quatro valores novos, **só com letras e números** (sem `@`, `#`, `/`, espaço ou acento, porque eles entram
em endereços internos).

| Variável | Tamanho | O que é |
| --- | --- | --- |
| `SENHA_DO_BANCO` | 30 ou mais | Senha do banco de dados da plataforma |
| `SEGREDO_JWT` | 40 ou mais | Segredo que assina as sessões e as chaves internas |
| `SEGREDO_DA_GREENN` | 24 ou mais | Parte do endereço que a Greenn chama. Quem conhece esse endereço consegue liberar acesso |
| `ADMIN_SENHA_INICIAL` | 8 ou mais | Senha do seu primeiro acesso (você troca depois, no passo 6) |

Um jeito simples de gerar, no terminal da VPS (cada comando devolve um valor novo):

```sh
openssl rand -hex 20   # 40 letras e números: serve para SENHA_DO_BANCO
openssl rand -hex 24   # 48: serve para SEGREDO_JWT
openssl rand -hex 16   # 32: serve para SEGREDO_DA_GREENN
```

Guarde os quatro no gerenciador de senhas.

> **Depois da primeira subida, não troque `SENHA_DO_BANCO` nem `SEGREDO_JWT`.** O banco é criado com eles; trocar
> só no Portainer faz o login e os dados pararem de conversar com o banco.

## Passo 4 — Criar a stack no Portainer

1. No Portainer, abra o ambiente da VPS e vá em **Stacks → Add stack**.
2. **Name**: `portuguesjp`.
3. **Build method**: **Web editor**. Cole o conteúdo inteiro do arquivo
   [`deploy/portainer-stack.yml`](https://raw.githubusercontent.com/gilsonalvesgwta/portugues-joao-paulo/main/deploy/portainer-stack.yml),
   sem mudar nada. (O arquivo não tem nenhuma senha: os valores entram no item seguinte.)
4. Em **Environment variables**, crie as variáveis abaixo (o modo **Advanced mode** deixa colar todas de uma vez,
   uma por linha, no formato `NOME=valor`):

| Variável | Valor |
| --- | --- |
| `DOMINIO` | `portuguescomjoaopaulo.wtatech.com.br` (sem `https://`) |
| `REDE_INTERNA` | o nome da rede interna da VPS, escrito igualzinho, com maiúsculas e minúsculas. Na VPS atual é `Wtatechor3Net`. Para conferir: no Portainer, menu **Networks**, é a rede de tipo `overlay` que não se chama `ingress` (a mesma que aparece nas outras stacks, em `networks:`) |
| `SENHA_DO_BANCO` | a do passo 3 |
| `SEGREDO_JWT` | o do passo 3 |
| `ADMIN_EMAIL` | o seu e-mail (será o primeiro administrador) |
| `ADMIN_SENHA_INICIAL` | a do passo 3 |
| `SMTP_USER` | o endereço completo da caixa da Hostinger (ex.: `aulas@seudominio.com`) |
| `SMTP_PASS` | a senha dessa caixa |
| `SMTP_PORT` | opcional: só se a porta 465 não conectar (passo 7). Pode ficar sem criar |
| `SEGREDO_DA_GREENN` | o do passo 3 (em branco, a plataforma não aceita avisos de compra) |
| `CHAVE_DA_ANTHROPIC` | opcional: só se for usar o Papo (passo 12). Pode ficar sem criar |

5. Clique em **Deploy the stack**.

A stack já vem com o padrão da VPS: entra na rede interna que você informou em `REDE_INTERNA`, deixa os serviços no
nó principal e, só no aplicativo, leva os rótulos do Traefik (`websecure`, certificado pelo `letsencryptresolver`).

Se o Portainer responder que a rede não foi encontrada (`network ... not found` ou `network ... is declared as
external, but could not be found`), o nome em `REDE_INTERNA` está diferente do nome da rede da VPS: corrija a
variável e clique em **Deploy the stack** de novo. Nada foi criado nessa tentativa.

## Passo 5 — Conferir que subiu

Em **Stacks → portuguesjp**, a lista de serviços deve ficar assim em dois a quatro minutos:

| Serviço | Deve mostrar | Observação |
| --- | --- | --- |
| `portuguesjp_db` | 1/1 | O banco. Na primeira vez leva cerca de um minuto para ficar pronto |
| `portuguesjp_auth` | 1/1 | O login. Reinicia sozinho algumas vezes enquanto o banco sobe: é esperado |
| `portuguesjp_rest` | 1/1 | Os dados. Também reinicia sozinho no começo |
| `portuguesjp_app` | 1/1 | O aplicativo |
| `portuguesjp_banco` | **0/1** | **É o normal.** Ele prepara o banco e termina |

Para ter certeza de que o banco foi preparado: clique em `portuguesjp_banco` → **Service logs**. A última linha
deve ser `BANCO PRONTO (13 migração(ões) aplicada(s) agora).` (o número cresce conforme a versão).

Depois abra `https://portuguescomjoaopaulo.wtatech.com.br`. Deve aparecer a tela de acesso, em espanhol, com o
cadeado do navegador fechado. O certificado pode levar um ou dois minutos na primeira vez.

## Passo 6 — Primeiro acesso e troca da senha

1. Na tela de acesso, entre com o `ADMIN_EMAIL` e a `ADMIN_SENHA_INICIAL`. Você cai no **Painel** da administração.
2. Troque a senha: abra `https://portuguescomjoaopaulo.wtatech.com.br/cuenta`, vá em **Cambiar contraseña** e
   escolha a senha definitiva.

A partir daí as variáveis `ADMIN_EMAIL` e `ADMIN_SENHA_INICIAL` não fazem mais nada: elas só valem enquanto não
existe nenhum administrador. Outros administradores e professores são criados em **Alunos → Novo administrador ou
professor**: a pessoa recebe por e-mail o link para criar a própria senha (o e-mail precisa estar funcionando,
passo 7).

## Passo 7 — Testar o envio de e-mail

No **Painel**, clique em **Enviar e-mail de teste**. O e-mail chega no endereço com que você entrou.

- Chegou (confira também o spam): o envio está certo.
- Não chegou: o quadro diz o motivo em palavras simples, ao lado do botão. Os mais comuns são a senha da caixa
  (`SMTP_PASS`) e o endereço (`SMTP_USER`, sempre o endereço completo). Corrija a variável na stack e clique em
  **Update the stack**.
- "Não consegui conectar ao servidor de e-mail": alguns provedores de VPS bloqueiam a saída pela porta 465. Crie
  na stack a variável `SMTP_PORT` com o valor `587` (a Hostinger aceita as duas) e clique em **Update the stack**.
  Se também não conectar, o provedor bloqueia o envio de e-mail e é preciso pedir a liberação a ele.
- O detalhe técnico de cada falha fica em **Service logs** do serviço `portuguesjp_app`, em uma linha que começa
  com `Falha no e-mail de teste`.

Para os e-mails não caírem no spam dos alunos, o domínio da caixa precisa dos registros **SPF** e **DKIM**. A
Hostinger mostra os dois no painel do e-mail; como o DNS fica no Cloudflare, é lá que eles são criados.

Os e-mails orientam o aluno a **responder àquela mensagem** quando tem problema de acesso ou quer trocar o e-mail
do cadastro. As respostas chegam nessa caixa: alguém precisa ler.

A caixa tem um limite de envios por dia, que depende do plano da Hostinger. A plataforma manda um e-mail a cada
aluno novo e de um a três por reserva de aula ao vivo (confirmação e lembretes): confira se o limite do plano cobre
o movimento que vocês esperam.

## Passo 8 — Cadastrar o conteúdo

Tudo em `/admin`, em português:

1. **Cursos e módulos**: crie o curso, depois os módulos. Na tela do curso também ficam os materiais do curso inteiro.
2. **Aulas**: título em português e em espanhol, link do vídeo no YouTube (não listado ou público, com incorporação
   permitida), anotações, materiais por link e quiz. A aula nasce como rascunho; o aluno só vê depois de **publicada**,
   em um curso **publicado**.
3. **Tarefas** e **Trilha por dia**: o que o aluno faz em cada dia. O dia 1 de cada aluno começa na matrícula dele.
4. **Conversação**: os temas e as turmas ao vivo, com o link da sala do Google Meet colado em cada turma.

O botão **Abrir a área do aluno**, no painel, mostra o curso do jeito que o aluno vê.

## Passo 9 — Testar como aluno

1. Em **Alunos → Novo aluno**, cadastre um e-mail seu (diferente do de administrador) e matricule no curso.
2. O e-mail de boas-vindas chega em espanhol, com o botão para criar a senha (o link vale 24 horas e uma vez só).
3. Crie a senha, entre e confira: a tela inicial, uma aula, o quiz, a conversação e «Mi cuenta».

## Passo 10 — Ligar a Greenn

1. Na plataforma, em **Pagamentos → Nova oferta**: o **código do produto na Greenn**, o curso, **365** dias de
   acesso, e se a compra inclui conversação (e quantas reservas por semana).
2. Na Greenn, no produto, cadastre um **webhook** para os eventos de **venda** (e de assinatura, se houver) com o
   endereço:

   `https://portuguescomjoaopaulo.wtatech.com.br/api/greenn/SEGREDO_DA_GREENN`

   No lugar de `SEGREDO_DA_GREENN` vai o valor criado no passo 3. Esse endereço completo é uma senha: não divulgue.
3. Faça uma **compra de teste** com um e-mail seu. Em menos de um minuto: o aviso aparece em **Pagamentos →
   Avisos recebidos da Greenn** (escolha "Todos") como "Processado", a pessoa aparece em **Alunos** e o e-mail de
   acesso chega.
4. Peça o **reembolso** dessa compra e confira que o acesso foi encerrado.

Se um aviso ficar **pendente**, a tela diz o motivo (o mais comum é o produto ainda não ter oferta cadastrada).
Depois de corrigir, use **Processar de novo**.

Se a Greenn só aceitar um endereço por produto e ele já estiver ocupado pelo n8n, faça o n8n **repassar o aviso
sem mexer no conteúdo** para o endereço acima.

## Passo 11 — Cópia de segurança todos os dias

No terminal da VPS, como root:

```sh
mkdir -p /root/portuguesjp && cd /root/portuguesjp
curl -fsSLO https://raw.githubusercontent.com/gilsonalvesgwta/portugues-joao-paulo/main/deploy/copia-de-seguranca.sh
curl -fsSLO https://raw.githubusercontent.com/gilsonalvesgwta/portugues-joao-paulo/main/deploy/restaurar-copia.sh
sh copia-de-seguranca.sh
```

O último comando faz a primeira cópia e termina com `CÓPIA PRONTA: ...`. As cópias ficam em
`/root/copias-portuguesjp`, uma por arquivo, e as com mais de 14 dias são apagadas.

Para repetir todo dia às 3h30, rode `crontab -e` e acrescente esta linha:

```
30 3 * * * sh /root/portuguesjp/copia-de-seguranca.sh >> /root/portuguesjp/copias.log 2>&1
```

Uma cópia que só existe na própria VPS se perde junto com ela. De tempos em tempos, baixe o arquivo mais recente
para outro lugar protegido (ele tem os dados dos alunos).

**Para restaurar** (troca todos os dados atuais pelos da cópia; a plataforma fica cerca de um minuto fora do ar):

```sh
sh /root/portuguesjp/restaurar-copia.sh /root/copias-portuguesjp/portuguesjp-AAAA-MM-DD-HHMMSS.sql.gz
```

O roteiro pede que você escreva `RESTAURAR` antes de mexer em qualquer coisa. Se algo falhar no meio, nada é trocado.

## Passo 12 — Ligar o Papo (opcional)

O Papo é o tutor com inteligência artificial: o aluno pratica por escrito e recebe as correções explicadas em
espanhol. Cada mensagem tem custo na conta da Anthropic.

1. Crie uma conta em `console.anthropic.com`, coloque crédito, defina um **limite de gasto mensal** e crie uma chave.
2. No Portainer, em **Stacks → portuguesjp → Editor**, crie a variável `CHAVE_DA_ANTHROPIC` com a chave e clique em
   **Update the stack**.
3. No **Painel**, o cartão do Papo passa a mostrar **Ligado**. Ali também se muda o limite de mensagens por pessoa,
   por dia (o padrão é 40).

Para desligar, apague o valor da variável e atualize a stack. O resto da plataforma não muda.

## Como atualizar a plataforma

Quando houver versão nova:

1. Faça uma cópia de segurança (`sh /root/portuguesjp/copia-de-seguranca.sh`).
2. No Portainer, em **Stacks → portuguesjp → Editor**, clique em **Update the stack** com a opção **Re-pull image
   and redeploy** ligada. (Se o arquivo da stack tiver mudado, cole a versão nova antes.)
3. O serviço `portuguesjp_banco` roda de novo e aplica sozinho as atualizações do banco. Confira no registro dele a
   linha `BANCO PRONTO`.

## Se algo não funcionar

| O que acontece | O que olhar |
| --- | --- |
| Serviço não sobe e o registro fala em `pull access denied` ou `No such image` | As imagens ficaram privadas: veja o passo 1 |
| O endereço não abre, ou abre sem cadeado | O registro no Cloudflare (passo 2) e se o domínio em `DOMINIO` está escrito igual. O certificado leva um ou dois minutos |
| "Bad Gateway" ou "404 page not found" do Traefik | O aplicativo ainda está subindo: espere um minuto e veja se `portuguesjp_app` está 1/1 |
| `portuguesjp_auth` ou `portuguesjp_rest` reiniciando por mais de cinco minutos | O registro de `portuguesjp_banco`: ele precisa terminar com `BANCO PRONTO`. Confira se `SENHA_DO_BANCO` tem só letras e números |
| Não consigo entrar como administrador | Se `ADMIN_EMAIL` e `ADMIN_SENHA_INICIAL` estavam preenchidos na primeira subida. A senha inicial precisa de 8 ou mais caracteres |
| O e-mail não chega | Passo 7 |
| Depois de 8 senhas erradas a tela pede para esperar | É a proteção contra tentativa de senha: 15 minutos para aquele e-mail. O link "Olvidé mi contraseña" continua funcionando |
| Uma tela da administração mostra "Algo deu errado" | Em **Stacks → portuguesjp → portuguesjp_app → Service logs** fica o motivo |

## O que não fazer

- **Não apague os volumes** `portuguesjp_db_dados` e `portuguesjp_db_config`: é neles que ficam todos os dados.
  Remover a stack não apaga os volumes; apagar os volumes apaga tudo.
- **Não troque** `SENHA_DO_BANCO` nem `SEGREDO_JWT` depois da primeira subida.
- **Não abra portas** nem ponha rótulos do Traefik no banco, no login ou nos dados: só o aplicativo é público.

## Instalar em uma VPS nova, zerada

Em uma VPS vazia são três etapas a mais antes dos 12 passos: contratar a máquina, apontar dois endereços para ela
e instalar o Traefik e o Portainer com o mesmo instalador da VPS atual
([SetupOrion](https://github.com/oriondesign2015/SetupOrion/blob/main/README.md)). Depois disso, a instalação da
plataforma é idêntica.

**A — Contratar a VPS.** Ubuntu 20.04 ou Debian 11, limpo, sem nada instalado (é o que o instalador pede). Pelo
menos 4 GB de memória e 2 vCPU, o mínimo do instalador; a plataforma sozinha usou cerca de 300 MB nos testes, com o
banco quase vazio. Anote o IP e a senha de root. As portas 80 e 443 precisam estar abertas no firewall do provedor.

**B — Criar dois endereços no Cloudflare**, do tipo `A`, apontando para o IP da VPS nova, com **DNS only**: um para
o Portainer (por exemplo `portainer-jp`) e o da plataforma (`portuguescomjoaopaulo`; se esse nome já aponta para a
VPS atual, troque o IP dele só quando a nova estiver pronta).

**C — Instalar o Traefik e o Portainer.** Na VPS, por SSH, como root:

```sh
bash <(curl -sSL setup.oriondesign.art.br)
```

No menu, escolha a **opção 1 (Traefik & Portainer)**: ela instala o Docker, o Docker Swarm, o Traefik e o Portainer.
Nas perguntas:

| Pergunta | O que responder |
| --- | --- |
| Nome do Servidor | Um nome qualquer, por exemplo `portuguesjp` |
| **Nome da Rede Interna** | Um nome sem espaços, por exemplo `WtatechNet`. **Anote como escreveu**, com maiúsculas e minúsculas: é o valor da variável `REDE_INTERNA` no passo 4 |
| E-mail para Certificado SSL | O seu e-mail |
| Domínio para o Portainer | O endereço criado na etapa B, por exemplo `portainer-jp.wtatech.com.br` |
| Usuário e senha para o Portainer | Novos, guardados no gerenciador de senhas |

Confirme com `Y` e espere terminar.

Esse instalador é de terceiros e é o que montou a VPS atual; ele não faz parte dos testes deste repositório. O que
os testes conferem é a stack da plataforma atrás de um Traefik montado do mesmo jeito (rede, entrada `websecure`,
certificado `letsencryptresolver`).

**D — Abrir o Portainer** no endereço da etapa B e entrar com o usuário e a senha da etapa C. O cadeado fechado
mostra que o Traefik e o certificado estão funcionando.

**E — Instalar a plataforma**: os 12 passos deste roteiro. No passo 2, o registro da plataforma aponta para o IP
da VPS nova. No passo 4, `DOMINIO` é o endereço que você criou na etapa B e `REDE_INTERNA` é o nome de rede da
etapa C. O arquivo da stack é colado como está, sem editar nada.

Se o instalador também colocou o **Supabase** nessa VPS, ele não é usado: a plataforma tem banco e login próprios,
dentro da stack `portuguesjp`. As duas stacks não se atrapalham (os nomes de serviço e os volumes são diferentes),
mas o Supabase ocupa memória à toa. Numa VPS só da plataforma, pode apagar a stack `supabase` no Portainer.

**F — Trazer os dados da VPS antiga**, só se a plataforma já estava em uso lá: é a seção abaixo.

## Mudar para uma VPS só da plataforma, mais tarde

1. Na VPS atual, faça uma cópia de segurança e baixe o arquivo.
2. Na VPS nova, repita este roteiro (pode usar `SENHA_DO_BANCO` e `SEGREDO_JWT` novos) e espere tudo subir.
3. Envie o arquivo da cópia para a VPS nova e rode o `restaurar-copia.sh`. Contas, senhas, matrículas e progresso
   voltam como estavam; os alunos só precisam entrar de novo.
4. Aponte o endereço no Cloudflare para a VPS nova e atualize o webhook na Greenn se o endereço mudar.
