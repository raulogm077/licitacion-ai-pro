import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'secondary' | 'destructive';
}

export function Badge({ children, className, variant = 'default', ...props }: BadgeProps) {
    const variants = {
        default: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
        secondary: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        destructive: 'bg-danger-light text-danger-dark dark:bg-danger/20 dark:text-danger-light',
        success: 'bg-success-light text-success-dark dark:bg-success/20 dark:text-success-light',
        warning: 'bg-warning-light text-warning-dark dark:bg-warning/20 dark:text-warning-light',
        danger: 'bg-danger-light text-danger-dark dark:bg-danger/20 dark:text-danger-light',
        outline: 'border border-slate-200 bg-transparent text-slate-600 dark:border-slate-700 dark:text-slate-400',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </span>
    );
}
