import type { DayUptime, ServiceStatus } from '@/types';

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
}

const statusConfig: Record<
    ServiceStatus,
    { dot: string; label: string; text: string }
> = {
    up: { dot: 'bg-green-500', label: 'Operational', text: 'text-green-700' },
    degraded: {
        dot: 'bg-yellow-500',
        label: 'Degraded',
        text: 'text-yellow-700',
    },
    down: { dot: 'bg-red-500', label: 'Down', text: 'text-red-700' },
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

export default function ServiceStatusCard({
    id,
    name,
    url,
    status,
    uptime_percent_30d,
    response_time_avg_30d,
    last_checked_at,
    uptimeHistory,
}: ServiceStatusCardProps) {
    const { dot, label, text } = statusConfig[status] ?? statusConfig.down;

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
                <div>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-gray-900 hover:text-blue-600"
                    >
                        {name}
                    </a>
                    <p className="max-w-xs truncate text-xs text-gray-500">
                        {url}
                    </p>
                </div>
                <div className={`flex items-center gap-1.5 ${text}`}>
                    <span
                        className={`inline-block h-2 w-2 rounded-full ${dot}`}
                    />
                    <span className="text-sm font-medium">{label}</span>
                </div>
            </div>

            <div className="mb-4 flex gap-6 text-xs text-gray-500">
                <div>
                    <span className="font-medium text-gray-700">
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

            <UptimeBar history={uptimeHistory} />

            <PublicScreenshotThumbnail serviceId={id} />
        </div>
    );
}
