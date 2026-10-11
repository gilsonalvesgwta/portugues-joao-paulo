import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDaOferta } from '@/components/admin/FormularioDaOferta';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { ativos, carregarConteudo } from '@/lib/admin/dados';
import { exigirAdmin } from '@/lib/admin/guarda';
import { rotuloDoCurso } from '@/lib/admin/pessoas';

export const metadata: Metadata = { title: 'Nova oferta' };

export default async function PaginaNovaOferta() {
  await exigirAdmin();
  const conteudo = await carregarConteudo();
  const cursos = ativos(conteudo.cursos).map((curso) => ({ id: curso.id, rotulo: rotuloDoCurso(curso) }));
  if (cursos.length === 0) redirect('/admin/pagamentos?aviso=oferta_sem_curso');

  return (
    <>
      <Trilha href="/admin/pagamentos" rotulo="Pagamentos" />
      <TituloDaPagina titulo="Nova oferta" texto="Liga um produto vendido na Greenn ao curso que a compra libera." />
      <Cartao>
        <FormularioDaOferta
          cursos={cursos}
          oferta={{
            id: '',
            nome: '',
            greenn_product_id: '',
            curso_id: cursos[0]?.id ?? '',
            dias_de_acesso: '365',
            inclui_conversacao: true,
            reservas_por_semana: '2',
            ativa: true,
          }}
        />
      </Cartao>
    </>
  );
}
