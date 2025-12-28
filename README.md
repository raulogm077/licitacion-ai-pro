# Analista de Pliegos (Licitacion AI Pro)

![CI/CD Status](https://github.com/raulogm077/licitacion-ai-pro/actions/workflows/ci-cd.yml/badge.svg)
**Deployment**: [https://licitacion-ai-pro.vercel.app](https://licitacion-ai-pro.vercel.app)

## CI/CD Pipeline
- **GitHub Actions**: Runs `npm test` and `npm run lint` on every push.
- **Vercel**: Automatically deploys the `main` branch if tests pass.
- **Supabase**: Database migrations are managed via CLI/Env vars.

## Local Development
1. `npm install`
2. `npm run dev`

## Testing
- Unit: `npm test`
- E2E: `npx playwright test`
