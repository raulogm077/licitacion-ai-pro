import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, ArrowRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/auth.store';
import { useAnalysisStore } from '../../../stores/analysis.store';
import { AuthModal } from '../../../components/ui/AuthModal';
import { Dropzone } from './wizard/Dropzone';
import { AnalysisProgress } from './wizard/AnalysisProgress';
import { RecentTenders } from './wizard/RecentTenders';
import { Button } from '../../../components/ui/Button';

type WizardState = "idle" | "ready" | "analyzing" | "error"

export const AnalysisWizard: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const { status, error, analyzeFile, resetAnalysis } = useAnalysisStore();

  const [state, setState] = useState<WizardState>("idle")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (status === 'ANALYZING' || status === 'READING_PDF') setState("analyzing");
    else if (status === 'ERROR') setState("error");
    else if (status === 'IDLE' && selectedFile) setState("ready");
    else if (status === 'IDLE') setState("idle");
  }, [status, selectedFile]);

  const handleFileAccepted = (file: File) => {
    if (!isAuthenticated) {
        setShowAuthModal(true);
        return;
    }
    setSelectedFile(file)
    setState("ready")
  }

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    setState("analyzing");
    // Trigger real analysis
    await analyzeFile(selectedFile);
  }

  return (
    <main className="flex flex-col items-center gap-10 px-4 py-10 md:py-14 max-w-[900px] mx-auto w-full animate-fade-in">
      {/* Auth Modal */}
      {showAuthModal && (
          <AuthModal
              isOpen={showAuthModal}
              onClose={() => setShowAuthModal(false)}
                        />
      )}

      {/* Hero text */}
      {state === "idle" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold font-sans mb-1"
            style={{
              backgroundColor: "rgba(0,229,255,0.1)",
              color: "var(--brand-cyan-dim)",
              border: "1px solid rgba(0,229,255,0.25)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Análisis inteligente de licitaciones
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold font-sans text-balance leading-tight"
            style={{ color: "var(--brand-navy)" }}
          >
            Analiza pliegos en{" "}
            <span style={{ color: "var(--brand-cyan-dim)" }}>segundos</span>,<br className="hidden md:block" />
            no en días
          </h1>
          <p className="text-base text-slate-500 font-sans leading-relaxed max-w-lg text-pretty">
            Sube el PDF del pliego de licitación y obtén un análisis completo de riesgos,
            cláusulas clave y criterios de adjudicación de forma automática.
          </p>
        </div>
      )}

      {/* Stats bar (idle only) */}
      {state === "idle" && (
        <div className="grid grid-cols-3 gap-4 w-full">
          {[
            { value: "2.400+", label: "Pliegos analizados" },
            { value: "94%", label: "Precisión de IA" },
            { value: "<45s", label: "Tiempo promedio" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center gap-0.5 py-3 px-4 rounded-xl bg-white border border-slate-200 shadow-sm"
            >
              <span
                className="text-xl font-bold font-sans tabular-nums"
                style={{ color: "var(--brand-navy)" }}
              >
                {stat.value}
              </span>
              <span className="text-xs text-slate-500 font-sans text-center leading-tight">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Main upload card */}
      <div
        className="w-full rounded-2xl overflow-hidden transition-all duration-500 bg-white border border-slate-200 shadow-xl shadow-navy/5"
      >
        {/* Card header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
          style={{
            background: "linear-gradient(135deg, rgba(0,28,61,0.02) 0%, rgba(0,229,255,0.02) 100%)",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${state === "analyzing" ? "animate-pulse" : ""}`}
              style={{
                backgroundColor:
                  state === "analyzing"
                    ? "var(--brand-cyan)"
                    : state === "error"
                    ? "#ef4444"
                    : "#94a3b8",
              }}
            />
            <span
              className="text-sm font-semibold font-sans"
              style={{ color: "var(--brand-navy)" }}
            >
              {state === "idle" || state === "ready"
                ? "Cargar pliego de licitación"
                : state === "analyzing"
                ? "Analizando documento"
                : "Error en el análisis"}
            </span>
          </div>

          {/* Breadcrumb steps */}
          <div className="hidden md:flex items-center gap-1.5">
            {["Subida", "Análisis", "Resultados"].map((step, i) => {
              const stepNum = i + 1
              const isActive =
                (stepNum === 1 && (state === "idle" || state === "ready" || state === "error")) ||
                (stepNum === 2 && state === "analyzing")
              const isDone =
                (stepNum === 1 && state === "analyzing")
              return (
                <div key={step} className="flex items-center gap-1.5">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all"
                    style={{
                      backgroundColor: isActive
                        ? "rgba(0,28,61,0.08)"
                        : isDone
                        ? "rgba(0,229,255,0.12)"
                        : "transparent",
                    }}
                  >
                    <span
                      className="text-xs font-medium font-sans"
                      style={{
                        color: isActive
                          ? "var(--brand-navy)"
                          : isDone
                          ? "var(--brand-cyan-dim)"
                          : "#94a3b8",
                      }}
                    >
                      {step}
                    </span>
                  </div>
                  {i < 2 && (
                    <ChevronRight className="w-3 h-3" style={{ color: "#cbd5e1" }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Card body */}
        <div className="px-6 py-6">
          {(state === "idle" || state === "ready" || state === "error") && (
            <div className="flex flex-col gap-5">
              <Dropzone onFileAccepted={handleFileAccepted} disabled={false} />

              {state === "error" && error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in fade-in">
                    <X className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <h3 className="font-semibold text-red-800 text-sm">Error en el análisis</h3>
                        <p className="text-xs text-red-600 mt-1 whitespace-pre-wrap font-mono">{error}</p>
                        <button
                            onClick={() => resetAnalysis()}
                            className="mt-2 text-xs font-medium text-red-700 hover:text-red-900 underline decoration-red-300"
                        >
                            {t('common.retry', 'Reintentar')}
                        </button>
                    </div>
                </div>
              )}

              {state === "ready" && selectedFile && (
                <Button
                  onClick={handleStartAnalysis}
                  className="w-full h-12 text-sm font-semibold font-sans rounded-xl gap-2 transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.98] border-0"
                  style={{
                    background: "linear-gradient(135deg, var(--brand-navy) 0%, #00304f 100%)",
                    color: "white",
                    boxShadow: "0 4px 14px rgba(0,28,61,0.3)",
                  }}
                >
                  <Sparkles className="w-4.5 h-4.5" style={{ color: "var(--brand-cyan)" }} />
                  {t('wizard.start_button', 'Analizar Pliego')}
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              )}
            </div>
          )}

          {state === "analyzing" && selectedFile && (
            <AnalysisProgress
              fileName={selectedFile.name}
            />
          )}
        </div>
      </div>

      {/* Recent tenders — only show on idle */}
      {state === "idle" && <RecentTenders />}
    </main>
  )
}
