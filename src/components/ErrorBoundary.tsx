import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
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
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-red-50 text-red-900">
                    <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-xl border border-red-200">
                        <h1 className="text-2xl font-bold mb-4">Algo salió mal</h1>
                        <p className="mb-4 text-sm opacity-80">Se ha producido un error inesperado en la aplicación.</p>
                        <pre className="bg-red-100 p-3 rounded text-xs overflow-auto mb-4">
                            {this.state.error?.message}
                        </pre>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors w-full"
                        >
                            Volver al inicio (Recargar)
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
