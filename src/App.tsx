import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useLicitacionProcessor } from './hooks/useLicitacionProcessor';
import { LicitacionData } from './types';
import { dbService } from './services/db.service';
import { supabase } from './config/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/Card';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SearchPage } from './pages/SearchPage';
import { PresentationPage } from './pages/PresentationPage';
import { Session } from '@supabase/supabase-js';

// Helper for auth state
function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);
  return session;
}

function Auth() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else alert('Check your email for the login link!');
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <Card className="w-full max-w-md p-6">
        <CardHeader>
          <CardTitle className="text-center">Iniciar Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Tu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-800 dark:border-slate-700"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Enviando link...' : 'Enviar Magic Link'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function App() {
  const { state, processFile, reset, loadLicitacion } = useLicitacionProcessor();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const session = useSession();

  // Persist dark mode
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

  const handleHistorySelect = (data: LicitacionData, hash?: string) => {
    loadLicitacion(data, hash);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <Router>
      <Routes>
        <Route element={
          <Layout
            status={state.status}
            data={state.data}
            reset={reset}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onLogout={handleLogout}
          />
        }>
          <Route path="/" element={
            <HomePage
              state={state}
              processFile={processFile}
              reset={reset}
              handleDataUpdate={handleDataUpdate}
            />
          } />
          <Route path="/history" element={
            <HistoryPage onSelect={handleHistorySelect} />
          } />
          <Route path="/analytics" element={
            <AnalyticsPage />
          } />
          <Route path="/search" element={
            <SearchPage handleHistorySelect={handleHistorySelect} />
          } />
        </Route>

        <Route path="/presentation" element={
          <PresentationPage data={state.data} />
        } />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
