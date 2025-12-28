import React, { useState } from 'react';
import { X, Mail, Loader2, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const { signInWithMagicLink } = useAuthStore();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        const result = await signInWithMagicLink(email);

        setLoading(false);

        if (result.success) {
            setSuccess(true);
            setEmail('');
            // Keep modal open to show success message
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 3000);
        } else {
            setError(result.error || 'Error al enviar el enlace mágico');
        }
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
                            <Mail size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Iniciar Sesión</h2>
                            <p className="text-brand-100 text-sm mt-1">
                                Te enviaremos un enlace mágico por email
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
                                <Check className="text-green-600 dark:text-green-400" size={32} />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                ¡Correo enviado!
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400">
                                Revisa tu bandeja de entrada y haz clic en el enlace para iniciar sesión
                            </p>
                        </div>
                    ) : (
                        <>
                            <p className="text-slate-600 dark:text-slate-400 mb-6">
                                Ingresa tu email para recibir un enlace de acceso seguro. No necesitas contraseña.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="email"
                                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                                    >
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="tu@email.com"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                                        disabled={loading}
                                    />
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !email}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand-500/30"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            <span>Enviando enlace...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Mail size={20} />
                                            <span>Enviar enlace mágico</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                    Al continuar, aceptas nuestros términos de servicio y política de privacidad
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
