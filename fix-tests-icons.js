import fs from 'fs';

// Add the missing icons to the manual mock for lucide-react in the tests

function addIcons(file) {
    let content = fs.readFileSync(file, 'utf8');
    const iconsToAdd = `LayoutDashboard: () => <span data-testid="icon-layout-dashboard" />,
    FileText: () => <span data-testid="icon-file-text" />,
    Award: () => <span data-testid="icon-award" />,
    Shield: () => <span data-testid="icon-shield" />,
    Wrench: () => <span data-testid="icon-wrench" />,
    AlertTriangle: () => <span data-testid="icon-alert" />,
    Settings: () => <span data-testid="icon-settings" />,
    Building2: () => <span data-testid="icon-building" />,
    LogOut: () => <span data-testid="icon-logout" />,
    ChevronRight: () => <span data-testid="icon-chevron" />,
    Euro: () => <span data-testid="icon-euro" />,
    CalendarClock: () => <span data-testid="icon-calendar" />,
    Timer: () => <span data-testid="icon-timer" />,
    TrendingUp: () => <span data-testid="icon-trending" />,
    Sparkles: () => <span data-testid="icon-sparkles" />,
    MapPin: () => <span data-testid="icon-pin" />,
    Users: () => <span data-testid="icon-users" />,
    Layers: () => <span data-testid="icon-layers" />,
    Tag: () => <span data-testid="icon-tag" />,
    BarChart2: () => <span data-testid="icon-chart" />,
    ShieldAlert: () => <span data-testid="icon-shield-alert" />,
    Info: () => <span data-testid="icon-info" />,
    XCircle: () => <span data-testid="icon-xcircle" />,
    CheckCircle2: () => <span data-testid="icon-check" />,
    Bell: () => <span data-testid="icon-bell" />,
    ArrowRight: () => <span data-testid="icon-arrow" />,
    Download: () => <span data-testid="icon-download" />,`;

    // find where the mock block starts
    content = content.replace(/vi\.mock\("lucide-react", \(\) => \(\{/, `vi.mock("lucide-react", () => ({\n    ${iconsToAdd}`);
    fs.writeFileSync(file, content);
}

addIcons('src/features/dashboard/__tests__/DashboardInteraction.test.tsx');
addIcons('src/features/dashboard/__tests__/DashboardSmoke.test.tsx');
