import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

const ANALYSIS_STEPS = [
  { id: 1, label: "Leyendo y procesando el PDF...", duration: 1800 },
  { id: 2, label: "Extrayendo cláusulas contractuales...", duration: 2200 },
  { id: 3, label: "Identificando requisitos técnicos...", duration: 1600 },
  { id: 4, label: "Analizando matriz de riesgos...", duration: 2400 },
  { id: 5, label: "Calculando criterios de evaluación...", duration: 1400 },
  { id: 6, label: "Generando informe de análisis...", duration: 1600 },
]

interface AnalysisProgressProps {
  fileName: string
}

export function AnalysisProgress({ fileName }: AnalysisProgressProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let stepIndex = 0
    let accumulated = 0
    let isMounted = true

    const runStep = () => {
      if (!isMounted) return;
      if (stepIndex >= ANALYSIS_STEPS.length) {
        setProgress(99)
        return
      }

      setCurrentStep(stepIndex + 1)
      const step = ANALYSIS_STEPS[stepIndex]
      const stepProgress = ((stepIndex + 1) / ANALYSIS_STEPS.length) * 100

      // Animate progress smoothly toward stepProgress
      const start = accumulated
      const end = stepProgress
      const stepDuration = step.duration
      const startTime = Date.now()

      const animateProgress = () => {
        if (!isMounted) return;
        const elapsed = Date.now() - startTime
        const t = Math.min(elapsed / stepDuration, 1)
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        setProgress(start + (end - start) * eased)
        if (t < 1) requestAnimationFrame(animateProgress)
      }
      requestAnimationFrame(animateProgress)

      setTimeout(() => {
        if (!isMounted) return;
        setCompletedSteps((prev) => [...prev, stepIndex + 1])
        accumulated = stepProgress
        stepIndex++
        runStep()
      }, step.duration)
    }

    runStep()

    return () => { isMounted = false; }
  }, [])

  const activeStep = ANALYSIS_STEPS[currentStep - 1]

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {/* Header row */}
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl"
          style={{ backgroundColor: "rgba(0,229,255,0.12)" }}
        >
          <Loader2
            className="w-6 h-6 animate-spin"
            style={{ color: "var(--brand-cyan-dim)" }}
          />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <p
            className="text-sm font-semibold font-sans truncate"
            style={{ color: "var(--brand-navy)" }}
          >
            {fileName}
          </p>
          <p
            className="text-base font-semibold font-sans text-balance"
            style={{ color: "var(--brand-navy)" }}
          >
            {activeStep?.label ?? "Finalizando análisis..."}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500 font-sans">
            Paso {Math.min(currentStep, ANALYSIS_STEPS.length)} de {ANALYSIS_STEPS.length}
          </span>
          <span
            className="text-xs font-semibold font-sans tabular-nums"
            style={{ color: "var(--brand-cyan-dim)" }}
          >
            {Math.round(progress)}%
          </span>
        </div>
        <div
          className="w-full h-2.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "rgba(0,28,61,0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, var(--brand-navy) 0%, var(--brand-cyan) 100%)",
            }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="grid grid-cols-1 gap-2">
        {ANALYSIS_STEPS.map((step) => {
          const isDone = completedSteps.includes(step.id)
          const isActive = currentStep === step.id
          return (
            <div
              key={step.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300"
              style={{
                backgroundColor: isActive
                  ? "rgba(0,229,255,0.07)"
                  : isDone
                  ? "rgba(0,28,61,0.03)"
                  : "transparent",
              }}
            >
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {isDone ? (
                  <CheckCircle2
                    className="w-4 h-4"
                    style={{ color: "var(--brand-cyan-dim)" }}
                  />
                ) : isActive ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    style={{ color: "var(--brand-cyan-dim)" }}
                  />
                ) : (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: "#cbd5e1" }}
                  />
                )}
              </div>
              <span
                className="text-sm font-sans"
                style={{
                  color: isDone
                    ? "var(--brand-cyan-dim)"
                    : isActive
                    ? "var(--brand-navy)"
                    : "#94a3b8",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
