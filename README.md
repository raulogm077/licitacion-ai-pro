# Analista de Pliegos (Licitacion AI Pro)

![CI/CD Status](https://github.com/raulogm077/licitacion-ai-pro/actions/workflows/ci-cd.yml/badge.svg)
**Deployment**: [https://licitacion-ai-pro.vercel.app](https://licitacion-ai-pro.vercel.app)

## CI/CD Pipeline
- **GitHub Actions**: Runs `npm test` and `npm run lint` on every push.
- **Vercel**: Automatically deploys the `main` branch if tests pass.
- **Supabase**: Database migrations are managed via CLI/Env vars.

## Environment Variables
Create a `.env` file in the root directory:

| Variable | Description |
|----------|-------------|
| `VITE_GEMINI_API_KEY` | Google Gemini API Key |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anonymous Key |
| `VITE_GEMINI_MODEL` | (Optional) Model name, e.g., `gemini-flash-latest` |
| `VITE_SITE_URL` | Application URL for redirects |

## Local Development
1. `npm install`
2. `cp .env.example .env` (fill with your keys)
3. `npm run dev`

## Testing
- Unit: `npm test`
- E2E: `npx playwright test`
