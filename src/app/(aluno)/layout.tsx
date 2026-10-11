import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { MenuDelAlumno } from '@/components/aluno/MenuDelAlumno';
import { CabecalhoInterno } from '@/components/Cabecalho';
import { es } from '@/i18n/es';
import { configDoPapo } from '@/lib/papo';
import { clienteDoServidor, pessoaLogada } from '@/lib/supabase/servidor';

// Moldura da área do aluno. O proxy já barra quem não está logado; a checagem aqui
// é a segunda tranca, para o caso de a sessão ter expirado entre um e outro.
//
// Antes de qualquer tela da área, a pessoa confirma o fuso horário (uma vez só): toda conta nasce
// com o fuso de Madri, e sem a confirmação quem mora em outro lugar veria as aulas ao vivo na
// hora errada. Vale também para a equipe, que abre estas telas como prévia. Se a leitura falhar
// (por exemplo, no instante de uma atualização), ninguém fica barrado por isso.
export default async function LayoutDoAluno({ children }: { children: ReactNode }) {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');

  const supabase = await clienteDoServidor();
  const { data: perfil, error } = await supabase.from('perfis').select('fuso_confirmado_em').eq('id', pessoa.id).maybeSingle();
  if (!error && perfil && perfil.fuso_confirmado_em === null) redirect('/zona-horaria');

  return (
    <div className="min-h-dvh">
      <CabecalhoInterno inicio="/inicio" nome={pessoa.nome || pessoa.email} rotuloSair={es.comum.salir} menu={<MenuDelAlumno conPapo={configDoPapo() !== null} />} />
      <main className="mx-auto max-w-[1208px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
