import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface PublicPageLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
  maxWidthClassName?: string;
}

export function PublicPageLayout({
  title,
  description,
  children,
  contentClassName = '',
  maxWidthClassName = 'max-w-4xl',
}: PublicPageLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#101010]">
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className={`mx-auto w-full ${maxWidthClassName}`}>
          <div className="mb-8">
            <h1 className="text-balance text-3xl font-bold text-white sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 text-pretty text-sm leading-7 text-gray-300 sm:text-base">
                {description}
              </p>
            ) : null}
          </div>

          <div className={`rounded-2xl border border-[#2b2b2b] bg-white p-6 shadow-sm sm:p-8 ${contentClassName}`.trim()}>
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
