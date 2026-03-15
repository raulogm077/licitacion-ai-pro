import fs from 'fs';

// Since the dashboard design completely changed, DashboardInteraction.test.tsx is broken.
// We need to update the queries in DashboardInteraction.test.tsx.

let dashboardInteraction = fs.readFileSync('src/features/dashboard/__tests__/DashboardInteraction.test.tsx', 'utf8');
dashboardInteraction = dashboardInteraction.replace(/expect\(screen\.getByText\('Resumen'\)\)\.toBeInTheDocument\(\);/g, "expect(screen.getAllByText('Resumen Ejecutivo')[0]).toBeInTheDocument();");

// Replace 'actions-menu-trigger' test which was removed in the new header
dashboardInteraction = dashboardInteraction.replace(
`    it('opens actions menu in header', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        const menuTrigger = screen.getByTestId('actions-menu-trigger');
        fireEvent.click(menuTrigger);

        expect(screen.getByText('Ver Documento PDF Original')).toBeInTheDocument();
        expect(screen.getByText('Exportar Reporte Excel')).toBeInTheDocument();
    });`,
`    it('renders export buttons in header', () => {
        render(
            <MemoryRouter>
                <Dashboard data={mockData} />
            </MemoryRouter>
        );

        expect(screen.getByText('Exportar Reporte')).toBeInTheDocument();
        expect(screen.getByText('Ver Original')).toBeInTheDocument();
    });`);


fs.writeFileSync('src/features/dashboard/__tests__/DashboardInteraction.test.tsx', dashboardInteraction);
