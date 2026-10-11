'use client';

import { useActionState } from 'react';
import { salvarOferta } from '@/app/admin/pagamentos/acoes';
import { Botao, Caixa, Entrada, LinkBotao, Selecao } from '@/components/admin/ui';
import { ESTADO_INICIAL } from '@/lib/formulario';

export type OfertaNoFormulario = {
  id: string;
  nome: string;
  greenn_product_id: string;
  curso_id: string;
  dias_de_acesso: string;
  inclui_conversacao: boolean;
  reservas_por_semana: string;
  ativa: boolean;
};

type Props = { oferta: OfertaNoFormulario; cursos: { id: string; rotulo: string }[] };

export function FormularioDaOferta({ oferta, cursos }: Props) {
  const [estado, acao, enviando] = useActionState(salvarOferta, ESTADO_INICIAL);
  const enviado = estado.vez > 0;
  const texto = (campo: 'nome' | 'greenn_product_id' | 'curso_id' | 'dias_de_acesso' | 'reservas_por_semana') =>
    estado.valores[campo] ?? oferta[campo];
  const marcada = (campo: 'inclui_conversacao' | 'ativa') => (enviado ? estado.valores[campo] === 'on' : oferta[campo]);
  const erros = estado.erros;

  return (
    <form action={acao} noValidate data-vez={estado.vez} className="flex flex-col gap-5">
      {erros.geral ? (
        <p role="alert" className="rounded-xl border border-perigo bg-cartao px-4 py-3 text-[15px] font-semibold text-perigo">
          {erros.geral}
        </p>
      ) : null}
      <input type="hidden" name="id" value={oferta.id} />
      <div key={estado.vez} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Entrada
            id="nome"
            rotulo="Nome da oferta"
            ajuda="Só aparece aqui na administração. Ex.: Acesso anual."
            defaultValue={texto('nome')}
            erro={erros.nome}
            maxLength={120}
          />
          <Entrada
            id="greenn_product_id"
            rotulo="Código do produto na Greenn"
            ajuda="O número que identifica o produto na Greenn. É por ele que a compra encontra esta oferta."
            defaultValue={texto('greenn_product_id')}
            erro={erros.greenn_product_id}
            inputMode="numeric"
            maxLength={15}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Selecao id="curso_id" rotulo="Curso que a compra libera" defaultValue={texto('curso_id')} erro={erros.curso_id}>
            {cursos.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.rotulo}
              </option>
            ))}
          </Selecao>
          <Entrada
            id="dias_de_acesso"
            rotulo="Dias de acesso (opcional)"
            ajuda="Em branco, o acesso não tem prazo. Em assinatura, vale o período pago na Greenn."
            defaultValue={texto('dias_de_acesso')}
            erro={erros.dias_de_acesso}
            inputMode="numeric"
            maxLength={4}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Caixa
            id="inclui_conversacao"
            rotulo="Inclui as aulas de conversação ao vivo"
            ajuda="Desmarcada, quem compra vê o curso, mas não reserva aulas ao vivo."
            defaultChecked={marcada('inclui_conversacao')}
          />
          <Entrada
            id="reservas_por_semana"
            rotulo="Reservas de conversação por semana"
            defaultValue={texto('reservas_por_semana')}
            erro={erros.reservas_por_semana}
            inputMode="numeric"
            maxLength={2}
          />
        </div>
        <Caixa
          id="ativa"
          rotulo="Oferta ativa"
          ajuda="Desativada, as compras desse produto chegam, ficam pendentes e não liberam acesso."
          defaultChecked={marcada('ativa')}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Botao disabled={enviando}>Salvar oferta</Botao>
        <LinkBotao href="/admin/pagamentos" variante="secundario">
          Cancelar
        </LinkBotao>
      </div>
    </form>
  );
}
