import React from 'react';
import { Skeleton, SkeletonCard } from './Skeleton';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Actions Skeleton */}
            <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-48" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={i}
                            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <Skeleton className="h-10 w-10 rounded-lg" />
                                <Skeleton className="h-6 w-40" />
                            </div>
                            <div className="space-y-3">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-6">
                    {[...Array(2)].map((_, i) => (
                        <div
                            key={i}
                            className="h-64 rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900"
                        >
                            <Skeleton className="h-6 w-32 mb-4" />
                            <div className="space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-10 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
