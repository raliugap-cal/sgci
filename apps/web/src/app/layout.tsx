// ROOT LAYOUT — Server Component (obligatorio en Next.js 14)
// QueryClient va en Providers (componente client separado)
import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300','400','500','600'] });

export const metadata: Metadata = {
  title: 'SGCI — Sistema de Gestión Clínica Integral',
  description: 'Sistema de gestión clínica para México · NOM-004 · NOM-028 · CFDI 4.0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${dmSans.className} bg-slate-50`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
