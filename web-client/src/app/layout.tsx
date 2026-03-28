import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';

import './globals.css';

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
                <header className="border-b border-gray-200 bg-white">
                    <div className="mx-auto max-w-6xl px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 sm:gap-6">
                                <Link
                                    href="/"
                                    className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                                >
                                    System Status
                                </Link>
                                <Link
                                    href="/admin"
                                    className="text-sm font-medium text-gray-600 hover:text-gray-900"
                                >
                                    Admin
                                </Link>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4">
                                <Link
                                    href="/login"
                                    className="text-sm font-medium text-gray-600 hover:text-gray-900"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/account"
                                    className="rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                                >
                                    Account
                                </Link>
                            </div>
                        </div>
                    </div>
                </header>
                <main className="min-w-0">{children}</main>
            </body>
        </html>
    );
}
