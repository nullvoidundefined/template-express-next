import Link from 'next/link';

import type { Service, ServiceStatus } from '@/types';

import DeleteServiceButton from './DeleteServiceButton';

interface ServiceAdminCardProps {
    service: Service & { uptime_percent?: number; response_time_avg?: number };
    onEdit: (service: Service) => void;
    onDeleted: (id: string) => void;
}

const statusConfig: Record<
    ServiceStatus,
    { dot: string; label: string; text: string }
> = {
    up: { dot: 'bg-green-500', label: 'Up', text: 'text-green-700' },
    degraded: {
        dot: 'bg-yellow-500',
        label: 'Degraded',
        text: 'text-yellow-700',
    },
    down: { dot: 'bg-red-500', label: 'Down', text: 'text-red-700' },
};

export default function ServiceAdminCard({
    service,
    onEdit,
    onDeleted,
}: ServiceAdminCardProps) {
    const statusKey = service.status ?? 'down';
    const { dot, label, text } = statusConfig[statusKey];

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <Link
                        href={`/admin/services/${service.id}`}
                        className="block truncate text-sm font-semibold text-gray-900 hover:text-blue-600"
                    >
                        {service.name}
                    </Link>
                    <a
                        href={service.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-xs text-gray-500 hover:text-blue-500"
                    >
                        {service.url}
                    </a>
                </div>
                <div className={`flex shrink-0 items-center gap-1 ${text}`}>
                    <span
                        className={`inline-block h-2 w-2 rounded-full ${dot}`}
                    />
                    <span className="text-xs font-medium">{label}</span>
                </div>
            </div>

            <div className="mb-4 flex gap-4 text-xs text-gray-500">
                {service.uptime_percent !== undefined && (
                    <span>
                        <strong className="text-gray-700">
                            {service.uptime_percent.toFixed(1)}%
                        </strong>{' '}
                        uptime
                    </span>
                )}
                {service.response_time_avg !== undefined && (
                    <span>
                        <strong className="text-gray-700">
                            {Math.round(service.response_time_avg)}ms
                        </strong>{' '}
                        avg
                    </span>
                )}
                {service.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {service.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <Link
                    href={`/admin/services/${service.id}`}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                    View
                </Link>
                <button
                    onClick={() => onEdit(service)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                    Edit
                </button>
                <DeleteServiceButton
                    serviceId={service.id}
                    serviceName={service.name}
                    onDeleted={onDeleted}
                />
            </div>
        </div>
    );
}
