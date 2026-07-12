import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
    const titleId = useId();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);

    // Escape closes; focus moves into the dialog on open and returns to the
    // trigger on close (WCAG 2.4.3 / dialog pattern, without a full trap).
    useEffect(() => {
        if (!open) return;

        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        const focusable = containerRef.current?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        (focusable ?? containerRef.current)?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onOpenChange(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocusedRef.current?.focus?.();
        };
    }, [open, onOpenChange]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={() => onOpenChange(false)}
                aria-hidden="true"
            />
            <div
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="relative w-full max-w-lg scale-100 transition-all z-50"
            >
                {React.Children.map(children, (child) =>
                    React.isValidElement(child)
                        ? React.cloneElement(
                              child as React.ReactElement<{
                                  onOpenChange?: (open: boolean) => void;
                                  titleId?: string;
                              }>,
                              { onOpenChange, titleId }
                          )
                        : child
                )}
            </div>
        </div>
    );
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
    onOpenChange?: (open: boolean) => void;
    titleId?: string;
}

export function DialogContent({ className, children, onOpenChange, titleId, ...props }: DialogContentProps) {
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
                aria-label="Cerrar"
            >
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
            </button>
            {React.Children.map(children, (child) =>
                React.isValidElement(child) && child.type === DialogHeader
                    ? React.cloneElement(child as React.ReactElement<{ titleId?: string }>, { titleId })
                    : child
            )}
        </div>
    );
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    titleId?: string;
}

export function DialogHeader({ className, titleId, children, ...props }: DialogHeaderProps) {
    return (
        <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)} {...props}>
            {React.Children.map(children, (child) =>
                React.isValidElement(child) && child.type === DialogTitle
                    ? React.cloneElement(child as React.ReactElement<{ id?: string }>, { id: titleId })
                    : child
            )}
        </div>
    );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;
}
