import type { Incident } from '@/types';

interface ActiveIncidentsProps {
    incidents: Incident[];
    serviceNames?: Record<string, string>;
}

const incidentStatusColors: Record<string, string> = {
    investigating: 'bg-red-100 text-red-700',
    identified: 'bg-orange-100 text-orange-700',
    monitoring: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
};

function formatDate(ts: string): string {
    return new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ActiveIncidents({
    incidents,
    serviceNames = {},
}: ActiveIncidentsProps) {
    if (incidents.length === 0) {
        return (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
                No active incidents
            </div>
        );
    }

    return (
        <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Active Incidents
            </h2>
            <div className="space-y-3">
                {incidents.map((incident) => (
                    <div
                        key={incident.id}
                        className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-semibold text-gray-900">
                                    {incident.title}
                                </p>
                                {serviceNames[incident.service_id] && (
                                    <p className="mt-0.5 text-xs text-gray-500">
                                        {serviceNames[incident.service_id]}
                                    </p>
                                )}
                                {incident.cause && (
                                    <p className="mt-1 text-sm text-gray-600">
                                        {incident.cause}
                                    </p>
                                )}
                            </div>
                            <span
                                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${incidentStatusColors[incident.status] ?? 'bg-gray-100 text-gray-700'}`}
                            >
                                {incident.status}
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Started {formatDate(incident.started_at)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
