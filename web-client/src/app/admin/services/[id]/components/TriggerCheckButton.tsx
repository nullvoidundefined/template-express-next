'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { triggerCheck } from '@/lib/services';

interface TriggerCheckButtonProps {
    serviceId: string;
}

export default function TriggerCheckButton({
    serviceId,
}: TriggerCheckButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    async function handleClick() {
        setLoading(true);
        setMessage('');
        try {
            await triggerCheck(serviceId);
            setMessage('Check triggered!');
            setTimeout(() => {
                router.refresh();
                setMessage('');
            }, 1500);
        } catch (err) {
            setMessage(
                err instanceof Error ? err.message : 'Failed to trigger check',
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handleClick}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? (
                    <span className="flex items-center gap-2">
                        <svg
                            className="h-3.5 w-3.5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                        </svg>
                        Running...
                    </span>
                ) : (
                    'Run Check Now'
                )}
            </button>
            {message && (
                <span className="text-xs text-gray-600">{message}</span>
            )}
        </div>
    );
}
