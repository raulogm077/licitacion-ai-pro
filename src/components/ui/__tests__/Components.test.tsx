import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from '../Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../Card';

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
});
