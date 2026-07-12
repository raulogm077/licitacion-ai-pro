import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
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

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
                    <m.div
                        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
                        onClick={() => onOpenChange(false)}
                        aria-hidden="true"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    />
                    <m.div
                        ref={containerRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        tabIndex={-1}
                        className="relative z-50 w-full max-w-lg"
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 12 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
                    </m.div>
                </div>
            )}
        </AnimatePresence>
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
                'relative w-full gap-4 border border-slate-200 bg-white p-6 shadow-glow-lg sm:rounded-2xl md:w-full dark:border-slate-800 dark:bg-slate-900',
                className
            )}
            {...props}
        >
            <button
                className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 opacity-70 transition-opacity hover:bg-slate-100 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:pointer-events-none dark:hover:bg-slate-800"
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
        <div className={cn('mb-4 flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props}>
            {React.Children.map(children, (child) =>
                React.isValidElement(child) && child.type === DialogTitle
                    ? React.cloneElement(child as React.ReactElement<{ id?: string }>, { id: titleId })
                    : child
            )}
        </div>
    );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h2
            className={cn(
                'font-display text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100',
                className
            )}
            {...props}
        />
    );
}
