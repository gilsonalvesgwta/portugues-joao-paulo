import type { Metadata } from 'next';
import { FormularioDoTema } from '@/components/admin/FormulariosDaConversacao';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Novo tema' };

export default function PaginaNovoTema() {
  return (
    <>
      <Trilha href="/admin/conversacao/temas" rotulo="Temas" />
      <TituloDaPagina titulo="Novo tema" texto="O que o aluno lê antes de reservar a aula." />
      <Cartao>
        <FormularioDoTema tema={{ id: '', titulo_es: '', nivel: 'basico', descricao_es: '', aprendizados: '', material: '' }} />
      </Cartao>
    </>
  );
}
