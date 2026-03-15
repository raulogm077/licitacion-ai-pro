# 📝 Agents SDK Migration - Architecture Update

**Added to README.md** - Section about the new architecture

---

## 🏗️ Architecture (Updated Jan 2026)

### Current: OpenAI Agents SDK with Streaming

```
User uploads PDF
       ↓
Frontend (React + Vite)
       ↓
JobService.analyzeWithAgents()
       ↓
Supabase Edge Function: analyze-with-agents
       ↓
┌──────────────────────────────────────┐
│ 1. Upload PDF → OpenAI Files API    │
│ 2. Create Vector Store (file_search)│
│ 3. Wait for indexing completion     │
│ 4. Initialize Agent (Agents SDK)    │
│ 5. Run with streaming enabled       │
│ 6. Stream events via SSE             │
└──────────────────────────────────────┘
       ↓
Real-time SSE Stream
  - heartbeat events (keep-alive)
  - agent_message events (progress)
  - complete event (final result)
       ↓
Frontend receives events
       ↓
Transform Agent schema → Frontend schema
       ↓
Validate with Zod
       ↓
Render in UI (real-time)
```

### Key Components

**Frontend**:
- `src/services/job.service.ts` - `analyzeWithAgents()` method
- `src/agents/utils/schema-transformer.ts` - Response transformation
- SSE stream consumption with ReadableStream

**Backend (Supabase Edge Functions)**:
- `supabase/functions/analyze-with-agents/` - Main analysis function
  - OpenAI Files API integration
  - Vector Store management  
  - Agents SDK streaming
  - SSE event streaming

**Agent Configuration**:
- `src/agents/analista.agent.ts` - Agent instance
- `src/agents/tools/submit-result.tool.ts` - Result submission tool
- `src/agents/schemas/licitacion-agent.schema.ts` - Zod schemas
- `src/agents/utils/instructions.ts` - 143 lines of instructions

### Benefits vs Previous Architecture

| Feature | Old (pgmq + cron) | New (Agents SDK) |
|---------|-------------------|------------------|
| **Response Time** | 60-120s (polling) | 30-90s (streaming) |
| **Real-time Feedback** | ❌ No | ✅ Yes (SSE) |
| **Architecture Complexity** | High (queue + cron + polling) | Low (single function) |
| **Database Load** | High (polling every 5s) | Minimal (no polling) |
| **Scalability** | Limited (cron bottleneck) | High (concurrent streams) |
| **Maintenance** | 2 functions + 3 migrations | 1 function |
| **Code Lines** | ~850 | ~610 |

---

## 🚀 Development

### Running Locally

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - OPENAI_API_KEY (in Supabase secrets)

# Start dev server
npm run dev

# Run tests
npm test

# Type check
npm run type-check
```

### Deploying Edge Functions

```bash
# Deploy new analysis function
npx supabase functions deploy analyze-with-agents --no-verify-jwt

# Set OpenAI API key (first time only)
npx supabase secrets set OPENAI_API_KEY=sk-...

# Check deployment
npx supabase functions list
```

---

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run specific test
npx vitest run src/agents/__tests__/agent.test.ts

# Coverage
npm run test:coverage
```

### E2E Testing
```bash
# Start dev server
npm run dev

# Upload a PDF through UI
# Check browser console for:
# - [JobService] Iniciando análisis...
# - [Agent]: Processing...
# - [JobService] ✅ Análisis completado

# Verify:
# - Streaming events received
# - No errors in console
# - UI renders data correctly
```

---

## 📖 API Reference

### JobService.analyzeWithAgents()

```typescript
async analyzeWithAgents(
  pdfBase64: string,
  guiaBase64: string | null,
  filename: string,
  onProgress?: (event: StreamEvent) => void
): Promise<LicitacionContent>
```

**Parameters**:
- `pdfBase64`: PDF file in base64 format
- `guiaBase64`: Guide PDF in base64 format
- `filename`: Original filename
- `onProgress`: Callback for streaming events

**Returns**: Validated `LicitacionContent` object

**Events**:
```typescript
interface StreamEvent {
  type: 'heartbeat' | 'agent_message' | 'complete' | 'error';
  content?: string | any;
  result?: any;
  message?: string;
  timestamp: number;
}
```

---

## 📚 Migration Guide

If upgrading from the old architecture:

1. **Remove old code**: See `DEPRECATED.md`
2. **Update frontend calls**: Replace `startJob()` with `analyzeWithAgents()`
3. **Remove polling logic**: No longer needed with streaming
4. **Update tests**: Adapt to new async patterns
5. **Pass Guia de Lectura**: Provide `guiaBase64` file content to the Edge function via `jobService`.

For full migration details, see:
- `migration_progress_report.md`
- `iter5_testing_guide.md`
- `architecture_diagrams.md`

---

## 🐛 Troubleshooting

### Common Issues

**CORS Errors**
- Check `supabase/functions/_shared/cors.ts` has `Access-Control-Allow-Origin: *`

**Timeout on Large PDFs**
- Supabase FREE tier: 150s limit
- Consider Vercel (300s) or Supabase Pro
- Or split PDFs into smaller chunks

**Stream Not Receiving Events**
- Check browser console for fetch errors
- Verify Authorization header is set
- Check Edge Function logs in Supabase Dashboard

**Validation Errors**
- Check transformer output matches `LicitacionContentSchema`
- Verify all required fields are present
- Check console for Zod error details

---

## 📄 License

MIT © Antigravity
