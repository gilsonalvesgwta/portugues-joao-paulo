export type Papel = 'aluno' | 'professor' | 'admin';

export function ehEquipe(papel: string | null | undefined): boolean {
  return papel === 'professor' || papel === 'admin';
}
