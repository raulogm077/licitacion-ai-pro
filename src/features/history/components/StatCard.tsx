import React from "react";
import { cn } from "../../../lib/utils";

export function StatCard({
    icon,
    label,
    value,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    accent?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-xl border p-4 flex items-center gap-3 transition-colors",
                accent
                    ? "bg-brand-600 text-white border-brand-600 dark:bg-brand-700 dark:border-brand-700"
                    : "bg-white text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700"
            )}
        >
            <div
                className={cn(
                    "p-2 rounded-lg",
                    accent ? "bg-white/15 text-white" : "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                )}
            >
                {icon}
            </div>
            <div>
                <p
                    className={cn(
                        "text-xs font-medium",
                        accent ? "text-brand-100" : "text-slate-500 dark:text-slate-400"
                    )}
                >
                    {label}
                </p>
                <p className="text-xl font-bold leading-tight">{value}</p>
            </div>
        </div>
    );
}
