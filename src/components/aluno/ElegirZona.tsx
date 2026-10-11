'use client';

import { useEffect, useState } from 'react';
import { confirmarZona } from '@/app/zona-horaria/acoes';
import { es } from '@/i18n/es';
import { horaEn, rotuloDoFuso, zonaDelDispositivo } from '@/lib/reservas';

const t = es.zonaHoraria;
const tc = es.cuenta;

type Opcao = { zona: string; rotulo: string };
type Estado = { pronta: boolean; zona: string; detectada: boolean; agora: Date | null };

// A escolha do fuso na primeira visita. Quando a página acorda no navegador, o fuso do aparelho
// já vem escolhido, e a tela mostra que horas são nesse fuso agora: comparar com o próprio relógio
// é o jeito mais simples de a pessoa saber se escolheu certo. Enquanto a página não acorda, o
// campo e o botão ficam parados, para ninguém confirmar o fuso de Madri sem querer.
export function ElegirZona({ guardada, comunes, otras }: { guardada: string; comunes: Opcao[]; otras: string[] }) {
  const [estado, setEstado] = useState<Estado>({ pronta: false, zona: guardada, detectada: false, agora: null });

  useEffect(() => {
    let doAparelho: string | null = null;
    try {
      doAparelho = zonaDelDispositivo(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // Navegador sem essa informação: fica o fuso do cadastro.
    }
    setEstado({ pronta: true, zona: doAparelho ?? guardada, detectada: doAparelho !== null, agora: new Date() });
    // O relógio da tela acompanha o do aparelho.
    const relogio = window.setInterval(() => setEstado((atual) => ({ ...atual, agora: new Date() })), 20_000);
    return () => window.clearInterval(relogio);
  }, [guardada]);

  // O fuso escolhido aparece na lista mesmo quando não está entre os que o servidor conhece.
  const conhecida = comunes.some((opcao) => opcao.zona === estado.zona) || otras.includes(estado.zona);

  return (
    <form action={confirmarZona} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fuso" className="text-sm font-semibold">
          {t.campo}
        </label>
        <select
          id="fuso"
          name="fuso"
          value={estado.zona}
          disabled={!estado.pronta}
          onChange={(evento) => setEstado((atual) => ({ ...atual, zona: evento.target.value, detectada: false }))}
          aria-describedby="fuso-ayuda"
          className="box-border h-12 w-full min-w-0 rounded-xl border border-borda-campo bg-cartao px-3.5 text-base text-texto disabled:opacity-60"
        >
          {conhecida ? null : <option value={estado.zona}>{estado.zona.replace(/_/g, ' ')}</option>}
          <optgroup label={tc.frecuentes}>
            {comunes.map((opcao) => (
              <option key={opcao.zona} value={opcao.zona}>
                {opcao.rotulo}
              </option>
            ))}
          </optgroup>
          <optgroup label={tc.otras}>
            {otras.map((zona) => (
              <option key={zona} value={zona}>
                {zona.replace(/_/g, ' ')}
              </option>
            ))}
          </optgroup>
        </select>
        <p id="fuso-ayuda" className="text-sm leading-normal text-apoio">
          {estado.detectada ? t.detectada : t.guardada}
        </p>
      </div>

      {estado.agora ? (
        <div role="status" className="flex flex-col gap-1 rounded-xl bg-fundo px-4 py-3">
          <p className="text-base leading-normal">
            {t.ahora} <span className="font-titulo text-2xl font-bold">{horaEn(estado.agora, estado.zona)}</span> {t.en}{' '}
            <span className="font-semibold">{rotuloDoFuso(estado.zona, estado.agora)}</span>.
          </p>
          <p className="text-sm leading-normal text-apoio">{t.comprueba}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div>
          <button
            type="submit"
            disabled={!estado.pronta}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-verde bg-verde px-5 text-base font-bold text-white hover:bg-verde-link disabled:cursor-default disabled:opacity-50"
          >
            {t.confirmar}
          </button>
        </div>
        <p className="text-sm leading-normal text-apoio">{t.despues}</p>
      </div>
    </form>
  );
}
