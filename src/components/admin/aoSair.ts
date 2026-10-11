'use client';

import { useEffect } from 'react';

// Enquanto houver alteração sem salvar, avisa antes de fechar a aba, recarregar ou seguir um link.
export function useAvisoAoSair(sujo: boolean, pergunta: string): void {
  useEffect(() => {
    if (!sujo) return;
    const aoSair = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };
    const aoClicar = (evento: MouseEvent) => {
      const alvo = evento.target instanceof Element ? evento.target.closest('a[href]') : null;
      if (!alvo || evento.defaultPrevented) return;
      if (!window.confirm(pergunta)) {
        evento.preventDefault();
        evento.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', aoSair);
    document.addEventListener('click', aoClicar, true);
    return () => {
      window.removeEventListener('beforeunload', aoSair);
      document.removeEventListener('click', aoClicar, true);
    };
  }, [sujo, pergunta]);
}
