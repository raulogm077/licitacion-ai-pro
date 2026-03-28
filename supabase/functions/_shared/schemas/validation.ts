/**
 * Schema de Validación Final (Fase E)
 *
 * Define la estructura del reporte de validación que se genera
 * tras consolidar todos los bloques.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { z } from 'npm:zod@3.22.4';
import { QualityStatusEnum } from './canonical.ts';

export const ValidationIssueSchema = z.object({
    field: z.string(),
    severity: z.enum(['critical', 'warning', 'info']),
    message: z.string(),
    suggestion: z.string().optional(),
});

export const ValidationReportSchema = z.object({
    overall: QualityStatusEnum,
    bySection: z.record(QualityStatusEnum).default({}),
    missingCriticalFields: z.array(z.string()).default([]),
    ambiguous_fields: z.array(z.string()).default([]),
    contradictions: z
        .array(
            z.object({
                field: z.string(),
                values: z.array(z.string()),
                sources: z.array(z.string()),
                resolution: z.string().optional(),
            })
        )
        .default([]),
    warnings: z.array(z.string()).default([]),
    issues: z.array(ValidationIssueSchema).default([]),
    evidenceCoverage: z
        .object({
            totalCriticalFields: z.number(),
            fieldsWithEvidence: z.number(),
            coveragePercent: z.number(),
        })
        .optional(),
});

export type ValidationReport = z.infer<typeof ValidationReportSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
