'use client';

import { useState } from 'react';

import { deleteService } from '@/lib/services';

interface DeleteServiceButtonProps {
    serviceId: string;
    serviceName: string;
    onDeleted: (id: string) => void;
}

export default function DeleteServiceButton({
    serviceId,
    serviceName,
    onDeleted,
}: DeleteServiceButtonProps) {
    const [confirming, setConfirming] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleDelete() {
        setLoading(true);
        setError('');
        try {
            await deleteService(serviceId);
            onDeleted(serviceId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
            setConfirming(false);
        } finally {
            setLoading(false);
        }
    }

    if (confirming) {
        return (
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                    Delete &quot;{serviceName}&quot;?
                </span>
                <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                    {loading ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                    onClick={() => setConfirming(false)}
                    disabled={loading}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                    Cancel
                </button>
                {error && <span className="text-xs text-red-600">{error}</span>}
            </div>
        );
    }

    return (
        <button
            onClick={() => setConfirming(true)}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
        >
            Delete
        </button>
    );
}
