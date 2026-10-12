import { apagarMaterial, moverMaterial } from '@/app/admin/acoes';
import { BotaoComConfirmacao } from '@/components/admin/BotaoComConfirmacao';
import { Botao, LinkBotao } from '@/components/admin/ui';
import type { Material } from '@/lib/admin/dados';

// Os materiais de apoio de uma aula ou de um curso inteiro, com subir, descer, editar e apagar.
// Fica dentro de um cartão da tela de quem é o dono dos materiais.
export function ListaDeMateriais({
  materiais,
  novo,
  vazio,
  titulo = 'Materiais de apoio',
}: {
  materiais: Material[];
  novo: string;
  vazio: string;
  titulo?: string;
}) {
  return (
    <>
      <div id="materiais" className="flex scroll-mt-6 flex-wrap items-center justify-between gap-3">
        <h2 className="text-[21px] font-bold leading-tight">{titulo}</h2>
        <LinkBotao href={novo} variante="secundario">
          Adicionar material
        </LinkBotao>
      </div>
      {materiais.length === 0 ? (
        <p className="mt-2 text-[15px] leading-normal text-apoio">{vazio}</p>
      ) : (
        <ol className="mt-3 flex flex-col divide-y divide-borda border-y border-borda">
          {materiais.map((material, indice) => (
            <li key={material.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-semibold">{material.titulo_pt}</span>
                <span className="text-sm text-apoio" lang="es">
                  {material.titulo_es}
                  {material.descricao_es ? ` · ${material.descricao_es}` : ''}
                </span>
                <a href={material.link} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-verde-link underline hover:text-verde">
                  {material.link}
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={moverMaterial} className="flex gap-1">
                  <input type="hidden" name="id" value={material.id} />
                  <Botao name="direcao" value="subir" variante="secundario" quadrado disabled={indice === 0} aria-label={`Subir o material ${material.titulo_pt}`}>
                    ↑
                  </Botao>
                  <Botao
                    name="direcao"
                    value="descer"
                    variante="secundario"
                    quadrado
                    disabled={indice === materiais.length - 1}
                    aria-label={`Descer o material ${material.titulo_pt}`}
                  >
                    ↓
                  </Botao>
                </form>
                <LinkBotao href={`/admin/materiais/${material.id}`} variante="secundario">
                  Editar<span className="sr-only"> o material {material.titulo_pt}</span>
                </LinkBotao>
                <BotaoComConfirmacao
                  acao={apagarMaterial}
                  campos={{ id: material.id }}
                  pergunta={`Apagar o material "${material.titulo_pt}"? Isso não tem volta.`}
                  rotulo={`Apagar o material ${material.titulo_pt}`}
                >
                  Apagar
                </BotaoComConfirmacao>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
