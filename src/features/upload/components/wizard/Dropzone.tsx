import React, { useCallback, useState } from "react"
import { FileText, UploadCloud, CheckCircle2, X } from "lucide-react"

interface DropzoneProps {
  onFileAccepted: (file: File) => void
  disabled?: boolean
}

export function Dropzone({ onFileAccepted, disabled = false }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (disabled) return;
      if (file.type !== "application/pdf") return
      if (file.size > 50 * 1024 * 1024) return
      setDroppedFile(file)
      onFileAccepted(file)
    },
    [onFileAccepted, disabled]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return;
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDroppedFile(null)
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // A tiny utility to replace cn()
  const clx = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

  return (
    <label
      htmlFor="pdf-upload"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={clx(
        "relative flex flex-col items-center justify-center w-full min-h-[260px] rounded-2xl cursor-pointer transition-all duration-300 select-none",
        disabled ? "opacity-60 cursor-not-allowed" : "",
        isDragging
          ? "scale-[1.01]"
          : "hover:scale-[1.005]"
      )}
      style={{
        border: isDragging
          ? "2px dashed var(--brand-cyan)"
          : droppedFile
          ? "2px solid var(--brand-cyan)"
          : "2px dashed #cbd5e1",
        background: isDragging
          ? "rgba(0,229,255,0.06)"
          : droppedFile
          ? "rgba(0,229,255,0.04)"
          : "rgba(248,250,252,0.7)",
        boxShadow: isDragging
          ? "0 0 0 4px rgba(0,229,255,0.12)"
          : "none",
      }}
    >
      <input
        id="pdf-upload"
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
      />

      {!droppedFile ? (
        /* Default idle state */
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          {/* Animated icon container */}
          <div className="relative">
            <div
              className={clx(
                "flex items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300",
                isDragging ? "scale-110" : ""
              )}
              style={{
                background: isDragging
                  ? "rgba(0,229,255,0.15)"
                  : "rgba(0,28,61,0.05)",
              }}
            >
              {isDragging ? (
                <UploadCloud
                  className="w-10 h-10 animate-bounce"
                  style={{ color: "var(--brand-cyan)" }}
                />
              ) : (
                <FileText
                  className="w-10 h-10"
                  style={{ color: "var(--brand-navy)" }}
                />
              )}
            </div>
            {/* Glow ring when dragging */}
            {isDragging && (
              <div
                className="absolute inset-0 rounded-2xl animate-ping"
                style={{
                  boxShadow: "0 0 0 8px rgba(0,229,255,0.2)",
                  opacity: 0.6,
                }}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <p
              className="text-lg font-semibold font-sans text-balance"
              style={{ color: "var(--brand-navy)" }}
            >
              {isDragging
                ? "Suelta el archivo aquí"
                : "Arrastra el pliego de licitación (PDF) aquí"}
            </p>
            <p className="text-sm font-sans text-slate-500 leading-relaxed">
              o{" "}
              <span
                className="font-medium underline underline-offset-2 cursor-pointer"
                style={{ color: "var(--brand-cyan-dim)" }}
              >
                haz clic para explorar en tu equipo
              </span>
              . Tamaño máximo: 50 MB.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium font-sans"
              style={{
                backgroundColor: "rgba(0,28,61,0.07)",
                color: "var(--brand-navy)",
              }}
            >
              Solo PDF
            </span>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium font-sans"
              style={{
                backgroundColor: "rgba(0,28,61,0.07)",
                color: "var(--brand-navy)",
              }}
            >
              Máx. 50 MB
            </span>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium font-sans"
              style={{
                backgroundColor: "rgba(0,28,61,0.07)",
                color: "var(--brand-navy)",
              }}
            >
              Análisis en segundos
            </span>
          </div>
        </div>
      ) : (
        /* File selected state */
        <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <div
            className="flex items-center justify-center w-20 h-20 rounded-2xl"
            style={{ backgroundColor: "rgba(0,229,255,0.12)" }}
          >
            <CheckCircle2
              className="w-10 h-10"
              style={{ color: "var(--brand-cyan-dim)" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <p
              className="text-base font-semibold font-sans"
              style={{ color: "var(--brand-navy)" }}
            >
              {droppedFile.name}
            </p>
            <p className="text-sm text-slate-500 font-sans">
              {formatBytes(droppedFile.size)} · PDF
            </p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            disabled={disabled}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition-colors font-sans mt-1 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            Cambiar archivo
          </button>
        </div>
      )}
    </label>
  )
}
