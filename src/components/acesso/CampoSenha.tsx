'use client';

import { useState } from 'react';
import { classeDoCampo } from './campos';

type Props = {
  id?: string;
  autoCompletar?: 'current-password' | 'new-password';
  rotulo: string;
  exemplo: string;
  mostrar: string;
  ocultar: string;
};

// Campo de senha com o botão de mostrar e ocultar o que foi digitado.
export function CampoSenha({ id = 'clave', autoCompletar = 'current-password', rotulo, exemplo, mostrar, ocultar }: Props) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {rotulo}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={id}
          type={visivel ? 'text' : 'password'}
          required
          minLength={8}
          autoComplete={autoCompletar}
          placeholder={exemplo}
          className={classeDoCampo}
        />
        <button
          type="button"
          aria-label={visivel ? ocultar : mostrar}
          aria-pressed={visivel}
          onClick={() => setVisivel((atual) => !atual)}
          className="flex size-[52px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-borda-campo bg-cartao text-apoio hover:text-texto"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {visivel ? <path d="M4 4l16 16" /> : null}
          </svg>
        </button>
      </div>
    </div>
  );
}
