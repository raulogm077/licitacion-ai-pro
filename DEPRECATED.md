# Deprecated Components - Agents SDK Migration

**Date**: 2026-01-02  
**Migration**: OpenAI Assistants API + pgmq → OpenAI Agents SDK

---

## 🗑️ Removed Files

### Migrations (3 files)
These migrations were part of the old async architecture using pgmq and pg_cron:

- ❌ `supabase/migrations/20260101000000_enable_pgmq.sql`
  - Purpose: Enable pgmq extension for queue management
  - Reason: Agents SDK uses streaming, no need for queues
  
- ❌ `supabase/migrations/20260101000001_create_cron_jobs.sql`
  - Purpose: Setup pg_cron jobs for queue processing and sync
  - Reason: No queues = no need for cron jobs
  
- ❌ `supabase/migrations/20260101000002_create_storage_bucket.sql`
  - Purpose: Create storage bucket for PDF files
  - Reason: Agents SDK uploads directly to OpenAI Files API

### Edge Functions (1 function)
- ❌ `supabase/functions/queue-processor/`
  - Purpose: Process jobs from pgmq queue asynchronously
  - Reason: Replaced by `analyze-with-agents` with streaming

---

## ⚠️ Kept for Compatibility

### Edge Function
- ✅ `supabase/functions/openai-runner/`
  - **Status**: Still in use (Legacy)
  - **Usage**: Called by `JobService.startJob()` for legacy polling-based analysis
  - **Reason**: Kept for backwards compatibility with existing startJob API
  - **Action**: Can be removed once analyzeWithAgents() is proven stable (after Jan 2026)
  - **Replacement**: `supabase/functions/analyze-with-agents/` (Streaming)

---

## 📝 Migration Summary

### Old Architecture (Removed)
```
User → Frontend → openai-runner (enqueue) 
                   ↓
              pgmq queue
                   ↓
        queue-processor (pg_cron 30s)
                   ↓
         OpenAI Assistants API
                   ↓
         Polling (pg_cron 60s)
                   ↓
            analysis_jobs table
                   ↓
          Frontend (polling)
```

### New Architecture (Current)
```
User → Frontend → analyze-with-agents
                   ↓
        OpenAI Files API (upload PDF)
                   ↓
           Vector Store creation
                   ↓
         OpenAI Agents SDK (streaming)
                   ↓
      SSE stream → Frontend (real-time)
```

---

## 🔄 If You Need to Rollback

If for any reason you need to restore the old architecture:

```bash
# Checkout files from previous commit
git show 3088c77:supabase/migrations/20260101000000_enable_pgmq.sql > supabase/migrations/20260101000000_enable_pgmq.sql
git show 3088c77:supabase/migrations/20260101000001_create_cron_jobs.sql > supabase/migrations/20260101000001_create_cron_jobs.sql
git show 3088c77:supabase/migrations/20260101000002_create_storage_bucket.sql > supabase/migrations/20260101000002_create_storage_bucket.sql
git show 3088c77:supabase/functions/queue-processor/index.ts > supabase/functions/queue-processor/index.ts

# Apply migrations
npx supabase db reset

# Deploy function
npx supabase functions deploy queue-processor
```

---

## ✅ Benefits of New Architecture

1. **Simpler**: No queues, no cron jobs, no polling
2. **Faster**: Real-time streaming vs polling
3. **Cheaper**: Less database operations
4. **Scalable**: Agents SDK handles concurrency
5. **Maintainable**: 1 function instead of 2 + migrations

---

## 📅 Timeline

- **2026-01-01**: Old architecture created (pgmq + cron)
- **2026-01-02**: Agents SDK migration completed
- **2026-01-02**: Removed old pgmq/cron files
- **2026-01-02**: Code quality improvements (0 ESLint warnings achieved)
- **Planned Q1 2026**: Remove openai-runner after analyzeWithAgents stability confirmed

---

## 📞 Contact

If you have questions about this migration:
- Review: `migration_progress_report.md`
- Testing: `iter5_testing_guide.md`
- Architecture: `architecture_diagrams.md`
