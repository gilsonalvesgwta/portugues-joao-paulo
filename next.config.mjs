// Cabeçalhos de segurança de todas as respostas:
// - a plataforma nunca abre dentro de outra página (golpe de clique escondido);
// - o navegador não adivinha o tipo dos arquivos;
// - sites de fora recebem só o endereço da plataforma, nunca a página em que o aluno estava;
// - câmera, microfone, localização e pagamento ficam desligados;
// - formulários só enviam para a própria plataforma, e os únicos quadros de fora são os do YouTube;
// - depois da primeira visita, o navegador só usa a plataforma por https.
const SEGURANCA = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  {
    key: 'Content-Security-Policy',
    value:
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gera uma pasta autossuficiente para a imagem Docker que roda na VPS.
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SEGURANCA }];
  },
};

export default nextConfig;
