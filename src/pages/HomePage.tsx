import React, { Suspense, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Dashboard } from '../features/dashboard/Dashboard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useLicitacionStore } from '../stores/licitacion.store';
import { useAnalysisStore } from '../stores/analysis.store';
import { AnalysisWizard } from '../features/upload/components/AnalysisWizard';
import { LandingHero } from '../features/landing/LandingHero';
import { useAuthStore } from '../stores/auth.store';
import { celebrateAnalysisComplete } from '../lib/celebrate';

export const HomePage: React.FC = () => {
    const { data, updateData } = useLicitacionStore();
    const { status } = useAnalysisStore();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const prevStatusRef = useRef(status);

    // Celebrate only a fresh analysis finishing (not history loads that
    // arrive already COMPLETED).
    useEffect(() => {
        if (prevStatusRef.current === 'ANALYZING' && status === 'COMPLETED') {
            void celebrateAnalysisComplete();
        }
        prevStatusRef.current = status;
    }, [status]);

    return (
        <>
            <Suspense
                fallback={
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-brand-600" size={48} />
                    </div>
                }
            >
                {/* Unauthenticated visitors get the branded landing */}
                {!isAuthenticated && status === 'IDLE' && <LandingHero />}

                {/* Wizard handles Idle, Analyzing, and Error states */}
                {isAuthenticated && (status === 'IDLE' || status === 'ANALYZING' || status === 'ERROR') && (
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
