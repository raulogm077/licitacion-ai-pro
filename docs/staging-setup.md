# Staging Environment Setup

## Variables de Entorno

```env
# .env.staging
VITE_ENVIRONMENT=staging
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

## Configuración Vercel

### 1. Crear Deployment para Staging

```bash
# En Vercel Dashboard:
# Settings → Git → Branch Deployments
# - Production Branch: main
# - Preview Branches: staging
```

### 2. Environment Variables por Branch

En Vercel Dashboard → Settings → Environment Variables:

| Variable | Production | Staging | Development |
|----------|-----------|---------|-------------|
| VITE_SUPABASE_URL | ✅ | ✅ | ✅ |
| VITE_SUPABASE_ANON_KEY | ✅ | ✅ | ✅ |
| VITE_SENTRY_DSN | ✅ | ✅ | ❌ |
| VITE_ENVIRONMENT | production | staging | development |

### 3. Deploy Command

```bash
# Push to staging branch
git checkout -b staging
git push origin staging

# Auto-deploys to:
# https://analista-de-pliegos-staging.vercel.app
```

## Testing en Staging

```bash
# 1. Smoke test
curl https://analista-de-pliegos-staging.vercel.app/api/health

# 2. Verify environment
# Should show: "environment": "staging"

# 3. Test Sentry integration
# Trigger error and verify in Sentry dashboard
```

## Rollback Staging

```bash
# Option 1: Revert commit
git revert HEAD
git push origin staging

# Option 2: Reset to previous commit
git reset --hard HEAD~1
git push -f origin staging
```

## Branch Protection

```yaml
# .github/branch-protection.yml (create if needed)
staging:
  required_status_checks:
    - lint
    - test
    - build
  enforce_admins: false
  allow_force_pushes: false
```
