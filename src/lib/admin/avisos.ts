// Mensagens mostradas no topo das telas da administração depois de uma ação.
// A ação redireciona com ?aviso=codigo e a tela procura o texto aqui.

export type AvisoDaAcao = { tipo: 'ok' | 'erro'; texto: string };

export const AVISOS: Record<string, AvisoDaAcao> = {
  curso_salvo: { tipo: 'ok', texto: 'Curso salvo.' },
  modulo_salvo: { tipo: 'ok', texto: 'Módulo salvo.' },
  aula_salva: { tipo: 'ok', texto: 'Aula salva.' },
  aula_publicada: { tipo: 'ok', texto: 'Aula salva e publicada.' },
  material_salvo: { tipo: 'ok', texto: 'Material salvo.' },
  material_apagado: { tipo: 'ok', texto: 'Material apagado.' },
  na_lixeira: { tipo: 'ok', texto: 'Movido para a lixeira. Dá para restaurar quando quiser.' },
  restaurado: { tipo: 'ok', texto: 'Restaurado como rascunho.' },
  modulo_restaurado: { tipo: 'ok', texto: 'Módulo restaurado.' },
  tarefa_salva: { tipo: 'ok', texto: 'Tarefa salva.' },
  aula_na_trilha: {
    tipo: 'erro',
    texto: 'Esta aula (ou o quiz dela) está na trilha por dia. Tire da trilha antes de mover para a lixeira.',
  },
  tarefa_na_trilha: { tipo: 'erro', texto: 'Esta tarefa está na trilha por dia. Tire da trilha antes de mover para a lixeira.' },
  tarefa_restaurada: { tipo: 'ok', texto: 'Tarefa restaurada.' },
  restaurar_curso_da_tarefa: { tipo: 'erro', texto: 'O curso desta tarefa está na lixeira. Restaure o curso antes.' },
  curso_com_modulos: {
    tipo: 'erro',
    texto: 'Este curso ainda tem módulos. Mova os módulos para a lixeira antes de mover o curso.',
  },
  modulo_com_aulas: {
    tipo: 'erro',
    texto: 'Este módulo ainda tem aulas. Mova as aulas para outro módulo ou para a lixeira antes.',
  },
  restaurar_curso_antes: { tipo: 'erro', texto: 'O curso deste módulo está na lixeira. Restaure o curso antes.' },
  restaurar_modulo_antes: { tipo: 'erro', texto: 'O módulo desta aula está na lixeira. Restaure o módulo antes.' },
  numero_ocupado: {
    tipo: 'erro',
    texto: 'Já existe outra aula com esse número no curso. Mude o número da outra aula antes de restaurar esta.',
  },
  nao_encontrado: { tipo: 'erro', texto: 'Não encontrei esse item. Ele pode ter sido alterado por outra pessoa.' },
  falhou: { tipo: 'erro', texto: 'Não foi possível salvar. Tente de novo.' },
  email_enviado: { tipo: 'ok', texto: 'E-mail de teste enviado. Confira a sua caixa de entrada e a pasta de spam.' },
  email_configuracao: {
    tipo: 'erro',
    texto: 'O envio de e-mail não está configurado por completo. Confira as variáveis de e-mail na instalação.',
  },
  email_senha: { tipo: 'erro', texto: 'O servidor de e-mail recusou o usuário ou a senha. Confira os dois na instalação.' },
  email_conexao: {
    tipo: 'erro',
    texto: 'Não consegui conectar ao servidor de e-mail. Confira o endereço do servidor e a porta na instalação.',
  },
  email_recusado: {
    tipo: 'erro',
    texto: 'O servidor de e-mail recusou a mensagem. Confira se o remetente é o mesmo endereço da caixa de e-mail.',
  },
  email_falhou: { tipo: 'erro', texto: 'O e-mail de teste não foi enviado. O motivo está no registro do servidor.' },
  so_administrador: { tipo: 'erro', texto: 'Essa parte é só para o administrador.' },
  pessoa_criada: { tipo: 'ok', texto: 'Pessoa cadastrada. Nenhum e-mail foi enviado: quando quiser, use o botão “Enviar link de acesso”.' },
  criada_link_enviado: { tipo: 'ok', texto: 'Pessoa cadastrada. O e-mail com o link para criar a senha foi enviado.' },
  criada_link_falhou: {
    tipo: 'erro',
    texto: 'A pessoa foi cadastrada, mas o e-mail de acesso não saiu. Confira o envio de e-mail no Painel e mande de novo por aqui.',
  },
  criada_link_limite: {
    tipo: 'erro',
    texto: 'A pessoa foi cadastrada, mas o e-mail de acesso não saiu: esse endereço já recebeu links demais há pouco. Mande de novo daqui a 10 minutos.',
  },
  criada_sem_matricula: { tipo: 'erro', texto: 'A pessoa foi cadastrada, mas a matrícula não foi gravada. Matricule por esta tela.' },
  nome_salvo: { tipo: 'ok', texto: 'Nome salvo.' },
  email_corrigido: { tipo: 'ok', texto: 'E-mail trocado. A pessoa passa a entrar com o e-mail novo; a senha continua a mesma.' },
  papel_salvo: { tipo: 'ok', texto: 'Papel salvo.' },
  proprio_papel: { tipo: 'erro', texto: 'Você não pode mudar o próprio papel. Peça a outro administrador.' },
  matricula_criada: { tipo: 'ok', texto: 'Matrícula feita.' },
  matricula_salva: { tipo: 'ok', texto: 'Matrícula salva.' },
  acesso_bloqueado: { tipo: 'ok', texto: 'Acesso bloqueado. A pessoa deixa de ver o curso até você liberar de novo.' },
  acesso_liberado: { tipo: 'ok', texto: 'Acesso liberado.' },
  acesso_liberado_vencido: {
    tipo: 'erro',
    texto: 'O bloqueio foi retirado, mas a validade desta matrícula já passou. Mude a data em “Acesso até” para a pessoa voltar a entrar.',
  },
  link_enviado: { tipo: 'ok', texto: 'E-mail enviado com o link para criar ou trocar a senha.' },
  link_limite: {
    tipo: 'erro',
    texto: 'Esse endereço já recebeu 3 e-mails de acesso nos últimos 10 minutos. Espere um pouco antes de mandar outro.',
  },
  link_falhou: { tipo: 'erro', texto: 'O e-mail não saiu. Confira o envio de e-mail no Painel, com o botão “Enviar e-mail de teste”.' },
};

export function avisoDe(codigo: string | string[] | undefined): AvisoDaAcao | null {
  return typeof codigo === 'string' ? (AVISOS[codigo] ?? null) : null;
}
