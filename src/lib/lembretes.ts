import { enviarEmail } from './correio';
import { emailRecordatorio } from './emails';
import { motivoDaFalha } from './smtp';
import { clienteDeServico } from './supabase/servico';

// Lembretes das aulas de conversação: um e-mail 24 horas antes e outro 1 hora antes.
// O banco decide quem está na hora de receber e garante que cada lembrete saia uma vez só
// (função separar_lembretes); aqui o e-mail é escrito, enviado e o resultado é anotado.
// O servidor chama esta rotina de tempos em tempos, enquanto está no ar.

type Lembrete = {
  id: string;
  tipo: string;
  email: string;
  nome: string | null;
  fuso: string | null;
  tema: string;
  inicio: string;
  meet_url: string;
};

export type ResultadoDosLembretes = { enviados: number; falhas: number };

const INTERVALO_PADRAO_SEG = 300;

export async function enviarLembretes(): Promise<ResultadoDosLembretes> {
  const servico = clienteDeServico();
  const { data, error } = await servico.rpc('separar_lembretes', { p_limite: 50 });
  if (error) throw new Error(`Não consegui separar os lembretes: ${error.message}`);

  const resultado: ResultadoDosLembretes = { enviados: 0, falhas: 0 };
  for (const lembrete of (data ?? []) as unknown as Lembrete[]) {
    let falha: string | null = null;
    try {
      await enviarEmail(
        lembrete.email,
        emailRecordatorio({
          nombre: lembrete.nome ?? '',
          tema: lembrete.tema,
          inicio: lembrete.inicio,
          fuso: lembrete.fuso ?? 'Europe/Madrid',
          meetUrl: lembrete.meet_url,
          falta: lembrete.tipo === 'recordatorio_1h' ? '1 hora' : '24 horas',
        }),
      );
      resultado.enviados += 1;
    } catch (erro) {
      falha = motivoDaFalha(erro);
      resultado.falhas += 1;
      console.error(`Falha ao enviar o lembrete ${lembrete.tipo} (${falha}):`, erro instanceof Error ? erro.message : erro);
    }
    const { error: erroAoAnotar } = await servico.rpc('concluir_lembrete', { p_id: lembrete.id, p_erro: falha });
    if (erroAoAnotar) console.error('Não consegui anotar o resultado do lembrete:', erroAoAnotar.message);
  }
  return resultado;
}

// De quanto em quanto tempo o servidor confere os lembretes, em segundos. 0 desliga.
export function intervaloDosLembretes(ambiente: Record<string, string | undefined> = process.env): number {
  const texto = (ambiente.LEMBRETES_INTERVALO_SEG ?? '').trim();
  if (texto === '') return INTERVALO_PADRAO_SEG;
  const valor = Number(texto);
  if (!Number.isInteger(valor) || valor < 0) return INTERVALO_PADRAO_SEG;
  return valor;
}

let ligado = false;

// Liga a conferência periódica. Uma rodada só começa quando a anterior terminou.
export function ligarLembretes(): void {
  const segundos = intervaloDosLembretes();
  if (ligado || segundos === 0) return;
  ligado = true;
  let rodando = false;
  const rodada = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const { enviados, falhas } = await enviarLembretes();
      if (enviados + falhas > 0) console.log(`Lembretes de aula: ${enviados} enviados, ${falhas} com falha.`);
    } catch (erro) {
      // Banco fora do ar, por exemplo: a próxima rodada tenta de novo.
      console.error('Lembretes de aula:', erro instanceof Error ? erro.message : erro);
    } finally {
      rodando = false;
    }
  };
  // "unref": o relógio não impede o servidor de desligar.
  setInterval(() => void rodada(), segundos * 1000).unref();
}
