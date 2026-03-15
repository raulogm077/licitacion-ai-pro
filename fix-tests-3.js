import fs from 'fs';

let content = fs.readFileSync('src/features/dashboard/__tests__/DashboardInteraction.test.tsx', 'utf8');

// The replacement in fix-tests-2.js failed because I used the exact string matching which was wrong.
// Let's replace the whole test body for "renders header and subnav" and "opens actions menu in header".

content = content.replace(/it\('renders header and subnav', \(\) => \{[\s\S]*?\}\);/m,
`it('renders header and sidebar nav', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        // Header
        expect(screen.getAllByText('Test Org')[0]).toBeInTheDocument();
        // Sidebar items
        expect(screen.getAllByText('Resumen Ejecutivo')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Datos Generales')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Criterios de Adjudicación')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Solvencia')[0]).toBeInTheDocument();
    });`);

content = content.replace(/it\('opens actions menu in header', \(\) => \{[\s\S]*?\}\);/m,
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
