import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { cn } from '../utils/cn';

interface SitePageLayoutProps {
  children: ReactNode;
  maxWidthClassName?: string;
  mainClassName?: string;
}

export function SitePageLayout({
  children,
  maxWidthClassName = 'max-w-6xl',
  mainClassName,
}: SitePageLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#101010]">
      <Header />
      <main className={cn('flex-1 px-4 py-8 sm:px-6', mainClassName)}>
        <div className={cn('mx-auto w-full', maxWidthClassName)}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
