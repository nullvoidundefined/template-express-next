'use client';

import { useState } from 'react';

interface PublicScreenshotThumbnailProps {
    serviceId: string;
}

export default function PublicScreenshotThumbnail({
    serviceId,
}: PublicScreenshotThumbnailProps) {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    const screenshotUrl = `${API_BASE}/api/v1/status/${serviceId}/screenshot`;

    const [hasError, setHasError] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    if (hasError) {
        return null;
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="mt-3 block cursor-zoom-in overflow-hidden rounded border border-gray-200 shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="View screenshot"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={screenshotUrl}
                    alt="Service screenshot"
                    loading="lazy"
                    style={{ maxWidth: '260px', display: 'block' }}
                    onError={() => setHasError(true)}
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
