import React, { useState, lazy, Suspense } from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';
import { useLicitacionProcessor } from './hooks/useLicitacionProcessor';
import { Dashboard } from './features/dashboard/Dashboard';
import { Card } from './components/common/Card';
import { LicitacionData, SearchFilters, View } from './types';
import { dbService } from './lib/db-service';
import { Header } from './components/layout/Header';

// Lazy load heavy components
const HistoryView = lazy(() => import('./features/history/HistoryView').then(m => ({ default: m.HistoryView })));
const AnalyticsDashboard = lazy(() => import('./features/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const SearchPanel = lazy(() => import('./features/search/SearchPanel').then(m => ({ default: m.SearchPanel })));
const PresentationMode = lazy(() => import('./features/presentation/PresentationMode').then(m => ({ default: m.PresentationMode })));
const TagManager = lazy(() => import('./features/common/TagManager').then(m => ({ default: m.TagManager })));
const NotesPanel = lazy(() => import('./features/common/NotesPanel').then(m => ({ default: m.NotesPanel })));

function App() {
  const { state, processFile, reset, loadLicitacion } = useLicitacionProcessor();
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [view, setView] = useState<View>('HOME');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Persist dark mode
  React.useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      await processFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleHistorySelect = (data: LicitacionData, hash?: string) => {
    loadLicitacion(data, hash);
    setView('HOME');
  };

  const handleDataUpdate = async (newData: LicitacionData) => {
    if (state.hash) {
      try {
        await dbService.updateLicitacion(state.hash, newData);
        console.log('Data updated successfully');
      } catch (error) {
        console.error('Failed to update data:', error);
      }
    }
  };

  const handleSearch = async (filters: SearchFilters) => {
    try {
      const results = await dbService.advancedSearch(filters);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    }
  };

  const handleSearchReset = () => {
    setSearchResults([]);
  };

  const handlePresentationMode = () => {
    if (state.data) {
      setView('PRESENTATION');
    }
  };

  // Presentation Mode - Full screen overlay
  if (view === 'PRESENTATION' && state.data) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>}>
        <PresentationMode data={state.data} onClose={() => setView('HOME')} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans text-slate-900 dark:text-slate-100">
      <Header
        view={view}
        setView={setView}
        status={state.status}
        data={state.data}
        reset={reset}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onPresentationMode={handlePresentationMode}
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-brand-600" size={48} />
          </div>
        }>
          {view === 'HISTORY' && (
            <HistoryView onSelect={handleHistorySelect} />
          )}

          {view === 'ANALYTICS' && (
            <AnalyticsDashboard />
          )}

          {view === 'SEARCH' && (
            <div className="space-y-6">
              {/* Search Panel */}
              <SearchPanel onSearch={handleSearch} onReset={handleSearchReset} />

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Resultados ({searchResults.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {searchResults.map((result) => (
                      <Card
                        key={result.hash}
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => handleHistorySelect(result.data, result.hash)}
                      >
                        <div className="p-4">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                            {result.data.datosGenerales.titulo}
                          </h4>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {result.data.metadata?.tags?.map((tag: string, idx: number) => (
                              <span key={idx} className="text-xs px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: result.data.datosGenerales.moneda }).format(result.data.datosGenerales.presupuesto)}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'HOME' && (
            <>
              {state.status === 'IDLE' && (
                <div className="max-w-2xl mx-auto mt-20">
                  <div
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${isDragging
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 scale-105'
                      : 'border-slate-300 dark:border-slate-700 hover:border-brand-400 hover:bg-white dark:hover:bg-slate-800'
                      }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Upload size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analiza tu Licitación</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">
                      Arrastra tu pliego (PDF) aquí o selecciona un archivo para comenzar el análisis inteligente.
                    </p>

                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-200 dark:shadow-none hover:shadow-xl hover:-translate-y-0.5">
                      <Upload size={20} />
                      Seleccionar PDF
                      <input type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                    </label>
                  </div>
                </div>
              )}

              {state.status === 'ANALYZING' && (
                <div className="max-w-xl mx-auto mt-20 text-center">
                  <Loader2 size={48} className="text-brand-600 animate-spin mx-auto mb-6" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analizando Documento...</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-8">
                    Nuestra IA está extrayendo los puntos clave. Esto puede tomar unos segundos.
                  </p>

                  <div className="bg-slate-900 rounded-lg p-4 text-left font-mono text-xs text-green-400 h-48 overflow-y-auto shadow-inner">
                    <p className="opacity-50 mb-2">// System Log</p>
                    {state.thinkingOutput.split('\n').map((line, i) => (
                      <p key={i} className="mb-1">{`> ${line}`}</p>
                    ))}
                    <span className="animate-pulse">_</span>
                  </div>
                </div>
              )}

              {state.status === 'ERROR' && (
                <div className="max-w-xl mx-auto mt-20">
                  <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
                    <div className="p-6 text-center">
                      <div className="w-12 h-12 bg-danger-100 dark:bg-danger-900/30 text-danger-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={24} />
                      </div>
                      <h3 className="text-lg font-bold text-danger-900 dark:text-danger-100 mb-2">Error en el Análisis</h3>
                      <p className="text-danger-700 dark:text-danger-300 mb-6">{state.error}</p>
                      <button
                        onClick={reset}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/40 transition-colors"
                      >
                        Intentar de nuevo
                      </button>
                    </div>
                  </Card>
                </div>
              )}

              {state.status === 'COMPLETED' && state.data && (
                <div className="space-y-6">
                  {/* Tags and Notes Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TagManager
                      tags={state.data.metadata?.tags || []}
                      onChange={(tags) => {
                        const updatedData = {
                          ...state.data!,
                          metadata: { ...state.data!.metadata, tags }
                        };
                        handleDataUpdate(updatedData);
                      }}
                    />

                    <NotesPanel
                      notes={state.data.notas || []}
                      onChange={(notas) => {
                        const updatedData = { ...state.data!, notas };
                        handleDataUpdate(updatedData);
                      }}
                    />
                  </div>

                  {/* Main Dashboard */}
                  <Dashboard data={state.data} onUpdate={handleDataUpdate} />
                </div>
              )}
            </>
          )}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
