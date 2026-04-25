import React from 'react';
import { X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={() => onOpenChange(false)}
            />
            <div className="relative w-full max-w-lg scale-100 transition-all z-50">
                {React.Children.map(children, (child) =>
                    React.isValidElement(child) && typeof child.type !== 'string'
                        ? React.cloneElement(child as React.ReactElement<{ onOpenChange?: (open: boolean) => void }>, { onOpenChange })
                        : child
                )}
            </div>
        </div>
    );
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
    onOpenChange?: (open: boolean) => void;
}

export function DialogContent({ className, children, onOpenChange, ...props }: DialogContentProps) {
    return (
        <div
            className={cn(
                'relative w-full gap-4 border border-slate-200 bg-white p-6 shadow-lg sm:rounded-lg md:w-full',
                className
            )}
            {...props}
        >
            <button
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100 data-[state=open]:text-slate-500"
                onClick={() => onOpenChange && onOpenChange(false)}
            >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </button>
            {children}
        </div>
    );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;
}
