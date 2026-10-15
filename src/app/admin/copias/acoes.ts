'use server';

import { redirect } from 'next/navigation';
import { apagarCopia as apagar, caminhoDaCopia, carregarCopias, pastaDasCopias, pedirAoServico } from '@/lib/admin/copias';
import { exigirAdmin } from '@/lib/admin/guarda';

// Ações da tela de cópias de segurança, só para o administrador. Fazer e restaurar viram pedidos
// para o serviço de cópias; apagar é feito aqui mesmo.

const TELA = '/admin/copias';

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}

async function ocupado(): Promise<boolean> {
  const situacao = await carregarCopias();
  return situacao.trabalhando !== null || situacao.pendentes > 0;
}

export async function fazerCopiaAgora(): Promise<void> {
  await exigirAdmin();
  if (pastaDasCopias() === null) redirect(`${TELA}?aviso=copias_desligado`);
  if (await ocupado()) redirect(`${TELA}?aviso=copias_ocupado`);
  const pedido = await pedirAoServico('copiar');
  redirect(`${TELA}?aviso=${pedido ? 'copia_pedida' : 'falhou'}`);
}

export async function restaurarCopia(dados: FormData): Promise<void> {
  await exigirAdmin();
  const arquivo = texto(dados, 'arquivo');
  const voltar = `${TELA}/restaurar?arquivo=${encodeURIComponent(arquivo)}`;
  if (pastaDasCopias() === null) redirect(`${TELA}?aviso=copias_desligado`);
  if ((await caminhoDaCopia(arquivo)) === null) redirect(`${TELA}?aviso=copia_nao_encontrada`);
  if (texto(dados, 'confirmacao') !== 'RESTAURAR') redirect(`${voltar}&aviso=copia_confirmar`);
  if (await ocupado()) redirect(`${voltar}&aviso=copias_ocupado`);
  const pedido = await pedirAoServico('restaurar', arquivo);
  redirect(`${TELA}?aviso=${pedido ? 'restauracao_pedida' : 'falhou'}#andamento`);
}

export async function apagarCopia(dados: FormData): Promise<void> {
  await exigirAdmin();
  const arquivo = texto(dados, 'arquivo');
  const situacao = await carregarCopias();
  // A cópia que está sendo restaurada (ou está na fila para isso) não sai do lugar.
  if (situacao.trabalhando?.arquivo === arquivo) redirect(`${TELA}?aviso=copias_ocupado`);
  const apagada = await apagar(arquivo);
  redirect(`${TELA}?aviso=${apagada ? 'copia_apagada' : 'copia_nao_encontrada'}`);
}
