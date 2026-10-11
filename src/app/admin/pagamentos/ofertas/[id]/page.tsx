import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDaOferta } from '@/components/admin/FormularioDaOferta';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { ativos, carregarConteudo } from '@/lib/admin/dados';
import { exigirAdmin } from '@/lib/admin/guarda';
import { carregarOferta } from '@/lib/admin/pagamentos';
import { rotuloDoCurso } from '@/lib/admin/pessoas';
import { ehUuid } from '@/lib/conteudo';

export const metadata: Metadata = { title: 'Editar oferta' };

type Props = { params: Promise<{ id: string }> };

export default async function PaginaEditarOferta({ params }: Props) {
  await exigirAdmin();
  const { id } = await params;
  if (!ehUuid(id)) redirect('/admin/pagamentos?aviso=nao_encontrado');
  const [oferta, conteudo] = await Promise.all([carregarOferta(id), carregarConteudo()]);
  if (!oferta) redirect('/admin/pagamentos?aviso=nao_encontrado');

  // O curso da oferta aparece na lista mesmo se foi para a lixeira; para salvar, é preciso escolher um que exista.
  const cursos = conteudo.cursos
    .filter((curso) => curso.arquivado_em === null || curso.id === oferta.curso_id)
    .map((curso) => ({ id: curso.id, rotulo: rotuloDoCurso(curso) }));

  return (
    <>
      <Trilha href="/admin/pagamentos" rotulo="Pagamentos" />
      <TituloDaPagina titulo="Editar oferta" texto={oferta.nome} />
      <Cartao>
        <FormularioDaOferta
          cursos={cursos}
          oferta={{
            id: oferta.id,
            nome: oferta.nome,
            greenn_product_id: String(oferta.greenn_product_id),
            curso_id: oferta.curso_id,
            dias_de_acesso: oferta.dias_de_acesso === null ? '' : String(oferta.dias_de_acesso),
            inclui_conversacao: oferta.inclui_conversacao,
            reservas_por_semana: String(oferta.reservas_por_semana),
            ativa: oferta.ativa,
          }}
        />
      </Cartao>
    </>
  );
}
