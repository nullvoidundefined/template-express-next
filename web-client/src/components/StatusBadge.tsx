type OverallStatus = 'operational' | 'degraded' | 'outage';

interface StatusBadgeProps {
    status: OverallStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    const config: Record<
        OverallStatus,
        { dotClass: string; bgClass: string; textClass: string; label: string }
    > = {
        operational: {
            dotClass: 'bg-green-500',
            bgClass: 'bg-green-50 border-green-200',
            textClass: 'text-green-800',
            label: 'All Systems Operational',
        },
        degraded: {
            dotClass: 'bg-yellow-500',
            bgClass: 'bg-yellow-50 border-yellow-200',
            textClass: 'text-yellow-800',
            label: 'Degraded Performance',
        },
        outage: {
            dotClass: 'bg-red-500',
            bgClass: 'bg-red-50 border-red-200',
            textClass: 'text-red-800',
            label: 'Major Outage',
        },
    };

    const { dotClass, bgClass, textClass, label } = config[status];

    return (
        <div
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${bgClass}`}
        >
            <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`}
            />
            <span className={`text-sm font-semibold ${textClass}`}>
                {label}
            </span>
        </div>
    );
}
