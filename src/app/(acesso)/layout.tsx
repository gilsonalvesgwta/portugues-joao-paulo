import type { ReactNode } from 'react';
import { MolduraDeAcesso } from '@/components/acesso/Moldura';

export default function LayoutDeAcesso({ children }: { children: ReactNode }) {
  return <MolduraDeAcesso>{children}</MolduraDeAcesso>;
}
