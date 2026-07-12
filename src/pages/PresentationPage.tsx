import React, { lazy, Suspense } from 'react';
import { Loader2, Presentation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LicitacionData } from '../types';
import { Button } from '../components/ui/Button';

const PresentationMode = lazy(() =>
    import('../features/presentation/PresentationMode').then((m) => ({ default: m.PresentationMode }))
);

interface PresentationPageProps {
    data: LicitacionData | null;
}

export const PresentationPage: React.FC<PresentationPageProps> = ({ data }) => {
    const navigate = useNavigate();

    if (!data) {
        return (
            <div className="aurora flex min-h-screen flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
                    <Presentation className="h-7 w-7 text-white" />
                </div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    No hay ningún análisis para presentar
                </h1>
                <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                    Analiza un pliego o abre uno desde el historial y vuelve a lanzar el modo presentación.
                </p>
                <Button className="mt-6" onClick={() => navigate('/')}>
                    Volver al inicio
                </Button>
            </div>
        );
    }

    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <Loader2 className="animate-spin" />
                </div>
            }
        >
            <PresentationMode data={data} onClose={() => navigate('/')} />
        </Suspense>
    );
};
