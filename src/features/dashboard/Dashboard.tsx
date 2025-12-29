import { useState, useMemo } from 'react';
import { LicitacionData } from '../../types';
import { buildPliegoVM } from './model/pliego-vm';

// Components
import { StickyHeader } from './components/detail/StickyHeader';
import { StickySubnav } from './components/detail/StickySubnav';
import { RightDrawer } from './components/detail/RightDrawer';
import {
    ChapterSummary,
    ChapterDatos,
    ChapterCriterios,
    ChapterSolvencia
} from './components/detail/ChapterComponents';
import {
    ChapterTecnicos,
    ChapterRiesgos,
    ChapterServicio,
    TechnicalJsonModal
} from './components/detail/ChapterComponentsPart2';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';

interface DashboardProps {
    data: LicitacionData;
    onUpdate?: (newData: LicitacionData) => void; // Kept for compatibility but editing is not prioritized in this redesign view
    isLoading?: boolean;
}

export function Dashboard({ data, onUpdate, isLoading }: DashboardProps) {
    const [isJsonOpen, setIsJsonOpen] = useState(false);
    const [isDrawerPinned, setIsDrawerPinned] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Build View Model
    const vm = useMemo(() => buildPliegoVM(data), [data]);

    const handlePinToggle = () => {
        setIsDrawerPinned(!isDrawerPinned);
        if (!isDrawerPinned) setIsDrawerOpen(true);
    };

    const handleReanalyze = () => {
        // Simple redirect to home for re-upload for now
        // Could be more sophisticated in V2 (reset state and keep file)
        window.location.href = '/';
    };

    const handleSaveNote = async (text: string) => {
        if (!vm.hash) return;

        const newNote = {
            id: crypto.randomUUID(),
            text,
            author: 'Usuario', // Could get from auth store
            timestamp: Date.now(),
            type: 'NOTE' as const
        };

        const updatedData: LicitacionData = {
            ...data,
            notas: [...(data.notas || []), newNote]
        };

        // Optimistic update? Better to refetch or update local state if possible. 
        // For simplicity, we just save and let SWR/Store update handles it or we call onUpdate if provided.
        // But onUpdate prop is deprecated/optional. 
        // We call dbService directly.

        try {
            const { dbService } = await import('../../services/db.service');
            await dbService.updateLicitacion(vm.hash, updatedData);

            // If onUpdate provided (e.g. from a store wrapper), call it
            if (onUpdate) onUpdate(updatedData);

        } catch (error) {
            console.error('Failed to save note', error);
        }
    };

    // Callback to open drawer to specific tab
    const handleOpenDrawer = () => {
        if (!isDrawerOpen) setIsDrawerOpen(true);
        // Note: RightDrawer doesn't currently expose refined tab control via props other than just 'isOpen'.
        // We might need to add 'initialTab' or 'activeTab' prop to RightDrawer if we want deep linking.
        // For now, just opening it is enough or we rely on default tab. 
        // Let's assume default is 'avisos' for the banner button.
    };

    if (isLoading) return <DashboardSkeleton />;

    return (
        <div className="min-h-screen bg-slate-50/50 relative">
            <StickyHeader vm={vm} onOpenJson={() => setIsJsonOpen(true)} />
            <StickySubnav vm={vm} />

            <main className={`transition-all duration-300 ${isDrawerPinned ? 'pr-80' : ''}`}>
                <div className="max-w-[1100px] mx-auto px-6 py-12 space-y-16">
                    <ChapterSummary vm={vm} onReanalyze={handleReanalyze} onOpenDrawer={() => handleOpenDrawer()} />
                    <ChapterDatos vm={vm} />
                    <ChapterCriterios vm={vm} />
                    <ChapterSolvencia vm={vm} />
                    <ChapterTecnicos vm={vm} />
                    <ChapterRiesgos vm={vm} />
                    <ChapterServicio vm={vm} />
                </div>
            </main>

            <RightDrawer
                vm={vm}
                isOpen={isDrawerOpen}
                isPinned={isDrawerPinned}
                onClose={() => setIsDrawerOpen(false)}
                onPinToggle={handlePinToggle}
                onSaveNote={handleSaveNote}
                onReanalyze={handleReanalyze}
            />

            <TechnicalJsonModal
                vm={vm}
                isOpen={isJsonOpen}
                onClose={() => setIsJsonOpen(false)}
            />

            {/* 
               Removed legacy comments.
             */}
        </div>
    );
}
