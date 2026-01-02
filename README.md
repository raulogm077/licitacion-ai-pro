# Analista de Pliegos - AI-Powered Public Tender Analyzer

[![Build Status](https://github.com/your-org/analista-de-pliegos/workflows/CI%2FCD/badge.svg)](https://github.com/your-org/analista-de-pliegos/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/tests-136%20passing-success.svg)](.)

> Analiza automáticamente pliegos de licitación pública usando IA, extrayendo información clave y generando reportes profesionales.

## 🎯 Features

- **📄 AI-Powered Analysis** - Extracción automática de datos usando Gemini AI
- **⚡ Real-time Processing** - Análisis de PDFs con feedback en tiempo real
- **📊 Smart Filtering** - Búsqueda avanzada y filtrado por múltiples criterios
- **📈 Analytics Dashboard** - Visualización de tendencias y estadísticas
- **📤 Multi-format Export** - Exportación a PDF, Excel y presentaciones
- **🔍 Advanced Search** - Motor de búsqueda full-text con filtros contextuales
- **🎨 Modern UI** - Interfaz responsive con modo oscuro

## 🏗️ Architecture

**Updated Jan 2026**: This project uses **OpenAI Agents SDK** for AI-powered analysis with real-time streaming.

```
User → Frontend → analyze-with-agents (Edge Function)
         ↓
  OpenAI Files API + Vector Store
         ↓
  Agents SDK (streaming)
         ↓
  SSE Real-time Events → UI
```

**Key Benefits**:
- ✅ Real-time feedback via Server-Sent Events (SSE)
- ✅ Simplified architecture (no queues, no polling)
- ✅ OpenAI Vector Store for intelligent PDF search
- ✅ Type-safe with Zod schemas

📖 **For detailed architecture**, see [ARCHITECTURE.md](./ARCHITECTURE.md)

📋 **Migration notes**, see [DEPRECATED.md](./DEPRECATED.md)

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase account ([supabase.com](https://supabase.com))
- Google AI API key ([ai.google.dev](https://ai.google.dev))

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/analista-de-pliegos.git
cd analista-de-pliegos

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your keys

# Run database migrations
npm run supabase:migrate

# Start development server
npm run dev
```

Visit `http://localhost:5173`

## 📦 Environment Variables

```env
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional - Monitoring (Production)
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
VITE_ENVIRONMENT=production

# Optional - Feature Flags
VITE_FEATURE_PDF_UPLOAD=true
VITE_FEATURE_AI_ANALYSIS=true
VITE_MAX_UPLOAD_MB=10
```

See [Environment Setup Guide](docs/staging-setup.md) for detailed configuration.

## 🏗️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **React Router** - Navigation
- **Zod** - Runtime validation

### Backend & Services
- **Supabase** - Database & Auth
- **Edge Functions** - Serverless API
- **Google Gemini AI** - Document analysis
- **Vercel** - Hosting & CDN

### Quality
- **Vitest** - Unit testing (136 tests)
- **Playwright** - E2E testing
- **ESLint** - Code linting
- **TypeScript** - Strict mode

## 📁 Project Structure

```
analista-de-pliegos/
├── src/
│   ├── components/       # Reusable UI components
│   ├── features/         # Feature modules (dashboard, search, etc.)
│   ├── pages/           # Page components
│   ├── services/        # API services (AI, DB, Analytics)
│   ├── stores/          # Zustand stores
│   ├── lib/             # Utilities & schemas
│   └── config/          # App configuration & feature flags
├── e2e/                 # Playwright E2E tests
├── supabase/            # Database migrations & edge functions
├── docs/                # Documentation guides
└── .github/workflows/   # CI/CD pipelines
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Run linting
npm run lint

# Type checking
npm run typecheck

# Full build (lint + typecheck + test + build)
npm run build
```

**Test Coverage**: 136 unit/integration tests + 7 E2E spec files

## 🚢 Deployment

### Automatic Deployment (Recommended)

Push to `main` branch triggers automatic deployment:

```bash
git push origin main
```

Pipeline executes:
1. ✅ Security audit
2. ✅ Lint + TypeScript + Tests
3. ✅ E2E tests
4. ✅ Deploy to Vercel (Frontend)
5. ✅ Deploy to Supabase (Backend)
6. ✅ Smoke tests

See [Deployment Guide](docs/deployment_guide.md) for details.

### Manual Deployment

```bash
# Deploy to Vercel
vercel --prod

# Deploy Supabase functions
supabase functions deploy
```

## 📊 Monitoring & Observability

### Health Checks

```bash
# Production health
curl https://analista-de-pliegos.vercel.app/api/health

# Response
{
  "status": "ok",
  "uptime": 123456,
  "environment": "production"
}
```

### Analytics
- **Vercel Speed Insights** - Performance monitoring (active)
- **Vercel Web Analytics** - Traffic & user behavior (setup guide available)
- **Sentry** - Error tracking (optional, template ready)

See [Observability Guide](docs/observability_walkthrough.md)

## 🎭 Feature Flags

Control features via environment variables or code:

```typescript
import { features, isEnabled } from '@/config/features';

if (isEnabled('enablePDFUpload')) {
  // Feature is enabled
}

const maxSize = features.maxUploadSizeMB;
```

See [Feature Flags Guide](docs/feature_flags_guide.md) for all options.

## 🔐 Security

- ✅ Environment variable validation at startup
- ✅ Supabase Row Level Security (RLS) policies
- ✅ XSS protection via DOMPurify
- ✅ No service_role key exposure
- ✅ CORS configuration
- ✅ Rate limiting on Edge Functions

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Make changes and add tests
3. Ensure tests pass: `npm test`
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open Pull Request

## 📚 Documentation

- [Deployment Guide](docs/deployment_guide.md) - CI/CD & rollback procedures
- [Sentry Setup](docs/sentry_setup_guide.md) - Error tracking integration
- [Staging Environment](docs/staging-setup.md) - Staging branch configuration
- [Performance Optimization](docs/performance_optimization.md) - Server-side filtering
- [Vercel Analytics](docs/vercel_analytics_guide.md) - Monitoring setup
- [Feature Flags](docs/feature_flags_guide.md) - Progressive rollouts

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Google Gemini AI for document analysis
- Supabase for backend infrastructure
- Vercel for hosting and analytics
- Open source community

---

**Status**: ✅ Production Ready  
**Build**: Passing (136/136 tests)  
**Deployment**: Automatic via CI/CD  
**Last Updated**: 2025-12-29
