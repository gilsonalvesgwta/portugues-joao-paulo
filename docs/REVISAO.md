# Revisão e testes: o que foi conferido

Situação em 11 de outubro de 2026. Este documento resume o que a plataforma faz, como cada parte foi testada e
o que só pode ser conferido na instalação de verdade.

## O que está pronto

| Parte | O que faz |
| --- | --- |
| Acesso | Login por e-mail e senha, primeiro acesso e troca de senha por link de uso único (24 horas). Ninguém se cadastra sozinho |
| Área do aluno (espanhol) | Tela inicial com o dia de hoje, aulas com vídeo do YouTube, anotações, materiais, tarefas, quiz corrigido pelo servidor, conversação em grupo, Papo e «Mi cuenta» |
| Administração (português) | Cursos, módulos, aulas, anotações em blocos, materiais por link (da aula e do curso), quiz, tarefas, trilha por dia, lixeira, conversação (temas, turmas, presença), alunos, pagamentos e painel |
| Matrícula | Automática pela Greenn (compra, reembolso, assinatura) e manual pelo administrador, com validade e bloqueio |
| Conversação ao vivo | Agenda no fuso do aluno, reserva com limite por semana, cancelamento com prazo, avaliação, e-mails de confirmação, de cancelamento e lembretes de 24 horas e de 1 hora |
| Papo (opcional) | Tutor com inteligência artificial, com limite de mensagens por dia. Só liga com a chave da Anthropic |
| Instalação | Stack própria para o Portainer (banco e login próprios), cópia de segurança e restauração |

## Como foi testado

A cada mudança, o GitHub roda tudo do zero. Nada entra no ramo principal sem passar.

| Conjunto | Quantidade | O que confere |
| --- | --- | --- |
| Lógica do aplicativo | 176 testes | Regras sem dependências: datas e fusos, quiz, trilha, validação do que o professor digita, e-mails, avisos da Greenn, limites |
| Banco de dados | 220 verificações e 2 testes de disputa | Quem lê e grava o quê (regras por linha), reserva de turmas, pagamento, lembretes, Papo, e a lista do que fica aberto a quem está logado |
| Ponta a ponta | 155 testes | Navegador de verdade clicando nas telas, do login à reserva de aula, contra dois ambientes: o Supabase local e a **mesma stack que vai para a VPS**, em Docker Swarm |
| Cópia de segurança | a cada execução | Copia, estraga o banco de propósito, restaura, confere as contagens e refaz os testes de login, de conteúdo e da área do aluno |
| Imagem | a cada execução | Construída sem nenhuma chave; conferido que nenhuma chave fica dentro; roda como usuário comum |

Os dois testes de disputa colocam vários alunos pedindo ao mesmo tempo: 11 alunos para 10 vagas (entram 10) e um
aluno pedindo 3 turmas com limite de 2 (entram 2).

## O que a revisão de segurança cobriu

- **Banco**: toda tabela tem regras de acesso por linha. Função nova não nasce liberada; os testes guardam a lista
  exata do que quem está logado pode chamar, e visitante sem login não lê nem chama nada.
- **Gabarito do quiz**: o aluno não lê a tabela de perguntas. O servidor entrega as perguntas sem a resposta e corrige.
- **Link da sala** (Google Meet): só chega a quem reservou. Não é lido na tabela de turmas.
- **Ações do servidor**: todas conferem quem está pedindo antes de fazer qualquer coisa; as de alunos e pagamentos,
  só o administrador.
- **Sessão**: fica em cookie que os programas da página não leem e que, em https, só viaja cifrado.
- **Cabeçalhos**: a plataforma não abre dentro de outra página; formulários só enviam para ela mesma; os únicos
  quadros de fora são os do YouTube.
- **Tentativa de senha**: 8 erros seguidos para o mesmo e-mail e ele espera 15 minutos. Link de acesso: no máximo
  3 por e-mail a cada 10 minutos, com a mesma resposta exista ou não a conta.
- **Texto digitado** (professor, aluno, tutor): é sempre mostrado como texto, nunca como HTML. Links só `https`.
- **Greenn**: o endereço do webhook leva um segredo; aviso repetido não é aplicado duas vezes; documento, endereço e
  telefone do comprador são descartados antes de guardar.
- **Dados pessoais**: o administrador apaga a conta de um aluno a pedido; os avisos de compra ficam sem nome e e-mail.
- **Chaves**: nenhuma no repositório nem na imagem. Entram só pelas variáveis da stack.

Um defeito sério foi achado e corrigido durante a construção, antes de qualquer instalação: no Supabase, toda
função nova nasce liberada para quem está logado, e as funções de pagamento estavam ao alcance de qualquer aluno.
Hoje tudo nasce fechado e os testes do banco acusam qualquer coisa que fique aberta por esquecimento.

## O que só dá para conferir na instalação de verdade

| Item | Como conferir | Passo do roteiro |
| --- | --- | --- |
| Traefik e certificado | A tela de acesso abre com o cadeado fechado | 5 |
| Imagens públicas no GitHub | Os serviços sobem sem erro de download | 1 |
| Caixa de e-mail da Hostinger | Botão "Enviar e-mail de teste" no painel | 7 |
| Entrega dos e-mails (SPF e DKIM) | O e-mail de teste não cai no spam | 7 |
| Greenn de verdade | Compra de teste e reembolso do próprio produto | 10 |
| Vídeo do YouTube | Assistir a uma aula: a tela guarda onde parou e marca como vista | 9 |
| Google Meet | Entrar em uma turma pelo link, como aluno | 9 |
| Papo com a Anthropic de verdade | Uma conversa curta depois de pôr a chave | 12 |

Nos testes, esses serviços de fora são imitados (o e-mail é gravado em arquivo; a Greenn, o YouTube e a Anthropic
são simulados), então o caminho da plataforma está exercitado até a porta de cada um.

## Limites conhecidos

- A Greenn manda um cabeçalho `x-webhook-token` que a plataforma não confere: a documentação não diz como ele é
  calculado. A proteção é o segredo do endereço.
- O limite de tentativas de senha fica na memória do aplicativo: reiniciar o aplicativo zera a contagem.
- O banco, o login e os dados ficam na mesma rede interna das outras stacks da VPS (sem porta aberta e sem rótulo
  do Traefik). Uma rede só da plataforma é uma melhoria possível na VPS própria.
- Não há tela de termos de uso nem de política de privacidade: o texto depende de orientação jurídica (há alunos na
  União Europeia).
- Sem funções de áudio, por decisão do projeto.
