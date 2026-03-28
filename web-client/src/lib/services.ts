import type { Check, Incident, Service } from '@/types';

import { api } from './api';

// Service CRUD

export async function getServices(): Promise<Service[]> {
    const data = await api<{ data: Service[] }>('/api/v1/services');
    return data.data;
}

export async function getService(id: string): Promise<Service> {
    const data = await api<{ data: Service }>(`/api/v1/services/${id}`);
    return data.data;
}

export interface CreateServiceInput {
    name: string;
    url: string;
    health_endpoint?: string;
    github_owner?: string;
    github_repo?: string;
    github_branch?: string;
    check_interval_seconds?: number;
    timeout_ms?: number;
    expected_status_code?: number;
    screenshot_enabled?: boolean;
    tags?: string[];
}

export async function createService(
    input: CreateServiceInput,
): Promise<Service> {
    const data = await api<{ data: Service }>('/api/v1/services', {
        method: 'POST',
        body: input as unknown as Record<string, unknown>,
    });
    return data.data;
}

export async function updateService(
    id: string,
    input: Partial<CreateServiceInput>,
): Promise<Service> {
    const data = await api<{ data: Service }>(`/api/v1/services/${id}`, {
        method: 'PUT',
        body: input as unknown as Record<string, unknown>,
    });
    return data.data;
}

export async function deleteService(id: string): Promise<void> {
    await api<void>(`/api/v1/services/${id}`, { method: 'DELETE' });
}

// Checks

export async function getChecks(
    serviceId: string,
    params?: { limit?: number; offset?: number },
): Promise<{ data: Check[]; total: number }> {
    const qs = new URLSearchParams();
    if (params?.limit) {
        qs.set('limit', String(params.limit));
    }
    if (params?.offset) {
        qs.set('offset', String(params.offset));
    }
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api<{ data: Check[]; total: number }>(
        `/api/v1/services/${serviceId}/checks${query}`,
    );
}

export async function getLatestCheck(serviceId: string): Promise<Check | null> {
    try {
        const data = await api<{ data: Check }>(
            `/api/v1/services/${serviceId}/checks/latest`,
        );
        return data.data;
    } catch {
        return null;
    }
}

export async function triggerCheck(serviceId: string): Promise<void> {
    await api<void>(`/api/v1/services/${serviceId}/check`, { method: 'POST' });
}

// Incidents

export async function getIncidents(serviceId: string): Promise<Incident[]> {
    const data = await api<{ data: Incident[] }>(
        `/api/v1/services/${serviceId}/incidents`,
    );
    return data.data;
}

export async function createIncident(
    serviceId: string,
    input: { title: string; cause?: string },
): Promise<Incident> {
    const data = await api<{ data: Incident }>(
        `/api/v1/services/${serviceId}/incidents`,
        { method: 'POST', body: input as unknown as Record<string, unknown> },
    );
    return data.data;
}

// GitHub Status

export async function getGithubStatus(
    serviceId: string,
): Promise<import('@/types').GithubStatus | null> {
    try {
        const data = await api<{
            data: import('@/types').GithubStatus | null;
        }>(`/api/v1/services/${serviceId}/github`);
        return data.data;
    } catch {
        return null;
    }
}
