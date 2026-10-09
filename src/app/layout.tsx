import type { Metadata, Viewport } from 'next';
import { Figtree, Playfair_Display } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const figtree = Figtree({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-figtree',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Português com João Paulo',
    template: '%s · Português com João Paulo',
  },
  description: 'Portugués de Brasil para hispanohablantes, con el profesor João Paulo Alves.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#075e54',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${figtree.variable} ${playfair.variable}`}>
      <body className="bg-fundo font-interface text-texto antialiased">{children}</body>
    </html>
  );
}
