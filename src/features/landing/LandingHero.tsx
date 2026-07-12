import { useState } from 'react';
import { FileSearch, MessageSquare, Quote, Sparkles, ArrowRight } from 'lucide-react';
import { AuthModal } from '../../components/ui/AuthModal';
import { Button } from '../../components/ui/Button';
import { FadeIn, Stagger, StaggerItem } from '../../components/ui/motion';

const FEATURES = [
    {
        icon: FileSearch,
        title: 'Extracción estructurada',
        text: 'Un pipeline de 5 fases convierte el PDF del expediente en datos navegables: presupuesto, plazos, criterios, solvencia y riesgos.',
    },
    {
        icon: Quote,
        title: 'Evidencias citadas',
        text: 'Cada dato crítico llega con su cita textual del pliego, para que valides en segundos de dónde sale cada cifra.',
    },
    {
        icon: MessageSquare,
        title: 'Copiloto conversacional',
        text: 'Pregunta sobre cualquier análisis guardado y obtén respuestas fundamentadas en el contenido real del expediente.',
    },
];

/** Marketing hero shown to unauthenticated visitors instead of the wizard. */
export function LandingHero() {
    const [showAuthModal, setShowAuthModal] = useState(false);

    return (
        <div className="aurora -mx-6 -my-8 min-h-[calc(100vh-4rem)] px-6 py-16">
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

            <div className="mx-auto max-w-5xl">
                <FadeIn className="text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur dark:border-brand-800 dark:bg-slate-900/70 dark:text-brand-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        Análisis de licitaciones con IA
                    </span>
                    <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl dark:text-white">
                        Entiende cualquier pliego <span className="text-gradient">en minutos</span>, no en días
                    </h1>
                    <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
                        Sube el PDF del expediente y obtén presupuesto, plazos, criterios de adjudicación, solvencia y
                        riesgos — estructurados, citados y listos para decidir si merece la pena licitar.
                    </p>
                    <div className="mt-8 flex items-center justify-center gap-3">
                        <Button size="lg" onClick={() => setShowAuthModal(true)} className="gap-2 text-base">
                            Comenzar ahora
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        Acceso con email — sin tarjeta de crédito.
                    </p>
                </FadeIn>

                <Stagger className="mt-16 grid gap-5 sm:grid-cols-3" stagger={0.12}>
                    {FEATURES.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <StaggerItem key={feature.title}>
                                <div className="glass h-full rounded-2xl p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
                                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
                                        <Icon className="h-5 w-5 text-white" />
                                    </div>
                                    <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                                        {feature.title}
                                    </h2>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                        {feature.text}
                                    </p>
                                </div>
                            </StaggerItem>
                        );
                    })}
                </Stagger>
            </div>
        </div>
    );
}
