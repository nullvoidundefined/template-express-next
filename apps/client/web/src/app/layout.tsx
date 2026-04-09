import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { QueryProvider } from '@/providers/QueryProvider';

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
    description: 'Express 5 + Next.js 15 + TypeScript monorepo template',
    title: 'template-express-next',
};

function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable}`}>
                <QueryProvider>{children}</QueryProvider>
            </body>
        </html>
    );
}

RootLayout.displayName = 'RootLayout';

export default RootLayout;
