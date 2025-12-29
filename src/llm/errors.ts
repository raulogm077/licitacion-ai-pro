/**
 * Typed errors for LLM operations
 */

export enum LLMErrorCode {
    // Configuration errors
    CONFIG_INVALID = 'CONFIG_INVALID',
    CONFIG_MISSING_KEY = 'CONFIG_MISSING_KEY',

    // API errors
    API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
    API_RATE_LIMIT = 'API_RATE_LIMIT',
    API_AUTHENTICATION = 'API_AUTHENTICATION',
    API_NOT_FOUND = 'API_NOT_FOUND',
    API_SERVER_ERROR = 'API_SERVER_ERROR',
    API_TIMEOUT = 'API_TIMEOUT',

    // Processing errors
    PROCESSING_INVALID_RESPONSE = 'PROCESSING_INVALID_RESPONSE',
    PROCESSING_PARSE_ERROR = 'PROCESSING_PARSE_ERROR',
    PROCESSING_VALIDATION_ERROR = 'PROCESSING_VALIDATION_ERROR',

    // User errors
    USER_CANCELLED = 'USER_CANCELLED',

    // Unknown
    UNKNOWN = 'UNKNOWN'
}

export class LLMProviderError extends Error {
    constructor(
        public readonly code: LLMErrorCode,
        message: string,
        public readonly originalError?: unknown,
        public readonly isRetriable: boolean = false,
        public readonly hint?: string
    ) {
        super(message);
        this.name = 'LLMProviderError';
    }

    static fromQuotaError(message: string, hint?: string): LLMProviderError {
        return new LLMProviderError(
            LLMErrorCode.API_QUOTA_EXCEEDED,
            message,
            undefined,
            true, // Retriable after delay
            hint || 'Espera unos minutos antes de intentar nuevamente.'
        );
    }

    static fromRateLimit(message: string): LLMProviderError {
        return new LLMProviderError(
            LLMErrorCode.API_RATE_LIMIT,
            message,
            undefined,
            true,
            'Se ha excedido el límite de peticiones por minuto.'
        );
    }

    static fromCancellation(): LLMProviderError {
        return new LLMProviderError(
            LLMErrorCode.USER_CANCELLED,
            'Análisis cancelado por el usuario',
            undefined,
            false
        );
    }

    static fromParseError(message: string, originalError?: unknown): LLMProviderError {
        return new LLMProviderError(
            LLMErrorCode.PROCESSING_PARSE_ERROR,
            message,
            originalError,
            false,
            'La respuesta del modelo no pudo ser interpretada.'
        );
    }
}
