'use client';

import { useEffect, useState } from 'react';

import { createService, updateService } from '@/lib/services';
import type { Service } from '@/types';

interface AddEditServiceModalProps {
    service?: Service | null;
    onClose: () => void;
    onSaved: (service: Service) => void;
}

const defaultForm = {
    name: '',
    url: '',
    health_endpoint: '',
    github_owner: '',
    github_repo: '',
    github_branch: 'main',
    check_interval_seconds: 60,
    timeout_ms: 10000,
    expected_status_code: 200,
    screenshot_enabled: true,
    tags: '',
};

export default function AddEditServiceModal({
    service,
    onClose,
    onSaved,
}: AddEditServiceModalProps) {
    const [form, setForm] = useState(defaultForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState('');

    useEffect(() => {
        if (service) {
            setForm({
                name: service.name,
                url: service.url,
                health_endpoint: service.health_endpoint ?? '',
                github_owner: service.github_owner ?? '',
                github_repo: service.github_repo ?? '',
                github_branch: service.github_branch,
                check_interval_seconds: service.check_interval_seconds,
                timeout_ms: service.timeout_ms,
                expected_status_code: service.expected_status_code,
                screenshot_enabled: service.screenshot_enabled,
                tags: service.tags.join(', '),
            });
        } else {
            setForm(defaultForm);
        }
    }, [service]);

    function validate(): boolean {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) {
            errs.name = 'Name is required';
        }
        if (!form.url.trim()) {
            errs.url = 'URL is required';
        } else if (!/^https?:\/\//.test(form.url)) {
            errs.url = 'URL must start with http:// or https://';
        }
        if (form.check_interval_seconds < 10) {
            errs.check_interval_seconds =
                'Check interval must be at least 10 seconds';
        }
        if (form.timeout_ms < 1000) {
            errs.timeout_ms = 'Timeout must be at least 1000ms';
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) {
            return;
        }
        setLoading(true);
        setServerError('');

        const payload = {
            name: form.name.trim(),
            url: form.url.trim(),
            health_endpoint: form.health_endpoint.trim() || undefined,
            github_owner: form.github_owner.trim() || undefined,
            github_repo: form.github_repo.trim() || undefined,
            github_branch: form.github_branch.trim() || 'main',
            check_interval_seconds: Number(form.check_interval_seconds),
            timeout_ms: Number(form.timeout_ms),
            expected_status_code: Number(form.expected_status_code),
            screenshot_enabled: form.screenshot_enabled,
            tags: form.tags
                ? form.tags
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                : [],
        };

        try {
            let saved: Service;
            if (service) {
                saved = await updateService(service.id, payload);
            } else {
                saved = await createService(payload);
            }
            onSaved(saved);
        } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setLoading(false);
        }
    }

    function renderField(
        label: string,
        key: keyof typeof form,
        type: string = 'text',
        placeholder?: string,
    ) {
        return (
            <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                    {label}
                </label>
                <input
                    type={type}
                    value={String(form[key])}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {errors[key] && (
                    <p className="mt-1 text-xs text-red-600">{errors[key]}</p>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {service ? 'Edit Service' : 'Add Service'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            name: e.target.value,
                                        }))
                                    }
                                    placeholder="My App"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {errors.name && (
                                    <p className="mt-1 text-xs text-red-600">
                                        {errors.name}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    URL *
                                </label>
                                <input
                                    type="url"
                                    value={form.url}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            url: e.target.value,
                                        }))
                                    }
                                    placeholder="https://example.com"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {errors.url && (
                                    <p className="mt-1 text-xs text-red-600">
                                        {errors.url}
                                    </p>
                                )}
                            </div>
                        </div>

                        {renderField(
                            'Health Endpoint',
                            'health_endpoint',
                            'text',
                            '/api/health',
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {renderField(
                                'GitHub Owner',
                                'github_owner',
                                'text',
                                'myorg',
                            )}
                            {renderField(
                                'GitHub Repo',
                                'github_repo',
                                'text',
                                'my-repo',
                            )}
                        </div>

                        {renderField(
                            'GitHub Branch',
                            'github_branch',
                            'text',
                            'main',
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Check Interval (s)
                                </label>
                                <input
                                    type="number"
                                    min={10}
                                    value={form.check_interval_seconds}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            check_interval_seconds: Number(
                                                e.target.value,
                                            ),
                                        }))
                                    }
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {errors.check_interval_seconds && (
                                    <p className="mt-1 text-xs text-red-600">
                                        {errors.check_interval_seconds}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Timeout (ms)
                                </label>
                                <input
                                    type="number"
                                    min={1000}
                                    value={form.timeout_ms}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            timeout_ms: Number(e.target.value),
                                        }))
                                    }
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {errors.timeout_ms && (
                                    <p className="mt-1 text-xs text-red-600">
                                        {errors.timeout_ms}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Expected Status Code
                                </label>
                                <input
                                    type="number"
                                    value={form.expected_status_code}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            expected_status_code: Number(
                                                e.target.value,
                                            ),
                                        }))
                                    }
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {renderField(
                            'Tags (comma-separated)',
                            'tags',
                            'text',
                            'production, api',
                        )}

                        <div className="flex items-center gap-2">
                            <input
                                id="screenshot_enabled"
                                type="checkbox"
                                checked={form.screenshot_enabled}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        screenshot_enabled: e.target.checked,
                                    }))
                                }
                                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                            />
                            <label
                                htmlFor="screenshot_enabled"
                                className="text-sm font-medium text-gray-700"
                            >
                                Enable Screenshots
                            </label>
                        </div>
                    </div>

                    {serverError && (
                        <p className="mt-4 text-sm text-red-600">
                            {serverError}
                        </p>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading
                                ? 'Saving...'
                                : service
                                  ? 'Save Changes'
                                  : 'Add Service'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
