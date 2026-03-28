import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'secondary' | 'destructive';
}

export function Badge({ children, className, variant = 'default', ...props }: BadgeProps) {
    const variants = {
        default: 'bg-slate-100 text-slate-700',
        secondary: 'bg-slate-200 text-slate-800',
        destructive: 'bg-red-100 text-red-800',
        success: 'bg-green-100 text-green-800', // Assuming colors exist or are valid Tailwind
        warning: 'bg-yellow-100 text-yellow-800',
        danger: 'bg-red-100 text-red-800',
        outline: 'bg-transparent border border-slate-200 text-slate-600',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </span>
    );
}
