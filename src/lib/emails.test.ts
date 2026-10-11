import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emailBienvenida, emailClaseCancelada, emailRecordatorio, emailReservaCancelada, emailReservaConfirmada,
  emailRestablecer, escaparHtml, fechaYHora,
} from './emails.ts';

const clase = {
  nombre: 'Lucía',
  tema: 'En el restaurante',
  inicio: '2026-10-08T18:00:00Z',
  fuso: 'Europe/Madrid',
  meetUrl: 'https://meet.google.com/abc-defg-hij',
};

test('a data sai em espanhol, no fuso do aluno', () => {
  const madri = fechaYHora(clase.inicio, 'Europe/Madrid');
  assert.match(madri, /^jueves, 8 de octubre de 2026, 20:00/);
  const mexico = fechaYHora(clase.inicio, 'America/Mexico_City');
  assert.match(mexico, /^jueves, 8 de octubre de 2026, 12:00/);
  assert.notEqual(madri, mexico);
  assert.throws(() => fechaYHora('não é data', 'Europe/Madrid'), /fecha_invalida/);
});

test('boas-vindas leva o link de criar senha nas duas versões', () => {
  const e = emailBienvenida({ nombre: 'Lucía', enlace: 'https://app.example.com/crear?token=abc&x=1' });
  assert.equal(e.asunto, 'Tu acceso al curso de portugués');
  assert.ok(e.texto.startsWith('Hola, Lucía:'));
  assert.ok(e.texto.includes('https://app.example.com/crear?token=abc&x=1'));
  assert.ok(e.html.includes('href="https://app.example.com/crear?token=abc&amp;x=1"'));
  assert.ok(e.html.includes('Crear mi contraseña'));
  assert.ok(e.texto.includes('Tu cuenta en la plataforma ya está lista.'));
  assert.equal(e.texto.includes('compra'), false, 'sem compra, o e-mail não fala em compra');
  const comprou = emailBienvenida({ nombre: 'Lucía', enlace: 'https://app.example.com/crear', compra: true });
  assert.ok(comprou.texto.includes('Tu compra está confirmada y tu acceso ya está activo.'));
});

test('sem nome, a saudação fica neutra', () => {
  assert.ok(emailRestablecer({ nombre: '  ', enlace: 'https://app.example.com/r' }).texto.startsWith('Hola:'));
});

test('reserva confirmada traz tema, data local, duração, prazo e link do Meet', () => {
  const e = emailReservaConfirmada({ ...clase, duracionMin: 60, cancelarHastaHoras: 2, material: 'https://app.example.com/m.pdf' });
  assert.equal(e.asunto, 'Reserva confirmada: En el restaurante');
  for (const trecho of ['jueves, 8 de octubre de 2026, 20:00', '60 minutos', 'hasta 2 horas antes', clase.meetUrl, 'https://app.example.com/m.pdf']) {
    assert.ok(e.texto.includes(trecho), trecho);
  }
  assert.ok(e.html.includes(`href="${clase.meetUrl}"`));
  assert.ok(emailReservaConfirmada({ ...clase, duracionMin: 60, cancelarHastaHoras: 1 }).texto.includes('hasta 1 hora antes'));
});

test('lembrete, cancelamento pelo aluno e cancelamento pelo professor', () => {
  assert.equal(emailRecordatorio({ ...clase, falta: '1 hora' }).asunto, 'Tu clase empieza en 1 hora: En el restaurante');
  assert.ok(emailRecordatorio({ ...clase, falta: '24 horas' }).texto.includes(clase.meetUrl));
  const cancelada = emailReservaCancelada(clase);
  assert.ok(cancelada.texto.includes('puedes elegir otra clase'));
  assert.equal(cancelada.texto.includes('meet.google.com'), false);
  const peloProfessor = emailClaseCancelada({ ...clase, agenda: 'https://app.example.com/conversacion' });
  assert.ok(peloProfessor.texto.includes('cancelada por el profesor'));
  assert.ok(peloProfessor.html.includes('href="https://app.example.com/conversacion"'));
});

test('dados do aluno e do tema nunca entram como HTML', () => {
  assert.equal(escaparHtml(`<b>"x" & 'y'</b>`), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  const e = emailReservaConfirmada({ ...clase, nombre: '<script>alert(1)</script>', tema: '<img src=x onerror=alert(1)>', duracionMin: 60, cancelarHastaHoras: 2 });
  assert.equal(e.html.includes('<script>'), false);
  assert.equal(e.html.includes('<img'), false);
  assert.ok(e.html.includes('&lt;script&gt;'));
});

test('link que não é https é recusado', () => {
  for (const ruim of ['javascript:alert(1)', 'http://inseguro.example.com', 'https://a.example.com/" onclick="x', '']) {
    assert.throws(() => emailBienvenida({ nombre: 'Ana', enlace: ruim }), /enlace_invalido/, ruim);
  }
  assert.throws(() => emailReservaConfirmada({ ...clase, duracionMin: 60, cancelarHastaHoras: 2, material: 'javascript:x' }), /enlace_invalido/);
});

test('link http só é aceito para o próprio computador, usado nos testes', () => {
  for (const local of ['http://127.0.0.1:3000/auth/confirmar?token_hash=abc', 'http://localhost:3000/x']) {
    assert.ok(emailBienvenida({ nombre: 'Ana', enlace: local }).texto.includes(local), local);
  }
  for (const ruim of ['http://127.0.0.1.evil.example.com/x', 'http://localhost.evil.example.com/x', 'http://127.0.0.1:3000']) {
    assert.throws(() => emailBienvenida({ nombre: 'Ana', enlace: ruim }), /enlace_invalido/, ruim);
  }
});
