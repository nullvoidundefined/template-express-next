import { Suspense } from 'react';

import ActiveIncidents from '@/components/ActiveIncidents';
import ServiceStatusCard from '@/components/ServiceStatusCard';
import StatusBadge from '@/components/StatusBadge';
import StatusPageAutoRefresh from '@/components/StatusPageAutoRefresh';
import { getPublicStatus } from '@/lib/status';

async function StatusContent() {
    let status;
    try {
        status = await getPublicStatus();
    } catch {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                Unable to load status. Please try again later.
            </div>
        );
    }

    const serviceNames = Object.fromEntries(
        status.services.map((s) => [s.id, s.name]),
    );

    // Build per-service uptime history map (90d)
    const uptimeByService = new Map<string, typeof status.uptime_history_90d>(
        status.services.map((s) => [s.id, []]),
    );
    // The API returns global uptime_history_90d — fall back to that for all services
    for (const svc of status.services) {
        uptimeByService.set(svc.id, status.uptime_history_90d);
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                    System Status
                </h1>
                <StatusBadge status={status.overall} />
            </div>

            {status.active_incidents.length > 0 && (
                <ActiveIncidents
                    incidents={status.active_incidents}
                    serviceNames={serviceNames}
                />
            )}

            <div>
                <h2 className="mb-4 text-lg font-semibold text-gray-700">
                    Services
                </h2>
                {status.services.length === 0 ? (
                    <p className="text-sm text-gray-500">
                        No services configured yet.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {status.services.map((service) => (
                            <ServiceStatusCard
                                key={service.id}
                                id={service.id}
                                name={service.name}
                                url={service.url}
                                status={service.status}
                                uptime_percent_30d={service.uptime_percent_30d}
                                response_time_avg_30d={
                                    service.response_time_avg_30d
                                }
                                last_checked_at={service.last_checked_at}
                                uptimeHistory={
                                    uptimeByService.get(service.id) ?? []
                                }
                                ciStatus={service.github?.ci_status ?? null}
                            />
                        ))}
                    </div>
                )}
            </div>

            {status.active_incidents.length === 0 && (
                <ActiveIncidents incidents={[]} />
            )}
        </div>
    );
}

export default function HomePage() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
            <StatusPageAutoRefresh />
            <Suspense
                fallback={
                    <div className="text-center text-sm text-gray-500">
                        Loading status...
                    </div>
                }
            >
                <StatusContent />
            </Suspense>
        </div>
    );
}
