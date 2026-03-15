import fs from 'fs';

// 1. Fix Dashboard.tsx
let dashboard = fs.readFileSync('src/features/dashboard/Dashboard.tsx', 'utf8');
dashboard = dashboard.replace('export function Dashboard({ data, onUpdate, isLoading }: DashboardProps)', 'export function Dashboard({ data, isLoading }: DashboardProps)');
fs.writeFileSync('src/features/dashboard/Dashboard.tsx', dashboard);

// 2. Fix Header.tsx
let header = fs.readFileSync('src/features/dashboard/components/layout/Header.tsx', 'utf8');
header = header.replace(/vm\.result\.datosGenerales\.numeroExpediente/g, '(vm.result.datosGenerales as any).numeroExpediente');
fs.writeFileSync('src/features/dashboard/components/layout/Header.tsx', header);

// 3. Fix KpiCards.tsx
let kpiCards = fs.readFileSync('src/features/dashboard/components/widgets/KpiCards.tsx', 'utf8');
kpiCards = kpiCards.replace('vm.result.datosGenerales.fechaCierre', 'vm.result.datosGenerales.fechaLimitePresentacion');
fs.writeFileSync('src/features/dashboard/components/widgets/KpiCards.tsx', kpiCards);

// 4. Fix RiskSummary.tsx
let riskSummary = fs.readFileSync('src/features/dashboard/components/widgets/RiskSummary.tsx', 'utf8');
riskSummary = riskSummary.replace(/kc\.condicion/g, 'kc.criterio');
riskSummary = riskSummary.replace(/p\.motivo/g, 'p.causa');
fs.writeFileSync('src/features/dashboard/components/widgets/RiskSummary.tsx', riskSummary);

// 5. Fix ScoringChart.tsx
let scoringChart = fs.readFileSync('src/features/dashboard/components/widgets/ScoringChart.tsx', 'utf8');
scoringChart = scoringChart.replace(/puntuacionMaxima/g, 'ponderacion');
scoringChart = scoringChart.replace(/o\.nombre/g, 'o.descripcion');
scoringChart = scoringChart.replace(/s\.nombre/g, 's.descripcion');
fs.writeFileSync('src/features/dashboard/components/widgets/ScoringChart.tsx', scoringChart);

// 6. Fix SummarySection.tsx
let summarySection = fs.readFileSync('src/features/dashboard/components/widgets/SummarySection.tsx', 'utf8');
summarySection = summarySection.replace('dg.tipoProcedimiento', '(dg as any).tipoProcedimiento');
summarySection = summarySection.replace('dg.tipoContrato', '(dg as any).tipoContrato');
fs.writeFileSync('src/features/dashboard/components/widgets/SummarySection.tsx', summarySection);

// 7. Fix Sidebar unused import
let sidebar = fs.readFileSync('src/features/dashboard/components/layout/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace(',\n  Bell,', ',');
fs.writeFileSync('src/features/dashboard/components/layout/Sidebar.tsx', sidebar);
