import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    /** Adds a lift + colored shadow on hover for interactive cards. */
    interactive?: boolean;
}

export function Card({ children, className, interactive = false, ...props }: CardProps) {
    return (
        <div
            className={cn(
                'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900',
                interactive &&
                    'transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover dark:hover:border-brand-800',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className, ...props }: CardProps) {
    return (
        <div className={cn('border-b border-slate-100 px-6 py-4 dark:border-slate-800', className)} {...props}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className, ...props }: CardProps) {
    return (
        <h3
            className={cn('font-display text-lg font-semibold text-slate-900 dark:text-slate-100', className)}
            {...props}
        >
            {children}
        </h3>
    );
}

export function CardContent({ children, className, ...props }: CardProps) {
    return (
        <div className={cn('p-6', className)} {...props}>
            {children}
        </div>
    );
}
