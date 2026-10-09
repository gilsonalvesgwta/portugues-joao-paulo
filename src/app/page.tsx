import { redirect } from 'next/navigation';

// A raiz ainda não tem conteúdo próprio: leva para a tela de acesso.
export default function Raiz(): never {
  redirect('/entrar');
}
