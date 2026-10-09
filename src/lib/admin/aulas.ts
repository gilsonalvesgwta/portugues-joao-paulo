import type { GrupoDeModulos } from '@/components/admin/FormularioDaAula';
import { proximoNumero } from '@/lib/conteudo';
import { ativos, modulosPorCurso, type Conteudo } from './dados';

// Opções de módulo para o formulário da aula, agrupadas por curso (só cursos com módulo).
export function gruposParaAula(conteudo: Conteudo): GrupoDeModulos[] {
  return modulosPorCurso(conteudo)
    .filter((grupo) => grupo.modulos.length > 0)
    .map((grupo) => ({
      curso: grupo.curso.titulo_pt,
      modulos: grupo.modulos.map((modulo) => ({ id: modulo.id, titulo: modulo.titulo_pt })),
    }));
}

// Número sugerido para uma aula nova: o próximo livre no curso do módulo.
export function numeroSugerido(conteudo: Conteudo, moduloId: string): number {
  const cursoId = conteudo.modulos.find((modulo) => modulo.id === moduloId)?.curso_id;
  const modulosDoCurso = new Set(conteudo.modulos.filter((modulo) => modulo.curso_id === cursoId).map((modulo) => modulo.id));
  return proximoNumero(ativos(conteudo.aulas).filter((aula) => modulosDoCurso.has(aula.modulo_id)).map((aula) => aula.numero));
}
