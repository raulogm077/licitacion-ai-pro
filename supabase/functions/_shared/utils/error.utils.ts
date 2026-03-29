interface OpenAIErrorLike {
    code?: string;
    message?: string;
    status?: number;
}

function isOpenAIError(error: unknown): error is OpenAIErrorLike {
    return typeof error === 'object' && error !== null && ('code' in error || 'status' in error);
}

export function mapOpenAIError(error: unknown): string {
    if (isOpenAIError(error) && error.code && error.message) {
        switch (error.code) {
            case 'rate_limit_exceeded':
                return 'Límite de velocidad de OpenAI excedido. Espera un minuto e inténtalo de nuevo.';
            case 'context_length_exceeded':
                return 'Documento demasiado grande para la ventana de contexto. Intenta con un archivo más pequeño.';
            case 'server_error':
                return 'Error temporal en los servidores de OpenAI. Reintenta en unos minutos.';
            case 'unsupported_model':
                return 'Modelo de IA no soportado. Contacta al soporte técnico.';
            default:
                return `Error de OpenAI (${error.code}): ${error.message}`;
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'Error desconocido en el procesamiento de IA';
}
