'use client';

import { useMemo, useState } from 'react';

import type { DayUptime } from '@/types';

interface UptimeBarProps {
    history: DayUptime[];
}

function getColor(uptime: number | null): string {
    if (uptime === null) {
        return 'bg-gray-200';
    }
    if (uptime >= 99.5) {
        return 'bg-green-500';
    }
    if (uptime >= 95) {
        return 'bg-yellow-500';
    }
    return 'bg-red-500';
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function countIncidents(uptime: number | null): number {
    if (uptime === null || uptime >= 99.5) {
        return 0;
    }
    // Estimate: 1 incident for degraded, 2 for down
    return uptime < 95 ? 2 : 1;
}

function getTooltipPositionClass(index: number): string {
    if (index < 10) {
        return 'left-0';
    }
    if (index > 79) {
        return 'right-0';
    }
    return 'left-1/2 -translate-x-1/2';
}

interface DayBarProps {
    day: DayUptime;
    index: number;
    isActive: boolean;
    onEnter: (index: number, date: string, uptime: number | null) => void;
    onLeave: () => void;
}

function DayBar({ day, index, isActive, onEnter, onLeave }: DayBarProps) {
    const incidents = countIncidents(day.uptime_percent);
    const showIncidents =
        day.uptime_percent !== null && day.uptime_percent < 99.5;

    return (
        <div
            className={`relative h-8 min-w-0 flex-1 cursor-default rounded-sm ${getColor(day.uptime_percent)}`}
            onMouseEnter={() => onEnter(index, day.date, day.uptime_percent)}
            onMouseLeave={onLeave}
        >
            {isActive && (
                <div
                    className={`absolute bottom-full z-10 mb-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg ${getTooltipPositionClass(index)}`}
                >
                    <div className="font-medium">{formatDate(day.date)}</div>
                    <div>
                        {day.uptime_percent !== null
                            ? `${day.uptime_percent.toFixed(2)}% uptime`
                            : 'No data'}
                    </div>
                    {showIncidents && (
                        <div className="text-gray-300">
                            {incidents} incident{incidents !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function UptimeBar({ history }: UptimeBarProps) {
    const [tooltip, setTooltip] = useState<{
        index: number;
        date: string;
        uptime: number | null;
    } | null>(null);

    // Build a map for O(1) lookups, then generate exactly 90 calendar days
    const days: DayUptime[] = useMemo(() => {
        const historyMap = new Map<string, number | null>();
        for (const entry of history) {
            historyMap.set(entry.date, entry.uptime_percent);
        }

        const result: DayUptime[] = [];
        for (let i = 89; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0] as string;
            result.push({
                date: dateStr,
                uptime_percent: historyMap.has(dateStr)
                    ? (historyMap.get(dateStr) ?? null)
                    : null,
            });
        }
        return result;
    }, [history]);

    // Calculate overall uptime across all days with data
    const overallUptime = useMemo(() => {
        const withData = days.filter((d) => d.uptime_percent !== null);
        if (withData.length === 0) {
            return null;
        }
        const avg =
            withData.reduce((sum, d) => sum + (d.uptime_percent ?? 0), 0) /
            withData.length;
        return avg.toFixed(2);
    }, [days]);

    function handleEnter(
        index: number,
        date: string,
        uptime: number | null,
    ): void {
        setTooltip({ index, date, uptime });
    }

    function handleLeave(): void {
        setTooltip(null);
    }

    return (
        <div className="w-full">
            <div className="relative flex gap-px overflow-hidden">
                {days.map((day, i) => (
                    <DayBar
                        key={day.date || i}
                        day={day}
                        index={i}
                        isActive={tooltip?.index === i}
                        onEnter={handleEnter}
                        onLeave={handleLeave}
                    />
                ))}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                <span>90 days ago</span>
                {overallUptime !== null && (
                    <span className="font-medium text-gray-600">
                        {overallUptime}% uptime
                    </span>
                )}
                <span>Today</span>
            </div>
        </div>
    );
}
