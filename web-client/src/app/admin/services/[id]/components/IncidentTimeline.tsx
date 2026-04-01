'use client';

import { useState } from 'react';

import { createIncident, updateIncident } from '@/lib/services';
import type { Incident, IncidentStatus } from '@/types';

interface IncidentTimelineProps {
    incidents: Incident[];
    serviceId: string;
}

const statusColors: Record<IncidentStatus, string> = {
    investigating: 'bg-red-100 text-red-700',
    identified: 'bg-orange-100 text-orange-700',
    monitoring: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
};

const STATUS_OPTIONS: IncidentStatus[] = [
    'investigating',
    'identified',
    'monitoring',
    'resolved',
];

function formatDate(ts: string): string {
    return new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function IncidentTimeline({
    incidents: initialIncidents,
    serviceId,
}: IncidentTimelineProps) {
    const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [cause, setCause] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Track which incident is being edited
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editStatus, setEditStatus] =
        useState<IncidentStatus>('investigating');
    const [editCause, setEditCause] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) {
            return;
        }
        setLoading(true);
        setError('');
        try {
            const created = await createIncident(serviceId, {
                title: title.trim(),
                cause: cause.trim() || undefined,
            });
            setIncidents((prev) => [created, ...prev]);
            setTitle('');
            setCause('');
            setShowForm(false);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to create incident',
            );
        } finally {
            setLoading(false);
        }
    }

    function startEdit(incident: Incident) {
        setEditingId(incident.id);
        setEditStatus(incident.status);
        setEditCause(incident.cause ?? '');
        setEditError('');
    }

    function cancelEdit() {
        setEditingId(null);
        setEditError('');
    }

    async function handleUpdate(incidentId: string) {
        setEditLoading(true);
        setEditError('');
        try {
            const updated = await updateIncident(incidentId, {
                status: editStatus,
                cause: editCause.trim() || undefined,
            });
            setIncidents((prev) =>
                prev.map((inc) => (inc.id === incidentId ? updated : inc)),
            );
            setEditingId(null);
        } catch (err) {
            setEditError(
                err instanceof Error
                    ? err.message
                    : 'Failed to update incident',
            );
        } finally {
            setEditLoading(false);
        }
    }

    return (
        <div>
            <div className="mb-4 flex justify-end">
                <button
                    onClick={() => setShowForm((v) => !v)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                    {showForm ? 'Cancel' : '+ Create Incident'}
                </button>
            </div>

            {showForm && (
                <form
                    onSubmit={handleCreate}
                    className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                    <h3 className="mb-3 text-sm font-semibold text-gray-700">
                        Create Incident
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                                Title *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Service outage"
                                required
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                                Cause / Notes
                            </label>
                            <textarea
                                value={cause}
                                onChange={(e) => setCause(e.target.value)}
                                placeholder="Describe what happened..."
                                rows={3}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    {error && (
                        <p className="mt-2 text-xs text-red-600">{error}</p>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </form>
            )}

            {incidents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                    No incidents recorded
                </div>
            ) : (
                <div className="space-y-3">
                    {incidents.map((incident) =>
                        editingId === incident.id ? (
                            <div
                                key={incident.id}
                                className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm"
                            >
                                <h4 className="mb-3 text-sm font-semibold text-gray-700">
                                    Update Incident
                                </h4>
                                <p className="mb-3 font-medium text-gray-900">
                                    {incident.title}
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-gray-600">
                                            Status
                                        </label>
                                        <select
                                            value={editStatus}
                                            onChange={(e) =>
                                                setEditStatus(
                                                    e.target
                                                        .value as IncidentStatus,
                                                )
                                            }
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                        >
                                            {STATUS_OPTIONS.map((s) => (
                                                <option key={s} value={s}>
                                                    {s.charAt(0).toUpperCase() +
                                                        s.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-gray-600">
                                            Cause / Notes
                                        </label>
                                        <textarea
                                            value={editCause}
                                            onChange={(e) =>
                                                setEditCause(e.target.value)
                                            }
                                            placeholder="Add notes about the incident..."
                                            rows={3}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                {editError && (
                                    <p className="mt-2 text-xs text-red-600">
                                        {editError}
                                    </p>
                                )}
                                <div className="mt-3 flex justify-end gap-2">
                                    <button
                                        onClick={cancelEdit}
                                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleUpdate(incident.id)
                                        }
                                        disabled={editLoading}
                                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {editLoading ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                key={incident.id}
                                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-gray-900">
                                            {incident.title}
                                        </p>
                                        {incident.cause && (
                                            <p className="mt-1 text-sm text-gray-500">
                                                {incident.cause}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[incident.status] ?? 'bg-gray-100 text-gray-700'}`}
                                        >
                                            {incident.status}
                                        </span>
                                        {incident.status !== 'resolved' && (
                                            <button
                                                onClick={() =>
                                                    startEdit(incident)
                                                }
                                                className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                            >
                                                Update
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-2 flex gap-4 text-xs text-gray-400">
                                    <span>
                                        Started{' '}
                                        {formatDate(incident.started_at)}
                                    </span>
                                    {incident.resolved_at && (
                                        <span>
                                            Resolved{' '}
                                            {formatDate(incident.resolved_at)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ),
                    )}
                </div>
            )}
        </div>
    );
}
