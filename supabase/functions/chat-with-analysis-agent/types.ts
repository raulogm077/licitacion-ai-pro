import { z } from 'npm:zod@3.25.76';

export const ChatRequestSchema = z.object({
  analysisHash: z.string().min(1, 'analysisHash requerido'),
  message: z.string().min(1, 'message requerido'),
  sessionId: z.string().uuid().optional(),
});

export const CitationSchema = z.object({
  fieldPath: z.string().nullable(),
  quote: z.string(),
  pageHint: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});

export const ChatAgentOutputSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatAgentOutput = z.infer<typeof ChatAgentOutputSchema>;
export type Citation = z.infer<typeof CitationSchema>;

export type AnalysisChatRunContext = {
  userId: string;
  analysisHash: string;
};

export type StoredAnalysisEnvelope = {
  hash: string;
  data: Record<string, unknown>;
  updated_at?: string;
};
