// E-mails enviados ao aluno, em espanhol. Cada função devolve assunto, versão em texto e
// versão em HTML. Todo dado variável passa por escaparHtml antes de entrar no HTML.

export type Email = { asunto: string; texto: string; html: string };

const MARCA = 'Português com João Paulo';
const VERDE = '#075E54';
const FUNDO = '#F5F1E8';
const TEXTO = '#17211F';
const APOIO = '#5B655F';

export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Só aceitamos endereços https nos botões; qualquer outra coisa vira erro na hora de montar.
// A exceção é o próprio computador (127.0.0.1 ou localhost), usado no desenvolvimento e nos testes.
const ENLACE_HTTPS = /^https:\/\/[^\s"'<>]+$/;
const ENLACE_LOCAL = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/[^\s"'<>]*$/;

function enlaceSeguro(url: string): string {
  if (!ENLACE_HTTPS.test(url) && !ENLACE_LOCAL.test(url)) throw new Error('enlace_invalido');
  return url;
}

function saludo(nombre: string): string {
  const limpio = nombre.trim();
  return limpio === '' ? 'Hola:' : `Hola, ${limpio}:`;
}

// "jueves, 8 de octubre de 2026, 20:00" no fuso do aluno, seguido do nome curto do fuso.
export function fechaYHora(inicioIso: string, fuso: string): string {
  const instante = new Date(inicioIso);
  if (Number.isNaN(instante.getTime())) throw new Error('fecha_invalida');
  const fecha = new Intl.DateTimeFormat('es', {
    timeZone: fuso, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(instante);
  const hora = new Intl.DateTimeFormat('es', {
    timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  }).format(instante);
  return `${fecha}, ${hora}`;
}

type Boton = { rotulo: string; url: string };

function montar(asunto: string, nombre: string, parrafos: string[], boton?: Boton, nota?: string): Email {
  const url = boton ? enlaceSeguro(boton.url) : null;

  const texto = [
    saludo(nombre),
    ...parrafos,
    ...(boton && url ? [`${boton.rotulo}: ${url}`] : []),
    ...(nota ? [nota] : []),
    MARCA,
  ].join('\n\n');

  const cuerpo = parrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${TEXTO}">${escaparHtml(p)}</p>`)
    .join('');
  const botonHtml = boton && url
    ? `<p style="margin:8px 0 24px"><a href="${escaparHtml(url)}" style="display:inline-block;padding:14px 28px;background:${VERDE};color:#FFFFFF;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px">${escaparHtml(boton.rotulo)}</a></p>`
    : '';
  const notaHtml = nota
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${APOIO}">${escaparHtml(nota)}</p>`
    : '';

  const html =
    `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:${FUNDO};font-family:Arial,Helvetica,sans-serif">` +
    `<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:32px">` +
    `<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:${VERDE}">${escaparHtml(MARCA)}</p>` +
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${TEXTO}">${escaparHtml(saludo(nombre))}</p>` +
    cuerpo + botonHtml + notaHtml +
    `</div></body></html>`;

  return { asunto, texto, html };
}

// "compra": o e-mail sai logo depois do pagamento. Sem isso, a conta foi criada pela administração
// ou a própria pessoa pediu o link de primeiro acesso.
export function emailBienvenida(d: { nombre: string; enlace: string; compra?: boolean }): Email {
  return montar(
    'Tu acceso al curso de portugués',
    d.nombre,
    [
      d.compra ? 'Tu compra está confirmada y tu acceso ya está activo.' : 'Tu cuenta en la plataforma ya está lista.',
      'Para entrar por primera vez, crea tu contraseña con el botón de abajo.',
    ],
    { rotulo: 'Crear mi contraseña', url: d.enlace },
    'El enlace funciona una sola vez. Si caduca, pide uno nuevo en la pantalla de acceso, en «¿Primer acceso?».',
  );
}

export function emailRestablecer(d: { nombre: string; enlace: string }): Email {
  return montar(
    'Restablece tu contraseña',
    d.nombre,
    ['Recibimos una solicitud para cambiar tu contraseña.'],
    { rotulo: 'Crear una contraseña nueva', url: d.enlace },
    'El enlace caduca en 1 hora. Si no pediste el cambio, ignora este mensaje: tu contraseña sigue igual.',
  );
}

type DatosDeClase = { nombre: string; tema: string; inicio: string; fuso: string; meetUrl: string };

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? `1 ${uno}` : `${n} ${varios}`;
}

export function emailReservaConfirmada(
  d: DatosDeClase & { duracionMin: number; cancelarHastaHoras: number; material?: string },
): Email {
  return montar(
    `Reserva confirmada: ${d.tema}`,
    d.nombre,
    [
      `Tu plaza en la clase de conversación «${d.tema}» está reservada.`,
      `Fecha y hora: ${fechaYHora(d.inicio, d.fuso)}.`,
      `La clase dura ${d.duracionMin} minutos y es por Google Meet. El enlace es el mismo para todo el grupo.`,
      ...(d.material ? [`Material de la clase: ${enlaceSeguro(d.material)}`] : []),
    ],
    { rotulo: 'Entrar a la clase', url: d.meetUrl },
    `Puedes cancelar desde la plataforma hasta ${plural(d.cancelarHastaHoras, 'hora', 'horas')} antes del inicio.`,
  );
}

export function emailRecordatorio(d: DatosDeClase & { falta: '24 horas' | '1 hora' }): Email {
  return montar(
    `Tu clase empieza en ${d.falta}: ${d.tema}`,
    d.nombre,
    [`Te recordamos tu clase de conversación «${d.tema}».`, `Fecha y hora: ${fechaYHora(d.inicio, d.fuso)}.`],
    { rotulo: 'Entrar a la clase', url: d.meetUrl },
  );
}

export function emailReservaCancelada(d: { nombre: string; tema: string; inicio: string; fuso: string }): Email {
  return montar(
    `Reserva cancelada: ${d.tema}`,
    d.nombre,
    [
      `Cancelaste tu plaza en la clase «${d.tema}» del ${fechaYHora(d.inicio, d.fuso)}.`,
      'La reserva volvió a tu cuenta: puedes elegir otra clase esta semana.',
    ],
  );
}

export function emailClaseCancelada(d: { nombre: string; tema: string; inicio: string; fuso: string; agenda: string }): Email {
  return montar(
    `Clase cancelada: ${d.tema}`,
    d.nombre,
    [
      `La clase «${d.tema}» del ${fechaYHora(d.inicio, d.fuso)} fue cancelada por el profesor.`,
      'La reserva volvió a tu cuenta. Disculpa las molestias.',
    ],
    { rotulo: 'Elegir otra clase', url: d.agenda },
  );
}

// E-mail de conferência enviado pela administração para testar a caixa de envio. Em português,
// porque quem recebe é a equipe.
export function emailDeConferencia(quando: string): Email {
  const linhas = [
    'Este é um e-mail de teste da plataforma.',
    'Se você está lendo esta mensagem, o envio de e-mails está funcionando.',
    `Enviado em ${quando}.`,
  ];
  const html =
    `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:${FUNDO};font-family:Arial,Helvetica,sans-serif">` +
    `<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;padding:32px">` +
    `<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:${VERDE}">${escaparHtml(MARCA)}</p>` +
    linhas.map((l) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${TEXTO}">${escaparHtml(l)}</p>`).join('') +
    `</div></body></html>`;
  return { asunto: 'Teste de envio de e-mail', texto: [...linhas, MARCA].join('\n\n'), html };
}
