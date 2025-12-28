import React from 'react';

const Shimmer: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg ${className}`} />
);

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Actions Skeleton */}
            <div className="flex justify-between items-center">
                <Shimmer className="h-6 w-48" />
                <div className="flex gap-2">
                    <Shimmer className="h-10 w-24" />
                    <Shimmer className="h-10 w-24" />
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <Shimmer className="h-4 w-20 mb-3" />
                        <Shimmer className="h-8 w-32" />
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <Shimmer className="h-10 w-10 rounded-lg" />
                                <Shimmer className="h-6 w-40" />
                            </div>
                            <div className="space-y-3">
                                <Shimmer className="h-4 w-full" />
                                <Shimmer className="h-4 w-full" />
                                <Shimmer className="h-4 w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-6">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm h-64">
                            <Shimmer className="h-6 w-32 mb-4" />
                            <div className="space-y-4">
                                <Shimmer className="h-12 w-full" />
                                <Shimmer className="h-12 w-full" />
                                <Shimmer className="h-10 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
