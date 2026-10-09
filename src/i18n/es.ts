// Textos da interface do aluno, em espanhol neutro (Espanha e América Latina).

export const es = {
  comum: {
    salir: 'Salir',
  },
  marca: {
    nome: 'Português',
    com: 'com',
    professor: 'João Paulo',
  },
  acesso: {
    area: 'ÁREA DEL ALUMNO',
    lema: 'Tu portugués de Brasil empieza aquí',
    professor: 'Prof. João Paulo Alves · brasileño nativo, más de 7.300 clases impartidas',
    fotoAlt: 'Profesor João Paulo Alves',
    volver: 'Volver al acceso',
  },
  entrar: {
    titulo: 'Entra a tus clases',
    correo: 'Correo electrónico de tu compra',
    correoEjemplo: 'tucorreo@email.com',
    clave: 'Tu contraseña',
    claveEjemplo: 'Mínimo 8 caracteres',
    mostrarClave: 'Mostrar contraseña',
    ocultarClave: 'Ocultar contraseña',
    boton: 'Acceder a mis clases',
    primerAcceso: '¿Primer acceso? Crear mi contraseña',
    olvide: 'Olvidé mi contraseña',
    errores: {
      credenciales: 'El correo o la contraseña no coinciden.',
      datos: 'Escribe tu correo y una contraseña de al menos 8 caracteres.',
    },
  },
  inicio: {
    titulo: 'Inicio',
    saludo: 'Hola',
    enConstruccion: 'Tu acceso está activo. Estamos preparando tu curso: muy pronto lo verás aquí.',
  },
  primerAcceso: {
    titulo: 'Crea tu contraseña',
    texto: 'Escribe el correo de tu compra y te enviaremos un enlace para crear tu contraseña.',
    boton: 'Enviar enlace',
  },
  recuperar: {
    titulo: 'Recupera tu contraseña',
    texto: 'Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.',
    boton: 'Enviar enlace',
  },
} as const;
