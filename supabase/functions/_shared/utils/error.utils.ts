interface OpenAIErrorLike {
    code?: string;
    message?: string;
    status?: number;
    name?: string;
}

function isOpenAIError(error: unknown): error is OpenAIErrorLike {
    return typeof error === 'object' && error !== null && ('code' in error || 'status' in error);
}

/**
 * @openai/agents raises typed errors when guardrails trip. We translate them
 * to user-facing Spanish messages here instead of leaking the SDK class name
 * to the SSE stream.
 */
function isAgentsError(error: unknown, name: string): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const e = error as { name?: unknown; constructor?: { name?: unknown } };
    if (e.name === name) return true;
    if (e.constructor && e.constructor.name === name) return true;
    return false;
}

export function mapOpenAIError(error: unknown): string {
    if (isAgentsError(error, 'InputGuardrailTripwireTriggered')) {
        return 'La solicitud no superó las validaciones de entrada (plantilla o contenido inválido).';
    }
    if (isAgentsError(error, 'OutputGuardrailTripwireTriggered')) {
        return 'La respuesta del modelo no cumplió el formato esperado tras los reintentos.';
    }

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
