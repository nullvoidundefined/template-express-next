import type { DayUptime, ServiceStatus, WorkflowStatus } from '@/types';

import PublicScreenshotThumbnail from './PublicScreenshotThumbnail';
import UptimeBar from './UptimeBar';

interface ServiceStatusCardProps {
    id: string;
    name: string;
    url: string;
    status: ServiceStatus;
    uptime_percent_30d: number;
    response_time_avg_30d: number;
    last_checked_at: string | null;
    uptimeHistory: DayUptime[];
    ciStatus?: WorkflowStatus | null;
    workflowRunUrl?: string | null;
}

const statusConfig: Record<
    ServiceStatus,
    { dot: string; label: string; text: string; bg: string }
> = {
    up: {
        dot: 'bg-green-500',
        label: 'Operational',
        text: 'text-green-700',
        bg: 'bg-green-50',
    },
    degraded: {
        dot: 'bg-yellow-500',
        label: 'Degraded',
        text: 'text-yellow-700',
        bg: 'bg-yellow-50',
    },
    down: {
        dot: 'bg-red-500',
        label: 'Down',
        text: 'text-red-700',
        bg: 'bg-red-50',
    },
};

function formatLastChecked(ts: string | null): string {
    if (!ts) {
        return 'Never';
    }
    const diff = Date.now() - new Date(ts).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) {
        return 'Just now';
    }
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    return `${Math.floor(hours / 24)}d ago`;
}

const ciStatusConfig: Record<
    WorkflowStatus,
    { dot: string; label: string; textClass: string }
> = {
    success: {
        dot: 'bg-green-500',
        label: 'passing',
        textClass: 'text-green-700',
    },
    failure: { dot: 'bg-red-500', label: 'failing', textClass: 'text-red-700' },
    pending: {
        dot: 'bg-yellow-400',
        label: 'running',
        textClass: 'text-yellow-700',
    },
    cancelled: {
        dot: 'bg-gray-400',
        label: 'cancelled',
        textClass: 'text-gray-500',
    },
};

export default function ServiceStatusCard({
    id,
    name,
    url,
    status,
    uptime_percent_30d,
    response_time_avg_30d,
    last_checked_at,
    uptimeHistory,
    ciStatus,
    workflowRunUrl,
}: ServiceStatusCardProps) {
    const { dot, label, text } = statusConfig[status] ?? statusConfig.down;

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            {/* Header row: stacks vertically on mobile */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-base font-semibold text-gray-900 hover:text-blue-600"
                    >
                        {name}
                    </a>
                    <p className="truncate text-xs text-gray-500">{url}</p>
                </div>
                <div
                    className={`flex shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${statusConfig[status]?.bg ?? 'bg-gray-50'} ${text}`}
                >
                    <span
                        className={`inline-block h-2 w-2 rounded-full ${dot}`}
                    />
                    <span className="text-sm font-medium">{label}</span>
                </div>
            </div>

            {/* Stats row: wraps gracefully on small screens */}
            <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                <div>
                    <span className="text-sm font-bold text-gray-900">
                        {uptime_percent_30d.toFixed(2)}%
                    </span>{' '}
                    uptime (30d)
                </div>
                <div>
                    <span className="font-medium text-gray-700">
                        {Math.round(response_time_avg_30d)}ms
                    </span>{' '}
                    avg response
                </div>
                <div>
                    Checked{' '}
                    <span className="font-medium text-gray-700">
                        {formatLastChecked(last_checked_at)}
                    </span>
                </div>
            </div>

            {ciStatus && (
                <div className="mb-3 flex items-center gap-1.5 text-xs">
                    <span className="text-gray-500">CI:</span>
                    {workflowRunUrl ? (
                        <a
                            href={workflowRunUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1 font-medium hover:underline ${ciStatusConfig[ciStatus].textClass}`}
                        >
                            <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${ciStatusConfig[ciStatus].dot}`}
                            />
                            {ciStatusConfig[ciStatus].label}
                        </a>
                    ) : (
                        <span
                            className={`flex items-center gap-1 font-medium ${ciStatusConfig[ciStatus].textClass}`}
                        >
                            <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${ciStatusConfig[ciStatus].dot}`}
                            />
                            {ciStatusConfig[ciStatus].label}
                        </span>
                    )}
                </div>
            )}

            <UptimeBar history={uptimeHistory} />

            <PublicScreenshotThumbnail serviceId={id} />
        </div>
    );
}
