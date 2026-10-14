'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Enquanto o serviço de cópias trabalha num pedido, a tela se atualiza sozinha a cada 3 segundos.
export function Acompanhar({ ligado }: { ligado: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!ligado) return;
    const relogio = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(relogio);
  }, [ligado, router]);
  return null;
}
