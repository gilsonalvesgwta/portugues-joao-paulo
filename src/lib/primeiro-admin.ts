import { clienteDeServico } from './supabase/servico';

// Em uma instalação nova ninguém consegue entrar: não há cadastro livre e ainda não existe
// administrador. Se ADMIN_EMAIL e ADMIN_SENHA_INICIAL estiverem definidos e não houver nenhum
// administrador, o aplicativo cria o primeiro ao subir. Depois que existe um administrador,
// estas variáveis não fazem mais nada (nem trocam senha, nem criam outra conta).

type Ambiente = Record<string, string | undefined>;
export type Resultado = 'sem_pedido' | 'ja_existe' | 'criado' | 'promovido';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function garantirAdministrador(ambiente: Ambiente = process.env): Promise<Resultado> {
  const email = (ambiente.ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (email === '') return 'sem_pedido';
  if (!EMAIL.test(email)) throw new Error('ADMIN_EMAIL não é um endereço de e-mail.');

  const servico = clienteDeServico();
  const { data: admins, error } = await servico.from('perfis').select('id').eq('papel', 'admin').limit(1);
  if (error) throw new Error(`Não consegui consultar os perfis: ${error.message}`);
  if ((admins ?? []).length > 0) return 'ja_existe';

  // Já existe uma conta com esse e-mail (por exemplo, criada como aluno): vira administrador.
  const { data: existente } = await servico.from('perfis').select('id').eq('email', email).maybeSingle();
  if (typeof existente?.id === 'string') {
    const { error: erroDoPapel } = await servico.from('perfis').update({ papel: 'admin' }).eq('id', existente.id);
    if (erroDoPapel) throw new Error(`Não consegui promover o administrador: ${erroDoPapel.message}`);
    return 'promovido';
  }

  const senha = ambiente.ADMIN_SENHA_INICIAL ?? '';
  if (senha.length < 8) throw new Error('ADMIN_SENHA_INICIAL precisa ter pelo menos 8 caracteres.');
  const { data: criado, error: erroDaConta } = await servico.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: (ambiente.ADMIN_NOME ?? '').trim() || 'Administração' },
  });
  if (erroDaConta || !criado.user) throw new Error(`Não consegui criar o administrador: ${erroDaConta?.message ?? 'sem resposta'}`);
  const { error: erroDoPapel } = await servico.from('perfis').update({ papel: 'admin' }).eq('id', criado.user.id);
  if (erroDoPapel) throw new Error(`Conta criada, mas não consegui torná-la administradora: ${erroDoPapel.message}`);
  return 'criado';
}

// Tenta por alguns minutos: logo depois de instalar, o banco pode ainda estar sendo preparado.
export async function garantirAdministradorComEspera(tentativas = 100, intervaloMs = 3000): Promise<void> {
  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      const resultado = await garantirAdministrador();
      if (resultado === 'criado') console.log('Primeiro administrador criado a partir de ADMIN_EMAIL.');
      if (resultado === 'promovido') console.log('A conta de ADMIN_EMAIL virou administradora.');
      return;
    } catch (erro) {
      if (tentativa === tentativas) {
        console.error('Não foi possível garantir o primeiro administrador:', erro instanceof Error ? erro.message : erro);
        return;
      }
      await new Promise((feito) => setTimeout(feito, intervaloMs));
    }
  }
}
