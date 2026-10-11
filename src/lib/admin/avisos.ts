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
};

export function avisoDe(codigo: string | string[] | undefined): AvisoDaAcao | null {
  return typeof codigo === 'string' ? (AVISOS[codigo] ?? null) : null;
}
