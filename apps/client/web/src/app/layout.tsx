import { ModalProvider } from '@/components/ui/Modal/Modal';
import { ToastViewport } from '@/components/ui/Toast/Toast';
import { PostHogProvider } from '@/providers/PostHogProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.scss';

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

export const metadata: Metadata = {
  description: 'Express 5 + Next.js 15 full-stack application',
  title: 'App',
};

function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en'>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('app-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.dataset.theme='dark'}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <PostHogProvider>
          <QueryProvider>
            {children}
            <ToastViewport />
            <ModalProvider />
          </QueryProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}

RootLayout.displayName = 'RootLayout';

export default RootLayout;
