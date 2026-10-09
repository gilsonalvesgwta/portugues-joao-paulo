import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { es } from '@/i18n/es';
import { pessoaLogada } from '@/lib/supabase/servidor';

export const metadata: Metadata = { title: es.inicio.titulo };

// PROVISÓRIO: esta tela só confirma que o login funcionou. O curso, as tarefas do dia
// e os atalhos entram na fase 3, conforme o desenho aprovado.
export default async function PaginaInicio() {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect('/entrar');
  const primeiroNome = pessoa.nome.trim().split(/\s+/)[0] ?? '';

  return (
    <section className="rounded-[20px] border border-linha bg-cartao p-8">
      <h1 className="font-titulo text-4xl font-bold leading-tight">
        {primeiroNome ? `${es.inicio.saludo}, ${primeiroNome}` : es.inicio.saludo}
      </h1>
      <p className="mt-3 text-base leading-normal text-apoio">{es.inicio.enConstruccion}</p>
    </section>
  );
}
