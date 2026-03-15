import { FileText, ArrowRight, Clock, Building2 } from "lucide-react"

const RECENT_TENDERS = [
  {
    id: "T-2024-0341",
    title: "Suministro e implantación de sistema de gestión hospitalaria",
    entity: "Servicio Madrileño de Salud (SERMAS)",
    date: "Hace 2 días",
    status: "analyzed",
    statusLabel: "Analizado",
    riskLevel: "bajo",
    budget: "4.200.000 €",
    pages: 187,
  },
  {
    id: "T-2024-0298",
    title: "Desarrollo de plataforma digital para tramitación de expedientes",
    entity: "Ayuntamiento de Barcelona",
    date: "Hace 5 días",
    status: "warning",
    statusLabel: "Requiere revisión",
    riskLevel: "medio",
    budget: "1.850.000 €",
    pages: 124,
  },
  {
    id: "T-2024-0271",
    title: "Mantenimiento y soporte de infraestructura tecnológica",
    entity: "Ministerio de Hacienda",
    date: "Hace 1 semana",
    status: "analyzed",
    statusLabel: "Analizado",
    riskLevel: "alto",
    budget: "680.000 €",
    pages: 98,
  },
]

const riskConfig = {
  bajo: {
    label: "Riesgo bajo",
    bg: "rgba(16,185,129,0.08)",
    color: "#059669",
    dot: "#10b981",
  },
  medio: {
    label: "Riesgo medio",
    bg: "rgba(245,158,11,0.08)",
    color: "#d97706",
    dot: "#f59e0b",
  },
  alto: {
    label: "Riesgo alto",
    bg: "rgba(239,68,68,0.08)",
    color: "#dc2626",
    dot: "#ef4444",
  },
}

export function RecentTenders() {
  return (
    <section className="flex flex-col gap-4 w-full mt-4 animate-fade-in">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h2
            className="text-sm font-semibold font-sans uppercase tracking-wider"
            style={{ color: "var(--brand-navy)" }}
          >
            Licitaciones recientes
          </h2>
        </div>
        <button
          className="flex items-center gap-1 text-xs font-medium font-sans transition-colors hover:opacity-80"
          style={{ color: "var(--brand-cyan-dim)" }}
        >
          Ver todas
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tender cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {RECENT_TENDERS.map((tender) => {
          const risk = riskConfig[tender.riskLevel as keyof typeof riskConfig]
          return (
            <button
              key={tender.id}
              type="button"
              className="group flex flex-col gap-3 p-4 rounded-xl text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-2 bg-white border border-slate-200"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 w-full">
                <div
                  className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg"
                  style={{ backgroundColor: "rgba(0,28,61,0.06)" }}
                >
                  <FileText className="w-4.5 h-4.5" style={{ color: "var(--brand-navy)" }} />
                </div>
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: risk.bg }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: risk.dot }}
                  />
                  <span
                    className="text-xs font-medium font-sans whitespace-nowrap"
                    style={{ color: risk.color }}
                  >
                    {risk.label}
                  </span>
                </div>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1 min-w-0 w-full">
                <p
                  className="text-sm font-semibold font-sans leading-snug line-clamp-2 text-balance group-hover:underline underline-offset-2"
                  style={{ color: "var(--brand-navy)" }}
                >
                  {tender.title}
                </p>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
                  <p className="text-xs text-slate-500 font-sans truncate">
                    {tender.entity}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 w-full mt-auto">
                <span className="text-xs text-slate-500 font-sans">{tender.date}</span>
                <span
                  className="text-xs font-semibold font-sans tabular-nums"
                  style={{ color: "var(--brand-navy)" }}
                >
                  {tender.budget}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
