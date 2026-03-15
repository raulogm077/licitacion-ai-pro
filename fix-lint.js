import fs from 'fs';

// Header.tsx
let header = fs.readFileSync('src/features/dashboard/components/layout/Header.tsx', 'utf8');
header = header.replace(/\(vm\.result\.datosGenerales as any\)\.numeroExpediente/g, '(vm.result.datosGenerales as Record<string, unknown>).numeroExpediente as string');
fs.writeFileSync('src/features/dashboard/components/layout/Header.tsx', header);

// SummarySection.tsx
let summarySection = fs.readFileSync('src/features/dashboard/components/widgets/SummarySection.tsx', 'utf8');
summarySection = summarySection.replace(/\(dg as any\)\.tipoProcedimiento/g, '(dg as Record<string, unknown>).tipoProcedimiento as string');
summarySection = summarySection.replace(/\(dg as any\)\.tipoContrato/g, '(dg as Record<string, unknown>).tipoContrato as string');
fs.writeFileSync('src/features/dashboard/components/widgets/SummarySection.tsx', summarySection);
