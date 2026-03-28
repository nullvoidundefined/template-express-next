import type { Check } from '@/types';

interface CheckDetailsProps {
    check: Check;
}

function Row({
    label,
    value,
    status,
}: {
    label: string;
    value: React.ReactNode;
    status?: 'pass' | 'fail' | 'neutral';
}) {
    const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : null;
    const iconColor =
        status === 'pass'
            ? 'text-green-600'
            : status === 'fail'
              ? 'text-red-600'
              : '';

    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                    {value}
                </span>
                {icon && (
                    <span className={`text-sm font-bold ${iconColor}`}>
                        {icon}
                    </span>
                )}
            </div>
        </div>
    );
}

function formatTlsExpiry(ts: string | null): string {
    if (!ts) {
        return 'N/A';
    }
    const date = new Date(ts);
    const daysLeft = Math.ceil(
        (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return `${date.toLocaleDateString()} (${daysLeft > 0 ? `${daysLeft}d left` : 'expired'})`;
}

export default function CheckDetails({ check }: CheckDetailsProps) {
    const statusConfig = {
        up: 'bg-green-100 text-green-800',
        degraded: 'bg-yellow-100 text-yellow-800',
        down: 'bg-red-100 text-red-800',
    };

    return (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-4">
                <div className="flex items-center justify-between">
                    <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusConfig[check.status] ?? 'bg-gray-100 text-gray-800'}`}
                    >
                        {check.status}
                    </span>
                    <span className="text-xs text-gray-400">
                        {new Date(check.checked_at).toLocaleString()}
                    </span>
                </div>
            </div>
            <div className="divide-y divide-gray-100 px-4">
                <Row
                    label="HTTP Status Code"
                    value={check.status_code ?? 'N/A'}
                    status={
                        check.status_code
                            ? check.status_code < 400
                                ? 'pass'
                                : 'fail'
                            : 'neutral'
                    }
                />
                <Row
                    label="Response Time"
                    value={
                        check.response_time_ms !== null
                            ? `${check.response_time_ms}ms`
                            : 'N/A'
                    }
                    status={
                        check.response_time_ms !== null
                            ? check.response_time_ms < 500
                                ? 'pass'
                                : check.response_time_ms < 2000
                                  ? 'neutral'
                                  : 'fail'
                            : 'neutral'
                    }
                />
                <Row
                    label="DNS Resolution Time"
                    value={
                        check.dns_time_ms !== null
                            ? `${check.dns_time_ms}ms`
                            : 'N/A'
                    }
                />
                <Row
                    label="TLS Valid"
                    value={
                        check.tls_valid === null
                            ? 'N/A'
                            : check.tls_valid
                              ? 'Yes'
                              : 'No'
                    }
                    status={
                        check.tls_valid === null
                            ? 'neutral'
                            : check.tls_valid
                              ? 'pass'
                              : 'fail'
                    }
                />
                <Row
                    label="TLS Expires"
                    value={formatTlsExpiry(check.tls_expires_at)}
                />
                {check.error_message && (
                    <div className="py-3">
                        <p className="text-sm text-gray-600">Error</p>
                        <p className="mt-1 rounded bg-red-50 p-2 text-xs text-red-700">
                            {check.error_message}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
