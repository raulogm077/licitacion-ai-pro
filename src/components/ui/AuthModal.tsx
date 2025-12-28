import React, { useState } from 'react';
import { X, Mail, Lock, Loader2, Check, UserPlus, LogIn } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type AuthMode = 'login' | 'signup';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const { signInWithPassword, signUp } = useAuthStore();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        let result;

        if (mode === 'signup') {
            try {
                result = await signUp(email, password);
            } catch (err: any) {
                if (err.message && err.message.includes('Supabase Client Error')) {
                    result = { success: false, error: "ERROR CRÍTICO: Faltan variables de entorno en Vercel." };
                } else {
                    result = { success: false, error: "Error inesperado" };
                }
            }
        } else {
            try {
                result = await signInWithPassword(email, password);
            } catch (err: any) {
                if (err.message && err.message.includes('Supabase Client Error')) {
                    result = { success: false, error: "ERROR CRÍTICO: Faltan variables de entorno en Vercel." };
                } else {
                    result = { success: false, error: "Error de conexión" };
                }
            }
        }

        setLoading(false);

        if (result.success) {
            setSuccess(true);
            setEmail('');
            setPassword('');

            if (mode === 'login') {
                // Initial success feedback, then close
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                }, 1500);
            } else {
                // Signup might need email confirmation depending on Supabase settings
                // But user requested "create user if not exists", implying direct access or simple signup
            }
        } else {
            setError(result.error || 'Error de autenticación');
        }
    };

    const toggleMode = () => {
        setMode(mode === 'login' ? 'signup' : 'login');
        setError('');
        setSuccess(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-brand-600 to-brand-500 p-6 text-white">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            {mode === 'login' ? <LogIn size={24} /> : <UserPlus size={24} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">
                                {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                            </h2>
                            <p className="text-brand-100 text-sm mt-1">
                                {mode === 'login'
                                    ? 'Accede a tu cuenta de analista'
                                    : 'Regístrate para comenzar a analizar pliegos'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {success && mode === 'signup' ? (
                        <div className="text-center py-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
                                <Check className="text-green-600 dark:text-green-400" size={32} />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                ¡Cuenta Creada!
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400">
                                Revisa tu email para confirmar tu cuenta, o inicia sesión si ya está activa.
                            </p>
                            <button
                                onClick={toggleMode}
                                className="mt-4 text-brand-600 hover:text-brand-700 font-medium"
                            >
                                Volver al inicio de sesión
                            </button>
                        </div>
                    ) : (
                        <>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="email"
                                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                                    >
                                        Correo electrónico
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="tu@email.com"
                                            required
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="password"
                                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                                    >
                                        Contraseña
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            id="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            minLength={6}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                    </div>
                                )}

                                {success && mode === 'login' && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                        <p className="text-sm text-green-600 dark:text-green-400">¡Inicio de sesión exitoso!</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !email || !password}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand-500/30"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            <span>Procesando...</span>
                                        </>
                                    ) : (
                                        <>
                                            {mode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />}
                                            <span>{mode === 'login' ? 'Iniciar Sesión' : 'Registrarse'}</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                    {mode === 'login' ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
                                </p>
                                <button
                                    onClick={toggleMode}
                                    disabled={loading}
                                    className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
                                >
                                    {mode === 'login' ? "Regístrate ahora" : "Inicia sesión aquí"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
