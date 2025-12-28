import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useAuthStore } from './stores/auth.store';
import { useLicitacionStore } from './stores/licitacion.store';
import { useAnalysisStore } from './stores/analysis.store';
import { AuthModal } from './components/ui/AuthModal';
import { SupabaseStatus } from './components/SupabaseStatus';
import { Layout } from './components/layout/Layout';

// Lazy load pages for performance code-splitting
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(module => ({ default: module.HistoryPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then(module => ({ default: module.SearchPage })));
const PresentationPage = lazy(() => import('./pages/PresentationPage').then(module => ({ default: module.PresentationPage })));

function App() {
  const { data, reset } = useLicitacionStore();
  const { status } = useAnalysisStore();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { isAuthenticated, initialize, loading } = useAuthStore();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Persist dark mode
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleAuthAction = () => {
    if (isAuthenticated) {
      useAuthStore.getState().signOut();
    } else {
      setShowAuthModal(true);
    }
  };

  // Shared loading component for Suspense
  const PageLoader = () => (
    <div className="flex justify-center items-center h-full min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-sm text-slate-500">Cargando módulo...</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
        <p className="text-slate-600 dark:text-slate-400">Iniciando sesión segura...</p>
        <span className="text-xs text-slate-400 mt-2 font-mono">
          {window.location.hash.includes('access_token') ? 'Procesando Magic Link...' : 'Verificando credenciales...'}
        </span>
      </div>
    );
  }

  return (
    <Router>
      <SupabaseStatus />
      <SpeedInsights />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <Routes>
        <Route element={
          <Layout
            status={status}
            data={data}
            reset={reset}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onLogout={handleAuthAction}
          />
        }>
          <Route path="/" element={
            <Suspense fallback={<PageLoader />}>
              <HomePage />
            </Suspense>
          } />
          <Route path="/history" element={
            <Suspense fallback={<PageLoader />}>
              <HistoryPage />
            </Suspense>
          } />
          <Route path="/analytics" element={
            <Suspense fallback={<PageLoader />}>
              <AnalyticsPage />
            </Suspense>
          } />
          <Route path="/search" element={
            <Suspense fallback={<PageLoader />}>
              <SearchPage />
            </Suspense>
          } />
        </Route>

        <Route path="/presentation" element={
          <Suspense fallback={<PageLoader />}>
            <PresentationPage data={data} />
          </Suspense>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
