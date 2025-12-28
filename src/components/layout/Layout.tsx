import React, { Suspense } from 'react';
import { Header } from './Header';
import { LogViewer } from '../debug/LogViewer';
import { Loader2 } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { ProcessingStatus, LicitacionData } from '../../types';

interface LayoutProps {
    status: ProcessingStatus;
    data: LicitacionData | null;
    reset: () => void;
    darkMode: boolean;
    setDarkMode: (dark: boolean) => void;
    onLogout: () => void;
    children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = (props) => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans text-slate-900 dark:text-slate-100">
            <Header {...props} />

            <main className="max-w-6xl mx-auto px-6 py-8">
                <Suspense fallback={
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-brand-600" size={48} />
                    </div>
                }>
                    <Outlet />
                </Suspense>
            </main>
            <LogViewer />
        </div >
    );
};
