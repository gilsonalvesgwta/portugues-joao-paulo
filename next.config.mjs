/** @type {import('next').NextConfig} */
const nextConfig = {
  // Gera uma pasta autossuficiente para a imagem Docker que roda na VPS.
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
