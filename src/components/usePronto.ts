'use client';

import { useSyncExternalStore } from 'react';

const semMudancas = () => () => {};

// false enquanto a página ainda está "dormindo" no navegador (o HTML já chegou, mas os botões e
// os campos ainda não respondem) e true depois que ela acorda. As telas que só funcionam
// acordadas (o quiz, os editores) deixam os campos parados até lá: assim nada do que a pessoa
// marcar nesse instante se perde, o que acontecia em conexão lenta.
export function usePronto(): boolean {
  return useSyncExternalStore(semMudancas, () => true, () => false);
}
