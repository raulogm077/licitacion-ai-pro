import React, { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { Circle, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';

export const SupabaseStatus: React.FC = () => {
    const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'auth-required' | 'error-config'>(
        'loading'
    );
    const { isAuthenticated } = useAuthStore();

    useEffect(() => {
        let cancelled = false;
        const checkConnection = async () => {
            try {
                // Check connection
                // Note: env.ts already validates VITE_SUPABASE_URL presence at startup.

                // Simple read check regarding if user is logged in
                const { error } = await supabase.from('licitaciones').select('count', { count: 'exact', head: true });

                if (cancelled) return;
                if (error) {
                    // 42501 = RLS violation (Auth required) which implies connection works but permissions are strict
                    if (error.code === '42501') {
                        setStatus(isAuthenticated ? 'connected' : 'auth-required');
                    } else {
                        setStatus('error');
                    }
                } else {
                    setStatus('connected');
                }
            } catch (e) {
                if (!cancelled) setStatus('error');
            }
        };

        checkConnection();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    if (status === 'connected') return null; // Hide if everything is perfect

    return (
        <div
            className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl p-3 text-sm font-medium shadow-card backdrop-blur-sm
            ${status === 'error' ? 'border border-danger/20 bg-danger-light text-danger-dark dark:bg-danger/20 dark:text-danger-light' : ''}
            ${status === 'error-config' ? 'border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300' : ''}
            ${status === 'auth-required' ? 'border border-warning/20 bg-warning-light text-warning-dark dark:bg-warning/20 dark:text-warning-light' : ''}
        `}
        >
            {status === 'loading' && <Circle className="w-4 h-4 animate-pulse text-slate-500" />}
            {status === 'error' && <AlertTriangle className="w-4 h-4" />}
            {status === 'error-config' && <AlertTriangle className="w-4 h-4" />}
            {status === 'auth-required' && <AlertTriangle className="w-4 h-4" />}

            <span>
                {status === 'loading' && 'Verificando conexión...'}
                {status === 'error' && 'Error de conexión con Supabase'}
                {status === 'error-config' && 'Faltan Variables de Entorno en Vercel'}
                {status === 'auth-required' && 'Modo Solo Lectura (Inicia sesión para guardar)'}
            </span>
        </div>
    );
};
