import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useLicitacionProcessor } from './hooks/useLicitacionProcessor';
import { LicitacionData } from './types';
import { dbService } from './lib/db-service';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { HistoryPage } from './pages/HistoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SearchPage } from './pages/SearchPage';
import { PresentationPage } from './pages/PresentationPage';

function App() {
  const { state, processFile, reset, loadLicitacion } = useLicitacionProcessor();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Persist dark mode
  React.useEffect(() => {
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
