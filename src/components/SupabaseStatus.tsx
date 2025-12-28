
import React, { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { Circle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';

export const SupabaseStatus: React.FC = () => {
    const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'auth-required'>('loading');
    const { isAuthenticated } = useAuthStore();

    useEffect(() => {
        const checkConnection = async () => {
            try {
                // Simple read check regarding if user is logged in
                const { error } = await supabase.from('licitaciones').select('count', { count: 'exact', head: true });

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
                setStatus('error');
            }
        };

        checkConnection();
    }, [isAuthenticated]);

    if (status === 'connected') return null; // Hide if everything is perfect

    return (
        <div className={`fixed bottom-4 right-4 p-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium z-50
            ${status === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : ''}
            ${status === 'auth-required' ? 'bg-amber-100 text-amber-800 border border-amber-200' : ''}
        `}>
            {status === 'loading' && <Circle className="w-4 h-4 animate-pulse text-gray-500" />}
            {status === 'error' && <AlertTriangle className="w-4 h-4" />}
            {status === 'auth-required' && <AlertTriangle className="w-4 h-4" />}

            <span>
                {status === 'loading' && "Verificando conexión..."}
                {status === 'error' && "Error de conexión con Supabase"}
                {status === 'auth-required' && "Modo Solo Lectura (Inicia sesión para guardar)"}
            </span>
        </div>
    );
};
