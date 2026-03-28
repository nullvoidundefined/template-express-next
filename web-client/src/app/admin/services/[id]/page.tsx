import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getChecks, getIncidents, getService } from '@/lib/services';

import CheckDetails from './components/CheckDetails';
import IncidentTimeline from './components/IncidentTimeline';
import ResponseTimeChart from './components/ResponseTimeChart';
import TriggerCheckButton from './components/TriggerCheckButton';

async function getSessionUser() {
    try {
        const API_BASE =
            process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
            cache: 'no-store',
        });
        if (!res.ok) {
            return null;
        }
        const data = await res.json();
        return data?.user ?? null;
    } catch {
        return null;
    }
}

interface Props {
    params: Promise<{ id: string }>;
}

export default async function ServiceDetailPage({ params }: Props) {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user) {
        redirect('/login');
    }

    let service;
    try {
        service = await getService(id);
    } catch {
        return (
            <div className="mx-auto max-w-4xl px-4 py-8">
                <p className="text-red-600">Service not found.</p>
                <Link
                    href="/admin"
                    className="mt-4 inline-block text-sm text-blue-600 hover:underline"
                >
                    Back to Admin
                </Link>
            </div>
        );
    }

    const [checksResult, incidentsResult] = await Promise.allSettled([
        getChecks(id, { limit: 200 }),
        getIncidents(id),
    ]);

    const checks =
        checksResult.status === 'fulfilled' ? checksResult.value.data : [];
    const incidentList =
        incidentsResult.status === 'fulfilled' ? incidentsResult.value : [];
    const latestCheck = checks[0] ?? null;

    const statusConfig = {
        up: { dot: 'bg-green-500', text: 'text-green-700', label: 'Up' },
        degraded: {
            dot: 'bg-yellow-500',
            text: 'text-yellow-700',
            label: 'Degraded',
        },
        down: { dot: 'bg-red-500', text: 'text-red-700', label: 'Down' },
    };
    const currentStatus = service.status ?? 'down';
    const { dot, text, label } =
        statusConfig[currentStatus] ?? statusConfig.down;

    return (
        <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
            <div>
                <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                    <Link href="/admin" className="hover:text-blue-600">
                        Admin
                    </Link>
                    <span>/</span>
                    <span>{service.name}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {service.name}
                        </h1>
                        <a
                            href={service.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            {service.url}
                        </a>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 ${text}`}>
                            <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`}
                            />
                            <span className="text-sm font-semibold">
                                {label}
                            </span>
                        </div>
                        <TriggerCheckButton serviceId={id} />
                    </div>
                </div>
            </div>

            {latestCheck && (
                <div>
                    <h2 className="mb-3 text-lg font-semibold text-gray-800">
                        Latest Check
                    </h2>
                    <CheckDetails check={latestCheck} />
                </div>
            )}

            <div>
                <h2 className="mb-3 text-lg font-semibold text-gray-800">
                    Response Time
                </h2>
                <ResponseTimeChart data={checks} />
            </div>

            <div>
                <h2 className="mb-3 text-lg font-semibold text-gray-800">
                    Incidents
                </h2>
                <IncidentTimeline incidents={incidentList} serviceId={id} />
            </div>
        </div>
    );
}
