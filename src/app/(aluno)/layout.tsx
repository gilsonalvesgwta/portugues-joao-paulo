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
      <CabecalhoInterno
        inicio="/inicio"
        nome={pessoa.nome}
        email={pessoa.email}
        rotuloSair={es.comum.salir}
        menu={<MenuDelAlumno conPapo={configDoPapo() !== null} />}
      />
      {/* No celular, o espaço de baixo deixa o fim da página livre da barra fixa das seções. */}
      <main className="mx-auto max-w-[1240px] px-5 pb-28 pt-6 sm:px-8 lg:px-10 lg:pb-[72px] lg:pt-12">{children}</main>
    </div>
  );
}
