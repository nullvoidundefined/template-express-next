'use client';

import { useMemo, useState } from 'react';
import {
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import type { Check } from '@/types';

interface ResponseTimeChartProps {
    data: Check[];
}

type Range = '24h' | '7d' | '30d';

const RANGE_MS: Record<Range, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
};

function formatXAxis(value: string, range: Range): string {
    const d = new Date(value);
    if (range === '24h') {
        return d.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface TooltipPayload {
    payload?: {
        checked_at: string;
        response_time_ms: number;
    };
}

function CustomTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: TooltipPayload[];
}) {
    if (!active || !payload?.length) {
        return null;
    }
    const d = payload[0]?.payload;
    if (!d) {
        return null;
    }
    return (
        <div className="rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-lg">
            <p className="text-gray-500">
                {new Date(d.checked_at).toLocaleString()}
            </p>
            <p className="font-semibold text-gray-900">
                {d.response_time_ms}ms
            </p>
        </div>
    );
}

export default function ResponseTimeChart({ data }: ResponseTimeChartProps) {
    const [range, setRange] = useState<Range>('24h');

    const chartData = useMemo(() => {
        const cutoff = Date.now() - RANGE_MS[range];
        return data
            .filter(
                (c) =>
                    c.response_time_ms !== null &&
                    new Date(c.checked_at).getTime() >= cutoff,
            )
            .map((c) => ({
                checked_at: c.checked_at,
                response_time_ms: c.response_time_ms,
            }))
            .reverse();
    }, [data, range]);

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex justify-end gap-2">
                {(['24h', '7d', '30d'] as Range[]).map((r) => (
                    <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                            range === r
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {r}
                    </button>
                ))}
            </div>

            {chartData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                    No data for this time range
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                        <XAxis
                            dataKey="checked_at"
                            tickFormatter={(v) => formatXAxis(v, range)}
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `${v}ms`}
                            width={55}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                            type="monotone"
                            dataKey="response_time_ms"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
