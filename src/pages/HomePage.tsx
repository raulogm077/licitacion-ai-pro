import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
// import { TagManager } from '../components/domain/TagManager';
// import { NotesPanel } from '../components/domain/NotesPanel';
import { Dashboard } from '../features/dashboard/Dashboard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useLicitacionStore } from '../stores/licitacion.store';
import { useAnalysisStore } from '../stores/analysis.store';
import { AnalysisWizard } from '../features/upload/components/AnalysisWizard';

export const HomePage: React.FC = () => {
    const { data, updateData } = useLicitacionStore();
    const { status } = useAnalysisStore();

    return (
        <>
            <Suspense
                fallback={
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-brand-600" size={48} />
                    </div>
                }
            >
                {/* Wizard handles Idle, Analyzing, and Error states */}
                {(status === 'IDLE' || status === 'ANALYZING' || status === 'ERROR') && (
                    <div className="max-w-5xl mx-auto mt-8">
                        <AnalysisWizard />
                    </div>
                )}

                {/* Dashboard View for Completed State */}
                {status === 'COMPLETED' && data && (
                    // Removing the extra padding wrapper so the Dashboard can be full width/height
                    <div className="absolute inset-0 pt-16">
                        <ErrorBoundary>
                            <Dashboard data={data} onUpdate={updateData} />
                        </ErrorBoundary>
                    </div>
                )}
            </Suspense>
        </>
    );
};
