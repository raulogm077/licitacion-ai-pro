import { tool } from 'npm:@openai/agents@0.1.0';
import { z } from 'npm:zod@3.25.76';
import type { StoredAnalysisEnvelope, Citation } from './types.ts';

type ToolDeps = {
  analysisHash: string;
  loadAnalysis: (analysisHash: string) => Promise<StoredAnalysisEnvelope>;
  trackToolUse: (toolName: string) => void;
};

export function createAnalysisTools(deps: ToolDeps) {
  const getAnalysisOverview = tool({
    name: 'get_analysis_overview',
    description: 'Devuelve una visión general del expediente ya analizado.',
    parameters: z.object({}),
    async execute() {
      deps.trackToolUse('get_analysis_overview');
      const analysis = await deps.loadAnalysis(deps.analysisHash);
      const resultRoot = getResultRoot(analysis.data);
      const workflow = getWorkflow(analysis.data);

      return {
        datosGenerales: pickObject(resultRoot, 'datosGenerales'),
        criteriosAdjudicacion: pickObject(resultRoot, 'criteriosAdjudicacion'),
        requisitosSolvencia: pickObject(resultRoot, 'requisitosSolvencia'),
        restriccionesYRiesgos: pickObject(resultRoot, 'restriccionesYRiesgos'),
        quality: workflow?.quality ?? null,
        warnings: workflow?.quality?.warnings ?? [],
        updatedAt: analysis.updated_at ?? null,
      };
    },
  });

  const getFieldValue = tool({
    name: 'get_field_value',
    description:
      'Obtiene el valor exacto de un campo del análisis usando un fieldPath.',
    parameters: z.object({
      fieldPath: z.string(),
    }),
    async execute({ fieldPath }) {
      deps.trackToolUse('get_field_value');
      const analysis = await deps.loadAnalysis(deps.analysisHash);
      const resultRoot = getResultRoot(analysis.data);
      const raw = resolveFieldPath(resultRoot, fieldPath);

      return {
        fieldPath,
        value: normalizeFieldValue(raw),
        found: raw !== undefined,
      };
    },
  });

  const getFieldEvidence = tool({
    name: 'get_field_evidence',
    description:
      'Obtiene las evidencias asociadas a un fieldPath del análisis persistido.',
    parameters: z.object({
      fieldPath: z.string(),
    }),
    async execute({ fieldPath }) {
      deps.trackToolUse('get_field_evidence');
      const analysis = await deps.loadAnalysis(deps.analysisHash);

      return {
        fieldPath,
        citations: extractEvidence(analysis.data, fieldPath),
      };
    },
  });

  const listQualityWarnings = tool({
    name: 'list_quality_warnings',
    description:
      'Lista warnings, campos ambiguos y faltantes detectados por el pipeline.',
    parameters: z.object({}),
    async execute() {
      deps.trackToolUse('list_quality_warnings');
      const analysis = await deps.loadAnalysis(deps.analysisHash);
      const workflow = getWorkflow(analysis.data);

      return workflow?.quality ?? {};
    },
  });

  const searchAnalysisText = tool({
    name: 'search_analysis_text',
    description:
      'Busca texto relevante dentro del análisis persistido y devuelve coincidencias con fieldPath.',
    parameters: z.object({
      query: z.string().min(1),
    }),
    async execute({ query }) {
      deps.trackToolUse('search_analysis_text');
      const analysis = await deps.loadAnalysis(deps.analysisHash);
      const resultRoot = getResultRoot(analysis.data);

      return {
        query,
        matches: searchInObject(resultRoot, query),
      };
    },
  });

  return [
    getAnalysisOverview,
    getFieldValue,
    getFieldEvidence,
    listQualityWarnings,
    searchAnalysisText,
  ];
}

export function getResultRoot(
  data: Record<string, unknown>
): Record<string, unknown> {
  if (
    data.result &&
    typeof data.result === 'object' &&
    !Array.isArray(data.result)
  ) {
    return data.result as Record<string, unknown>;
  }
  return data;
}

