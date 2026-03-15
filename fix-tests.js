import fs from 'fs';

// Restore DashboardInteraction.test.tsx correctly
let dashboardInteraction = fs.readFileSync('src/features/dashboard/__tests__/DashboardInteraction.test.tsx', 'utf8');
dashboardInteraction = dashboardInteraction.replace(/vi\.mock\("lucide-react", async \(importOriginal\) => \{\n  const actual = await importOriginal\(\);\n  return \{\n    \.\.\.actual,/g, 'vi.mock("lucide-react", () => ({');
fs.writeFileSync('src/features/dashboard/__tests__/DashboardInteraction.test.tsx', dashboardInteraction);

// Restore DashboardSmoke.test.tsx correctly
let dashboardSmoke = fs.readFileSync('src/features/dashboard/__tests__/DashboardSmoke.test.tsx', 'utf8');
dashboardSmoke = dashboardSmoke.replace(/vi\.mock\("lucide-react", async \(importOriginal\) => \{\n  const actual = await importOriginal\(\);\n  return \{\n    \.\.\.actual,/g, 'vi.mock("lucide-react", () => ({');
fs.writeFileSync('src/features/dashboard/__tests__/DashboardSmoke.test.tsx', dashboardSmoke);
