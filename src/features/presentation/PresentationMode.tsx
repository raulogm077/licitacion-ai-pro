import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LicitacionData } from '../../types';
import { unwrap } from '../../lib/tracked-field';
import { X, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/utils';

interface PresentationModeProps {
    data: LicitacionData;
    onClose: () => void;
}

export function PresentationMode({ data, onClose }: PresentationModeProps) {
    const [slideIndex, setSlideIndex] = useState(0);
    const [direction, setDirection] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: unwrap<string>(data.datosGenerales.moneda, 'EUR'),
        }).format(amount);

    const slides = useMemo(() => {
        const list: Array<{ id: string; title: string; content: ReactNode }> = [];

        list.push({
            id: 'portada',
            title: 'Portada',
            content: (
                <div className="flex h-full flex-col items-center justify-center text-center">
                    <span className="mb-6 inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300">
                        Análisis de licitación
                    </span>
                    <h1 className="max-w-4xl font-display text-4xl font-bold leading-tight text-slate-900 sm:text-6xl dark:text-white">
                        {unwrap<string>(data.datosGenerales.titulo, 'Licitación')}
                    </h1>
                    <p className="mt-6 text-lg text-slate-500 dark:text-slate-400">
                        {unwrap<string>(data.datosGenerales.organoContratacion, '')}
                    </p>
                    {data.metadata?.tags && data.metadata.tags.length > 0 && (
                        <div className="mt-8 flex flex-wrap justify-center gap-3">
                            {data.metadata.tags.map((tag, idx) => (
                                <Badge key={idx} variant="default" className="px-4 py-2 text-sm">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            ),
        });

        list.push({
            id: 'cifras',
            title: 'Cifras clave',
            content: (
                <div className="flex h-full flex-col justify-center">
                    <h2 className="mb-12 text-center font-display text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">
                        Cifras clave
                    </h2>
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 p-8 text-center dark:from-brand-900/20 dark:to-brand-800/20">
                            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
                                Presupuesto
                            </p>
                            <p className="text-4xl font-bold text-brand-900 tabular-nums dark:text-brand-100">
                                {formatCurrency(unwrap<number>(data.datosGenerales.presupuesto, 0))}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-accent-50 to-accent-100 p-8 text-center dark:from-accent-900/20 dark:to-accent-800/20">
                            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-accent-700 dark:text-accent-300">
                                Plazo
                            </p>
                            <p className="text-4xl font-bold text-accent-900 tabular-nums dark:text-accent-100">
                                {unwrap<number>(data.datosGenerales.plazoEjecucionMeses, 0)}
                                <span className="ml-2 text-2xl">meses</span>
                            </p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-8 text-center dark:from-emerald-900/20 dark:to-emerald-800/20">
                            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                Estado
                            </p>
                            <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                                {data.metadata?.estado || 'PENDIENTE'}
                            </p>
                        </div>
                    </div>
                </div>
            ),
        });

        const { subjetivos, objetivos } = data.criteriosAdjudicacion;
        if (subjetivos.length > 0 || objetivos.length > 0) {
            list.push({
                id: 'criterios',
                title: 'Criterios',
                content: (
                    <div className="flex h-full flex-col justify-center">
                        <h2 className="mb-10 text-center font-display text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">
                            Criterios de Adjudicación
                        </h2>
                        <div className="grid grid-cols-1 gap-6 overflow-y-auto md:grid-cols-2">
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Subjetivos</h3>
                                {subjetivos.map((criterio, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-lg border-l-4 border-brand-500 bg-white p-4 shadow-card dark:bg-slate-800"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="flex-1 font-medium text-slate-900 dark:text-white">
                                                {criterio.descripcion}
                                            </p>
                                            <Badge variant="default" className="shrink-0 px-3 text-lg">
                                                {criterio.ponderacion}%
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Objetivos</h3>
                                {objetivos.map((criterio, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-lg border-l-4 border-success bg-white p-4 shadow-card dark:bg-slate-800"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="flex-1 font-medium text-slate-900 dark:text-white">
                                                {criterio.descripcion}
                                            </p>
                                            <Badge variant="success" className="shrink-0 px-3 text-lg">
                                                {criterio.ponderacion}%
                                            </Badge>
                                        </div>
                                        {criterio.formula && (
                                            <p className="mt-2 rounded bg-slate-50 p-2 font-mono text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                                                {criterio.formula}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ),
            });
        }

        list.push({
            id: 'solvencia',
            title: 'Solvencia',
            content: (
                <div className="flex h-full flex-col justify-center">
                    <h2 className="mb-10 text-center font-display text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">
                        Requisitos de Solvencia
                    </h2>
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 dark:from-amber-900/20 dark:to-orange-900/20">
                            <h3 className="mb-4 text-xl font-semibold text-amber-900 dark:text-amber-100">
                                Solvencia Económica
                            </h3>
                            <p className="text-3xl font-bold text-amber-800 tabular-nums dark:text-amber-200">
                                {formatCurrency(data.requisitosSolvencia.economica.cifraNegocioAnualMinima)}
                            </p>
                            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                                Cifra de negocio anual mínima
                            </p>
                        </div>
                        <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 p-6 dark:from-teal-900/20 dark:to-cyan-900/20">
                            <h3 className="mb-4 text-xl font-semibold text-teal-900 dark:text-teal-100">
                                Solvencia Técnica
                            </h3>
                            <div className="max-h-64 space-y-3 overflow-y-auto">
                                {data.requisitosSolvencia.tecnica.length === 0 ? (
                                    <p className="text-sm text-teal-700 dark:text-teal-300">
                                        Sin requisitos técnicos de solvencia detectados.
                                    </p>
                                ) : (
                                    data.requisitosSolvencia.tecnica.map((req, idx) => (
                                        <div key={idx} className="text-sm">
                                            <p className="font-medium text-teal-800 dark:text-teal-200">
                                                {req.descripcion}
                                            </p>
                                            <p className="text-teal-700 dark:text-teal-300">
                                                {req.proyectosSimilaresRequeridos} proyectos similares requeridos
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ),
        });

        if (data.restriccionesYRiesgos.riesgos.length > 0) {
            const riskColors: Record<string, string> = {
                CRITICO: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-500',
                ALTO: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-500',
                MEDIO: 'from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-500',
                BAJO: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-500',
            };
            list.push({
                id: 'riesgos',
                title: 'Riesgos',
                content: (
                    <div className="flex h-full flex-col justify-center">
                        <h2 className="mb-10 text-center font-display text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">
                            Riesgos Identificados
                        </h2>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {data.restriccionesYRiesgos.riesgos.slice(0, 6).map((riesgo, idx) => (
                                <div
                                    key={idx}
                                    className={`rounded-lg border-l-4 bg-gradient-to-br p-4 ${riskColors[riesgo.impacto]}`}
                                >
                                    <Badge
                                        variant={
                                            riesgo.impacto === 'CRITICO' || riesgo.impacto === 'ALTO'
                                                ? 'danger'
                                                : 'warning'
                                        }
                                        className="mb-2"
                                    >
                                        {riesgo.impacto}
                                    </Badge>
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {riesgo.descripcion}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ),
            });
        }

        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const goTo = useCallback(
        (next: number) => {
            if (next < 0 || next >= slides.length) return;
            setDirection(next > slideIndex ? 1 : -1);
            setSlideIndex(next);
        },
        [slideIndex, slides.length]
    );

    // Keyboard navigation: arrows to move, Escape exits presentation.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
                event.preventDefault();
                goTo(slideIndex + 1);
            } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                event.preventDefault();
                goTo(slideIndex - 1);
            } else if (event.key === 'Escape' && !document.fullscreenElement) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goTo, slideIndex, onClose]);

    // Track fullscreen state (Escape exits fullscreen natively first).
    useEffect(() => {
        const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', handleChange);
        return () => document.removeEventListener('fullscreenchange', handleChange);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await containerRef.current?.requestFullscreen();
            }
        } catch {
            /* Fullscreen not available (e.g. iframe) — keyboard/nav still work */
        }
    };

    return (
        <div ref={containerRef} className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950">
            {/* Top bar */}
            <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
                <div className="flex items-center gap-2">
                    <Maximize2 size={18} className="text-brand-600 dark:text-brand-400" />
                    <span className="font-display font-semibold text-slate-900 dark:text-white">Modo Presentación</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                    <span className="mr-3 tabular-nums">
                        {slideIndex + 1} / {slides.length}
                    </span>
                    <button
                        onClick={toggleFullscreen}
                        className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                        aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                    >
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Salir del modo presentación"
                        aria-label="Salir del modo presentación"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Slide area */}
            <div className="relative flex-1 overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                    <m.section
                        key={slides[slideIndex].id}
                        custom={direction}
                        initial={{ opacity: 0, x: direction * 48 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -48 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 overflow-y-auto px-8 py-10 sm:px-16"
                        aria-label={slides[slideIndex].title}
                    >
                        <div className="mx-auto h-full max-w-5xl">{slides[slideIndex].content}</div>
                    </m.section>
                </AnimatePresence>

                {/* Prev / next controls */}
                <button
                    onClick={() => goTo(slideIndex - 1)}
                    disabled={slideIndex === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/90 p-3 text-slate-600 shadow-card backdrop-blur transition-all hover:scale-105 disabled:pointer-events-none disabled:opacity-0 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300"
                    aria-label="Diapositiva anterior"
                >
                    <ChevronLeft size={20} />
                </button>
                <button
                    onClick={() => goTo(slideIndex + 1)}
                    disabled={slideIndex === slides.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/90 p-3 text-slate-600 shadow-card backdrop-blur transition-all hover:scale-105 disabled:pointer-events-none disabled:opacity-0 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300"
                    aria-label="Diapositiva siguiente"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Progress dots */}
            <div className="flex h-12 flex-shrink-0 items-center justify-center gap-2 border-t border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/90">
                {slides.map((slide, i) => (
                    <button
                        key={slide.id}
                        onClick={() => goTo(i)}
                        aria-label={`Ir a ${slide.title}`}
                        aria-current={i === slideIndex ? 'true' : undefined}
                        className={cn(
                            'h-2 rounded-full transition-all duration-300',
                            i === slideIndex
                                ? 'w-8 bg-brand-gradient'
                                : 'w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600'
                        )}
                    />
                ))}
            </div>
        </div>
    );
}
