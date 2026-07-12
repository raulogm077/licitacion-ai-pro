import { cn } from '../../lib/utils';

/** Shimmering placeholder block. Compose these to build loading states. */
export function Skeleton({ className }: { className?: string }) {
    return <div className={cn('animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800', className)} />;
}

/** Card-shaped skeleton used by grid/list loading states. */
export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900',
                className
            )}
        >
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
        </div>
    );
}
