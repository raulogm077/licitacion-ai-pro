import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/i18n'; // Initialize i18n

import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './config/sentry';

// Initialize Sentry for error tracking
initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
)
