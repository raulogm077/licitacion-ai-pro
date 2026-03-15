import fs from 'fs';

let content = fs.readFileSync('src/features/dashboard/__tests__/DashboardInteraction.test.tsx', 'utf8');

// The replacement still didn't catch "opens actions menu in header" fully, maybe due to newlines or exact text mismatch.
content = content.replace(/it\('opens actions menu in header'[^]*?\}\);/m,
`it('renders export buttons in header', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        expect(screen.getByText('Exportar Reporte')).toBeInTheDocument();
        expect(screen.getByText('Ver Original')).toBeInTheDocument();
    });`);

fs.writeFileSync('src/features/dashboard/__tests__/DashboardInteraction.test.tsx', content);
