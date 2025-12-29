import React, { useState, useRef, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const DropdownContext = React.createContext<{ open: boolean; setOpen: (o: boolean) => void }>({
    open: false,
    setOpen: () => { },
});

export function DropdownMenu({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <DropdownContext.Provider value={{ open, setOpen }}>
            <div className="relative inline-block text-left" ref={ref}>
                {children}
            </div>
        </DropdownContext.Provider>
    );
}

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DropdownMenuTrigger({ children, asChild: _, ...props }: DropdownMenuTriggerProps) {
    const { open, setOpen } = React.useContext(DropdownContext);
    const child = React.Children.only(children) as React.ReactElement;
    return React.cloneElement(child, {
        onClick: (e: React.MouseEvent) => {
            (child.props as { onClick?: React.MouseEventHandler }).onClick?.(e);
            setOpen(!open);
        },
        ...props
    });
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
    align?: "center" | "start" | "end";
}

export function DropdownMenuContent({ align = "center", className, children, ...props }: DropdownMenuContentProps) {
    const { open } = React.useContext(DropdownContext);
    if (!open) return null;

    const aligns = {
        center: "left-1/2 -translate-x-1/2",
        start: "left-0",
        end: "right-0",
    };

    return (
        <div
            className={cn(
                "absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white p-1 text-slate-950 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2",
                aligns[align as keyof typeof aligns],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("-mx-1 my-1 h-px bg-slate-100", className)} {...props} />;
}

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
    disabled?: boolean;
}

export function DropdownMenuItem({ className, disabled, onClick, children, ...props }: DropdownMenuItemProps) {
    const { setOpen } = React.useContext(DropdownContext);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (onClick) onClick(e);
        setOpen(false);
    }

    return (
        <div
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
                disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
                className
            )}
            onClick={handleClick}
            {...props}
        >
            {children}
        </div>
    );
}
