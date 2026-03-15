import fs from 'fs';

function fixDuplicates(file) {
    let content = fs.readFileSync(file, 'utf8');
    // My previous script removed all instances, even the original ones. Let's just put all icons nicely in a clean mock

    const correctMock = `vi.mock("lucide-react", () => ({
    Menu: () => <span data-testid="icon-menu" />,
    X: () => <span data-testid="icon-x" />,
    Search: () => <span data-testid="icon-search" />,
    LogOut: () => <span data-testid="icon-logout" />,
    ChevronDown: () => <span data-testid="icon-chevron-down" />,
    ChevronRight: () => <span data-testid="icon-chevron-right" />,
    ChevronLeft: () => <span data-testid="icon-chevron-left" />,
    MoreHorizontal: () => <span data-testid="icon-more" />,
    FileText: () => <span data-testid="icon-file-text" />,
    File: () => <span data-testid="icon-file" />,
    Download: () => <span data-testid="icon-download" />,
    AlertCircle: () => <span data-testid="icon-alert-circle" />,
    AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
    Check: () => <span data-testid="icon-check" />,
    XCircle: () => <span data-testid="icon-x-circle" />,
    Copy: () => <span data-testid="icon-copy" />,
    FileJson: () => <span data-testid="icon-file-json" />,
    Pin: () => <span data-testid="icon-pin" />,
    PinOff: () => <span data-testid="icon-pin-off" />,
    FileSearch: () => <span data-testid="icon-file-search" />,
    LayoutDashboard: () => <span data-testid="icon-layout-dashboard" />,
    Award: () => <span data-testid="icon-award" />,
    Shield: () => <span data-testid="icon-shield" />,
    Wrench: () => <span data-testid="icon-wrench" />,
    Settings: () => <span data-testid="icon-settings" />,
    Building2: () => <span data-testid="icon-building" />,
    Euro: () => <span data-testid="icon-euro" />,
    CalendarClock: () => <span data-testid="icon-calendar" />,
    Timer: () => <span data-testid="icon-timer" />,
    TrendingUp: () => <span data-testid="icon-trending" />,
    Sparkles: () => <span data-testid="icon-sparkles" />,
    MapPin: () => <span data-testid="icon-pin-2" />,
    Users: () => <span data-testid="icon-users" />,
    Layers: () => <span data-testid="icon-layers" />,
    Tag: () => <span data-testid="icon-tag" />,
    BarChart2: () => <span data-testid="icon-chart" />,
    ShieldAlert: () => <span data-testid="icon-shield-alert" />,
    Info: () => <span data-testid="icon-info" />,
    CheckCircle2: () => <span data-testid="icon-check2" />,
    Bell: () => <span data-testid="icon-bell" />,
    ArrowRight: () => <span data-testid="icon-arrow" />
}));`;

    content = content.replace(/vi\.mock\("lucide-react", \(\) => \(\{[\s\S]*?\}\)\);/m, correctMock);
    fs.writeFileSync(file, content);
}

fixDuplicates('src/features/dashboard/__tests__/DashboardInteraction.test.tsx');
fixDuplicates('src/features/dashboard/__tests__/DashboardSmoke.test.tsx');
