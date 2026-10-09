import type { Metadata } from 'next';
import { FormularioDoCurso } from '@/components/admin/FormularioDoCurso';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Novo curso' };

export default function PaginaNovoCurso() {
  return (
    <>
      <Trilha href="/admin/cursos" rotulo="Cursos e módulos" />
      <TituloDaPagina titulo="Novo curso" texto="O curso nasce como rascunho. Publique quando as aulas estiverem prontas." />
      <Cartao>
        <FormularioDoCurso curso={{ id: '', titulo_pt: '', titulo_es: '', tipo: 'principal', modo: 'livre', situacao: 'rascunho' }} />
      </Cartao>
    </>
  );
}
