import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { LicitacionData } from '../types';

const PresentationMode = lazy(() =>
    import('../features/presentation/PresentationMode').then((m) => ({ default: m.PresentationMode }))
);

import { useNavigate } from 'react-router-dom';

interface PresentationPageProps {
    data: LicitacionData | null;
}

export const PresentationPage: React.FC<PresentationPageProps> = ({ data }) => {
    const navigate = useNavigate();

    if (!data) return <div>No data to present</div>;

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
