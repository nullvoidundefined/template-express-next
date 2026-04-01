'use client';

import { useEffect, useState } from 'react';

interface ScreenshotViewerProps {
    serviceId: string;
}

export default function ScreenshotViewer({ serviceId }: ScreenshotViewerProps) {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    const screenshotUrl = `${API_BASE}/api/v1/services/${serviceId}/screenshot`;

    const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
        'loading',
    );
    const [lightboxOpen, setLightboxOpen] = useState(false);

    // Check if screenshot exists by probing the URL
    useEffect(() => {
        setStatus('loading');
        const img = new Image();
        img.onload = () => setStatus('loaded');
        img.onerror = () => setStatus('error');
        // Add cache-busting to always check freshness
        img.src = `${screenshotUrl}?t=${Date.now()}`;
    }, [screenshotUrl]);

    if (status === 'loading') {
        return (
            <div className="flex h-40 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
                Loading screenshot&hellip;
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400">
                No screenshot available yet
            </div>
        );
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="View full-size screenshot"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={screenshotUrl}
                    alt="Service screenshot"
                    style={{ maxWidth: '300px', display: 'block' }}
                    loading="lazy"
                />
            </button>

            {lightboxOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setLightboxOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Screenshot lightbox"
                >
                    <div
                        className="relative max-h-full max-w-full overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setLightboxOpen(false)}
                            className="absolute right-2 top-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-gray-800 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Close lightbox"
                        >
                            Close
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={screenshotUrl}
                            alt="Service screenshot (full size)"
                            className="max-h-screen rounded-md shadow-xl"
                            style={{ maxWidth: '90vw' }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
