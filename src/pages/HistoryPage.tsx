import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { LicitacionData } from '../types';
import { useLicitacionStore } from '../stores/licitacion.store';
import { useAnalysisStore } from '../stores/analysis.store';
import { useNavigate } from 'react-router-dom';

const HistoryView = lazy(() => import('../features/history/HistoryView').then(m => ({ default: m.HistoryView })));

export const HistoryPage: React.FC = () => {
    const navigate = useNavigate();
    const { loadLicitacion } = useLicitacionStore();

    const handleSelect = (data: LicitacionData, hash?: string) => {
        loadLicitacion(data, hash);
        // Ensure home page shows the dashboard instead of dropzone
        useAnalysisStore.setState({ status: 'COMPLETED' });
        navigate('/');
    };

    return (
        <Suspense fallback={<Loader2 className="animate-spin" />}>
            <HistoryView onSelect={handleSelect} />
        </Suspense>
    );
};
