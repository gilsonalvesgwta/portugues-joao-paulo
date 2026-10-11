import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormularioDaTurma } from '@/components/admin/FormulariosDaConversacao';
import { Cartao, TituloDaPagina, Trilha } from '@/components/admin/ui';
import { exigirEquipe } from '@/lib/admin/guarda';
import { carregarTemas } from '@/lib/admin/conversacao';
import { lerNivel, NOME_DO_NIVEL } from '@/lib/conversacao';

export const metadata: Metadata = { title: 'Nova turma' };

export default async function PaginaNovaTurma() {
  await exigirEquipe();
  const temas = (await carregarTemas()).filter((tema) => tema.arquivado_em === null);
  if (temas.length === 0) redirect('/admin/conversacao/temas?aviso=turma_sem_tema');

  return (
    <>
      <Trilha href="/admin/conversacao" rotulo="Conversação" />
      <TituloDaPagina titulo="Nova turma" texto="Uma aula ao vivo em grupo. Assim que é criada, aparece na agenda dos alunos." />
      <Cartao>
        <FormularioDaTurma
          travada={false}
          temas={temas.map((tema) => {
            const nivel = lerNivel(tema.nivel);
            return { id: tema.id, rotulo: `${tema.titulo_es} · ${nivel ? NOME_DO_NIVEL[nivel] : tema.nivel}` };
          })}
          turma={{ id: '', tema_id: temas[0]?.id ?? '', data: '', hora: '', duracao_min: '60', vagas: '10', meet_url: '' }}
        />
      </Cartao>
    </>
  );
}
