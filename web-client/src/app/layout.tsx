import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';

import './globals.scss';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Deployments Health Check Dashboard',
    description:
        'Self-hosted uptime monitoring and status page for deployed projects',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable}`}>
                <nav style={{ padding: '1rem', display: 'flex', gap: '1rem' }}>
                    <Link href="/">Home</Link>
                    <Link href="/account">Account</Link>
                    <Link href="/login">Login</Link>
                    <Link href="/register">Register</Link>
                </nav>
                {children}
            </body>
        </html>
    );
}
