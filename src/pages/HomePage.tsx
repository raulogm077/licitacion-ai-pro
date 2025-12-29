import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { TagManager } from '../components/domain/TagManager';
import { NotesPanel } from '../components/domain/NotesPanel';
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
            <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-brand-600" size={48} />
                </div>
            }>
                {/* Wizard handles Idle, Analyzing, and Error states */}
                {(status === 'IDLE' || status === 'ANALYZING' || status === 'ERROR') && (
                    <AnalysisWizard />
                )}

                {/* Dashboard View for Completed State */}
                {status === 'COMPLETED' && data && (
                    <div className="space-y-6">
                        {/* Tags and Notes Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <TagManager
                                tags={data.metadata?.tags || []}
                                onChange={(tags) => {
                                    const updatedData = {
                                        ...data!,
                                        metadata: { ...data!.metadata, tags }
                                    };
                                    updateData(updatedData);
                                }}
                            />

                            <NotesPanel
                                notes={data.notas || []}
                                onChange={(notas) => {
                                    const updatedData = { ...data!, notas };
                                    updateData(updatedData);
                                }}
                            />
                        </div>

                        {/* Main Dashboard */}
                        <ErrorBoundary>
                            <Dashboard data={data} onUpdate={updateData} />
                        </ErrorBoundary>
                    </div>
                )}
            </Suspense>
        </>
    );
};
