'use client';

import { useEffect, useState } from 'react';
import { usarZona } from '@/app/(aluno)/conversacion/acoes';
import { es } from '@/i18n/es';

// Quando o aparelho do aluno está em um fuso diferente do que está no cadastro, oferece trocar.
// Só aparece depois de a página carregar, porque só o navegador sabe o fuso do aparelho.
// Quem prefere manter o fuso do cadastro dispensa o aviso; a escolha fica guardada no aparelho.
const CHAVE = 'zona-dispensada';

function dispensada(fuso: string): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === fuso;
  } catch {
    return false;
  }
}

export function SugerenciaDeZona({ atual, dia, nivel }: { atual: string; dia: string; nivel: string }) {
  const [doAparelho, setDoAparelho] = useState<string | null>(null);

  useEffect(() => {
    try {
      const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (typeof fuso === 'string' && fuso !== '' && fuso !== 'UTC' && !dispensada(fuso)) setDoAparelho(fuso);
    } catch {
      // Navegador sem essa informação: fica o fuso do cadastro.
    }
  }, []);

  if (doAparelho === null || doAparelho === atual) return null;
  return (
    <form action={usarZona} className="flex flex-wrap items-center gap-3 rounded-xl border border-aviso bg-aviso-suave px-4 py-3">
      <input type="hidden" name="fuso" value={doAparelho} />
      <input type="hidden" name="dia" value={dia} />
      <input type="hidden" name="nivel" value={nivel} />
      <p className="min-w-0 flex-1 text-[15px] font-semibold text-aviso">
        {es.conversacion.sugerenciaZona}: {doAparelho.replace(/_/g, ' ')}
      </p>
      <button
        type="submit"
        className="min-h-11 cursor-pointer rounded-xl border border-aviso bg-cartao px-4 text-[15px] font-bold text-aviso hover:bg-fundo"
      >
        {es.conversacion.usarZona}
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(CHAVE, doAparelho);
          } catch {
            // Sem armazenamento no navegador: o aviso some só nesta visita.
          }
          setDoAparelho(null);
        }}
        className="min-h-11 cursor-pointer rounded-xl px-3 text-[15px] font-semibold text-aviso underline hover:bg-cartao"
      >
        {es.conversacion.mantenerZona}
      </button>
    </form>
  );
}
