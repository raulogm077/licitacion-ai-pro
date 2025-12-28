import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Algo salió mal</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">
                            Ha ocurrido un error inesperado al renderizar esta sección.
                            {this.state.error && <span className="block mt-2 text-xs font-mono opacity-60">{this.state.error.message}</span>}
                        </p>
                        <button
                            onClick={this.handleReset}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            <RefreshCcw size={20} />
                            Reintentar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
