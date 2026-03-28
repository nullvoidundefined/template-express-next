'use client';

import { useState } from 'react';

import type { Service, ServiceStatus } from '@/types';

import AddEditServiceModal from './AddEditServiceModal';
import ServiceAdminCard from './ServiceAdminCard';

interface ServiceGridProps {
    initialServices: Service[];
}

type StatusFilter = 'all' | ServiceStatus;

export default function ServiceGrid({ initialServices }: ServiceGridProps) {
    const [services, setServices] = useState<Service[]>(initialServices);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);

    const filtered = services.filter((s) => {
        const matchesStatus =
            statusFilter === 'all' || s.status === statusFilter;
        const matchesSearch =
            !search ||
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.url.toLowerCase().includes(search.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    function handleEdit(service: Service) {
        setEditingService(service);
        setShowModal(true);
    }

    function handleAdd() {
        setEditingService(null);
        setShowModal(true);
    }

    function handleSaved(saved: Service) {
        setServices((prev) => {
            const idx = prev.findIndex((s) => s.id === saved.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
            }
            return [saved, ...prev];
        });
        setShowModal(false);
    }

    function handleDeleted(id: string) {
        setServices((prev) => prev.filter((s) => s.id !== id));
    }

    const statusButtons: { value: StatusFilter; label: string }[] = [
        { value: 'all', label: 'All' },
        { value: 'up', label: 'Up' },
        { value: 'degraded', label: 'Degraded' },
        { value: 'down', label: 'Down' },
    ];

    return (
        <div>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search services..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex rounded-md border border-gray-300 overflow-hidden">
                        {statusButtons.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setStatusFilter(value)}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${
                                    statusFilter === value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                    + Add Service
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                    {services.length === 0
                        ? 'No services yet. Add your first service to start monitoring.'
                        : 'No services match your filters.'}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((service) => (
                        <ServiceAdminCard
                            key={service.id}
                            service={service}
                            onEdit={handleEdit}
                            onDeleted={handleDeleted}
                        />
                    ))}
                </div>
            )}

            {showModal && (
                <AddEditServiceModal
                    service={editingService}
                    onClose={() => setShowModal(false)}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
