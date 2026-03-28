'use client';

import { useState } from 'react';

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

export default function UptimeBar({ history }: UptimeBarProps) {
    const [tooltip, setTooltip] = useState<{
        index: number;
        date: string;
        uptime: number | null;
    } | null>(null);

    // Ensure we have exactly 90 entries, padding with nulls if needed
    const days: DayUptime[] = (() => {
        if (history.length >= 90) {
            return history.slice(-90);
        }
        const padding: DayUptime[] = Array.from(
            { length: 90 - history.length },
            (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (89 - i));
                return {
                    date: d.toISOString().split('T')[0],
                    uptime_percent: null,
                };
            },
        );
        return [...padding, ...history];
    })();

    return (
        <div className="w-full">
            <div className="relative flex gap-px">
                {days.map((day, i) => (
                    <div
                        key={day.date || i}
                        className={`relative h-8 flex-1 cursor-default rounded-sm ${getColor(day.uptime_percent)}`}
                        onMouseEnter={() =>
                            setTooltip({
                                index: i,
                                date: day.date,
                                uptime: day.uptime_percent,
                            })
                        }
                        onMouseLeave={() => setTooltip(null)}
                    >
                        {tooltip?.index === i && (
                            <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
                                <div className="font-medium">{day.date}</div>
                                <div>
                                    {day.uptime_percent !== null
                                        ? `${day.uptime_percent.toFixed(2)}% uptime`
                                        : 'No data'}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-400">
                <span>90 days ago</span>
                <span>Today</span>
            </div>
        </div>
    );
}
