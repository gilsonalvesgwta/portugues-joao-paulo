import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDaAula } from '@/components/admin/FormularioDaAula';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { gruposParaAula, numeroSugerido } from '@/lib/admin/aulas';
import { carregarConteudo } from '@/lib/admin/dados';

export const metadata: Metadata = { title: 'Nova aula' };

type Props = { searchParams: Promise<{ modulo?: string | string[] }> };

export default async function PaginaNovaAula({ searchParams }: Props) {
  const { modulo: pedido } = await searchParams;
  const conteudo = await carregarConteudo();
  const grupos = gruposParaAula(conteudo);
  const todos = grupos.flatMap((grupo) => grupo.modulos);
  const primeiro = todos[0];
  if (!primeiro) redirect('/admin/aulas');
  const moduloId = todos.find((modulo) => modulo.id === pedido)?.id ?? primeiro.id;

  return (
    <>
      <Trilha href="/admin/aulas" rotulo="Aulas" />
      <TituloDaPagina titulo="Nova aula" texto="A aula só aparece para o aluno depois de publicada." />
      <Cartao>
        <FormularioDaAula
          grupos={grupos}
          aula={{
            id: '',
            modulo_id: moduloId,
            numero: String(numeroSugerido(conteudo, moduloId)),
            titulo_pt: '',
            titulo_es: '',
            video_id: '',
            duracao: '',
          }}
        />
      </Cartao>
    </>
  );
}
