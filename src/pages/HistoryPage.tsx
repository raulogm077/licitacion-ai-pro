import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { LicitacionData } from '../types';

const HistoryView = lazy(() => import('../features/history/HistoryView').then(m => ({ default: m.HistoryView })));

interface HistoryPageProps {
    onSelect: (data: LicitacionData, hash?: string) => void;
}

import { useNavigate } from 'react-router-dom';

export const HistoryPage: React.FC<HistoryPageProps> = ({ onSelect }) => {
    const navigate = useNavigate();
    const handleSelect = (data: LicitacionData, hash?: string) => {
        onSelect(data, hash);
        navigate('/');
    };
    return (
        <Suspense fallback={<Loader2 className="animate-spin" />}>
            <HistoryView onSelect={handleSelect} />
        </Suspense>
    );
};
