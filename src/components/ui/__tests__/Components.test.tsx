import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { Badge } from '../Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../Card';
import { Button } from '../Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../Dialog';
import { PageLoader } from '../PageLoader';
import { DashboardSkeleton } from '../DashboardSkeleton';
import { UserMenu } from '../UserMenu';
import * as AuthStore from '../../../stores/auth.store';

// Mock auth store for UserMenu tests
vi.mock('../../../stores/auth.store');

describe('Common Components', () => {
    describe('Badge', () => {
        it('renders with content', () => {
            render(<Badge>Test Badge</Badge>);
            expect(screen.getByText('Test Badge')).toBeInTheDocument();
        });

        it('renders variants', () => {
            const { rerender, getByText } = render(<Badge variant="default">Default</Badge>);
            expect(getByText('Default')).toHaveClass('bg-slate-100');

            rerender(<Badge variant="outline">Outline</Badge>);
            expect(getByText('Outline')).toHaveClass('border');
        });
    });

    describe('Card', () => {
        it('renders full card structure', () => {
            render(
                <Card>
                    <CardHeader>
                        <CardTitle>Title</CardTitle>
                    </CardHeader>
                    <CardContent>Content</CardContent>
                </Card>
            );

            expect(screen.getByText('Title')).toBeInTheDocument();
            expect(screen.getByText('Content')).toBeInTheDocument();
        });
    });

    describe('Button', () => {
        it('renders children', () => {
            render(<Button>Click me</Button>);
            expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
        });

        it('applies default variant classes', () => {
            render(<Button>Default</Button>);
            const btn = screen.getByRole('button');
            expect(btn).toHaveClass('bg-slate-900');
        });

        it('applies destructive variant classes', () => {
            render(<Button variant="destructive">Delete</Button>);
            expect(screen.getByRole('button')).toHaveClass('bg-red-500');
        });

        it('applies outline variant classes', () => {
            render(<Button variant="outline">Outline</Button>);
            expect(screen.getByRole('button')).toHaveClass('border');
        });

        it('applies secondary variant classes', () => {
            render(<Button variant="secondary">Secondary</Button>);
            expect(screen.getByRole('button')).toHaveClass('bg-slate-100');
        });

        it('applies sm size classes', () => {
            render(<Button size="sm">Small</Button>);
            expect(screen.getByRole('button')).toHaveClass('h-9');
        });

        it('applies lg size classes', () => {
            render(<Button size="lg">Large</Button>);
            expect(screen.getByRole('button')).toHaveClass('h-11');
        });

        it('applies icon size classes', () => {
            render(<Button size="icon">I</Button>);
            expect(screen.getByRole('button')).toHaveClass('h-10', 'w-10');
        });

        it('is disabled when disabled prop is passed', () => {
            render(<Button disabled>Disabled</Button>);
            expect(screen.getByRole('button')).toBeDisabled();
        });

        it('calls onClick handler', () => {
            const handleClick = vi.fn();
            render(<Button onClick={handleClick}>Click</Button>);
            fireEvent.click(screen.getByRole('button'));
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it('forwards ref correctly', () => {
            const ref = React.createRef<HTMLButtonElement>();
            render(<Button ref={ref}>Ref</Button>);
            expect(ref.current).toBeInstanceOf(HTMLButtonElement);
        });

        it('has displayName for devtools', () => {
            expect(Button.displayName).toBe('Button');
        });
    });

    describe('Dialog', () => {
        it('renders nothing when open is false', () => {
            render(
                <Dialog open={false} onOpenChange={vi.fn()}>
                    <div>Hidden Content</div>
                </Dialog>
            );
            expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();
        });

        it('renders children when open is true', () => {
            render(
                <Dialog open={true} onOpenChange={vi.fn()}>
                    <div>Visible Content</div>
                </Dialog>
            );
            expect(screen.getByText('Visible Content')).toBeInTheDocument();
        });

        it('calls onOpenChange(false) when backdrop is clicked', () => {
            const handleChange = vi.fn();
            render(
                <Dialog open={true} onOpenChange={handleChange}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Test</DialogTitle>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
            );
            // The backdrop is the fixed inset-0 div with bg-black/50
            const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
            expect(backdrop).not.toBeNull();
            fireEvent.click(backdrop!);
            expect(handleChange).toHaveBeenCalledWith(false);
        });

        it('calls onOpenChange(false) when close button is clicked', () => {
            const handleChange = vi.fn();
            render(
                <Dialog open={true} onOpenChange={handleChange}>
                    <DialogContent>
                        <span>Modal body</span>
                    </DialogContent>
                </Dialog>
            );
            // Close button has sr-only text "Close"
            const closeBtn = screen.getByRole('button');
            fireEvent.click(closeBtn);
            expect(handleChange).toHaveBeenCalledWith(false);
        });

        it('DialogHeader renders its children', () => {
            render(
                <Dialog open={true} onOpenChange={vi.fn()}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>My Title</DialogTitle>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
            );
            expect(screen.getByText('My Title')).toBeInTheDocument();
        });
    });

    describe('PageLoader', () => {
        it('renders loading spinner element', () => {
            const { container } = render(<PageLoader />);
            // Loader2 icon renders as an svg
            const svg = container.querySelector('svg');
            expect(svg).not.toBeNull();
        });

        it('renders loading text', () => {
            render(<PageLoader />);
            expect(screen.getByText('Cargando módulo...')).toBeInTheDocument();
        });
    });

    describe('DashboardSkeleton', () => {
        it('renders without crashing', () => {
            const { container } = render(<DashboardSkeleton />);
            expect(container.firstChild).not.toBeNull();
        });

        it('renders 4 metric card skeletons', () => {
            const { container } = render(<DashboardSkeleton />);
            // The metrics grid has 4 items (lg:grid-cols-4)
            const metricsGrid = container.querySelector('.grid');
            expect(metricsGrid).not.toBeNull();
            const metricCards = metricsGrid!.querySelectorAll(':scope > div');
            expect(metricCards.length).toBe(4);
        });

        it('has animate-pulse shimmer elements', () => {
            const { container } = render(<DashboardSkeleton />);
            const shimmers = container.querySelectorAll('.animate-pulse');
            expect(shimmers.length).toBeGreaterThan(0);
        });
    });

    describe('UserMenu', () => {
        const mockSignOut = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('renders nothing when user is null', () => {
            vi.mocked(AuthStore.useAuthStore).mockReturnValue({
                user: null,
                signOut: mockSignOut,
            } as unknown as ReturnType<typeof AuthStore.useAuthStore>);

            const { container } = render(<UserMenu />);
            expect(container.firstChild).toBeNull();
        });

        it('renders user email initial when user is set', () => {
            vi.mocked(AuthStore.useAuthStore).mockReturnValue({
                user: { email: 'test@empresa.com', id: '1' },
                signOut: mockSignOut,
            } as unknown as ReturnType<typeof AuthStore.useAuthStore>);

            render(<UserMenu />);
            // Initial letter of email should appear
            expect(screen.getAllByText('T').length).toBeGreaterThan(0);
        });

        it('opens dropdown when clicked', () => {
            vi.mocked(AuthStore.useAuthStore).mockReturnValue({
                user: { email: 'user@test.com', id: '1' },
                signOut: mockSignOut,
            } as unknown as ReturnType<typeof AuthStore.useAuthStore>);

            render(<UserMenu />);
            const toggleBtn = screen.getByRole('button');
            fireEvent.click(toggleBtn);
            // Dropdown shows email and logout option
            expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
        });

        it('calls signOut when logout button is clicked', async () => {
            mockSignOut.mockResolvedValue(undefined);
            vi.mocked(AuthStore.useAuthStore).mockReturnValue({
                user: { email: 'user@test.com', id: '1' },
                signOut: mockSignOut,
            } as unknown as ReturnType<typeof AuthStore.useAuthStore>);

            render(<UserMenu />);
            // Open dropdown first
            fireEvent.click(screen.getByRole('button'));
            // Click logout
            await act(async () => { fireEvent.click(screen.getByText('Cerrar sesión')); });
            expect(mockSignOut).toHaveBeenCalledTimes(1);
        });
    });
});