export function getWorkflow(
  data: Record<string, unknown>
): Record<string, any> | null {
  if (
    data.workflow &&
    typeof data.workflow === 'object' &&
    !Array.isArray(data.workflow)
  ) {
    return data.workflow as Record<string, any>;
  }
  return null;
}

function pickObject(
  root: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const value = root[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function resolveFieldPath(
  root: Record<string, unknown>,
  fieldPath: string
): unknown {
  return fieldPath.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, root);
}

export function normalizeFieldValue(raw: unknown): unknown {
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'value' in (raw as Record<string, unknown>)
  ) {
    const tracked = raw as Record<string, unknown>;
    return {
      value: tracked.value ?? null,
      status: tracked.status ?? null,
      warnings: tracked.warnings ?? [],
    };
  }
  return raw ?? null;
}

export function extractEvidence(
  data: Record<string, unknown>,
  fieldPath: string
): Citation[] {
  const citations: Citation[] = [];
  const resultRoot = getResultRoot(data);
  const raw = resolveFieldPath(resultRoot, fieldPath);

  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'evidence' in (raw as Record<string, unknown>)
  ) {
    const evidence = (raw as Record<string, unknown>).evidence;
    if (isEvidenceLike(evidence)) {
      citations.push({
        fieldPath,
        quote: evidence.quote,
        pageHint: evidence.pageHint ?? null,
        confidence: evidence.confidence ?? null,
      });
    }
  }

  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'cita' in (raw as Record<string, unknown>) &&
    typeof (raw as Record<string, unknown>).cita === 'string'
  ) {
    citations.push({
      fieldPath,
      quote: String((raw as Record<string, unknown>).cita),
      pageHint: null,
      confidence: null,
    });
  }

  const workflow = getWorkflow(data);
  const workflowEvidences = Array.isArray(workflow?.evidences)
    ? workflow?.evidences
    : [];

  for (const item of workflowEvidences) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const candidate = item as Record<string, unknown>;
    const candidatePath =
      typeof candidate.fieldPath === 'string' ? candidate.fieldPath : undefined;

    if (candidatePath !== fieldPath) {
      continue;
    }

    if (typeof candidate.quote !== 'string') {
      continue;
    }

    citations.push({
      fieldPath: candidatePath ?? null,
      quote: candidate.quote,
      pageHint:
        typeof candidate.pageHint === 'string' ? candidate.pageHint : null,
      confidence:
        typeof candidate.confidence === 'number'
          ? candidate.confidence
          : null,
    });
  }

  return dedupeCitations(citations);
}

export function searchInObject(
  root: Record<string, unknown>,
  query: string
): Array<{ fieldPath: string; excerpt: string }> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const matches: Array<{ fieldPath: string; excerpt: string }> = [];

  visitNode(root, '', (fieldPath, value) => {
    const text = stringifyLeaf(value);
    if (!text) {
      return;
    }

    const normalized = text.toLowerCase();
    if (terms.every((term) => normalized.includes(term))) {
      matches.push({
        fieldPath,
        excerpt: text.length > 280 ? `${text.slice(0, 277)}...` : text,
      });
    }
  });

  return matches.slice(0, 10);
}

function visitNode(
  value: unknown,
  path: string,
  visitor: (fieldPath: string, value: unknown) => void
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      visitNode(item, path ? `${path}.${index}` : String(index), visitor);
    });
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      visitNode(child, path ? `${path}.${key}` : key, visitor);
    }
    return;
  }

  if (path) {
    visitor(path, value);
  }
}

function stringifyLeaf(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function isEvidenceLike(value: unknown): value is Citation {
  return !!value && typeof value === 'object' && typeof (value as Citation).quote === 'string';
}

function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const deduped: Citation[] = [];

  for (const citation of citations) {
    const key = JSON.stringify(citation);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(citation);
  }

  return deduped;
}
