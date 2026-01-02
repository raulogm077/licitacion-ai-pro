
export function mapOpenAIError(error: any): string {
    // If it's a "Run" error style object
    if (error?.code && error?.message) {
        switch (error.code) {
            case 'rate_limit_exceeded':
                return `⏳ Límite de Velocidad (Rate Limit): OpenAI está saturado. El sistema reintentó pero falló. Espera un minuto.`;
            case 'context_length_exceeded':
                return `📄 Documento demasiado grande: El PDF excede la ventana de contexto de la IA. Intenta con un archivo más pequeño.`;
            case 'server_error':
                return `🔥 Error de Servidor de OpenAI: Sus sistemas están caídos temporalmente. Reintenta en breve.`;
            case 'unsupported_model':
                return `🤖 Modelo no soportado: Configuración inválida del modelo. Contacta al soporte.`;
            default:
                return `⚠️ Error de OpenAI (${error.code}): ${error.message}`;
        }
    }

    // Generic JS Error
    if (error instanceof Error) {
        return error.message;
    }

    // String fallback
    if (typeof error === 'string') return error;

    return "Error desconocido en el procesamiento de IA";
}
