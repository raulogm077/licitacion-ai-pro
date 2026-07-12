import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        const variants = {
            default:
                'bg-brand-gradient text-white shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 active:translate-y-0',
            destructive:
                'bg-danger text-white shadow-sm hover:bg-danger-dark hover:-translate-y-0.5 active:translate-y-0',
            outline:
                'border border-slate-200 bg-white text-slate-900 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-700 dark:hover:bg-slate-800',
            secondary:
                'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
            ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
            link: 'text-brand-600 underline-offset-4 hover:underline dark:text-brand-400',
        };

        const sizes = {
            default: 'h-10 px-4 py-2',
            sm: 'h-9 rounded-lg px-3',
            lg: 'h-11 rounded-lg px-8',
            icon: 'h-10 w-10',
        };

        return (
            <button
                className={cn(
                    'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50',
                    variants[variant],
                    sizes[size],
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
