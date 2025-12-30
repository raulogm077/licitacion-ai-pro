/**
 * SSE Client for Backend API
 * 
 * Consumes Server-Sent Events from /api/pliegos/analyze endpoint
 * Handles streaming events: stage, log, delta, result, error
 */

export interface SSEStageEvent {
    stage: 'auth' | 'validate' | 'read' | 'hash' | 'extract' | 'ai' | 'map' | 'persist' | 'done';
}

export interface SSELogEvent {
    level: 'info' | 'warn' | 'error';
    code: string;
    message: string;
}

export interface SSEDeltaEvent {
    text: string;
}

export interface SSEResultEvent {
    licitacionData: unknown;
}

export interface SSEErrorEvent {
    code: string;
    userMessage: string;
}

export interface SSECallbacks {
    onStage?: (event: SSEStageEvent) => void;
    onLog?: (event: SSELogEvent) => void;
    onDelta?: (event: SSEDeltaEvent) => void;
    onResult?: (event: SSEResultEvent) => void;
    onError?: (event: SSEErrorEvent) => void;
    onComplete?: () => void;
}

export interface AnalyzeRequest {
    provider: 'gemini' | 'openai';
    readingMode: 'full' | 'keydata';
    hash: string;
    pdfBase64?: string;
    extractedText?: string;
    filename?: string;
}

/**
 * Calls the backend analysis API with SSE streaming
 * 
 * @param request - Analysis request parameters
 * @param callbacks - Event callbacks for SSE events
 * @param signal - AbortSignal for cancellation
 * @returns Promise that resolves when stream completes
 */
export async function analyzeWithSSE(
    request: AnalyzeRequest,
    callbacks: SSECallbacks,
    signal?: AbortSignal
): Promise<void> {
    // Get auth token from Supabase
    const token = await getAuthToken();
    if (!token) {
        throw new Error('No authentication token available');
    }

    // Call backend API with fetch
    const response = await fetch('/api/pliegos/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(request),
        signal
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
        throw new Error('No response body');
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        /* eslint-disable-next-line no-constant-condition */
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                callbacks.onComplete?.();
                break;
            }

            // Decode chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            let currentEvent = '';
            let currentData = '';

            for (const line of lines) {
                if (line.startsWith('event:')) {
                    currentEvent = line.substring(6).trim();
                } else if (line.startsWith('data:')) {
                    currentData = line.substring(5).trim();
                } else if (line === '') {
                    // Empty line = end of message
                    if (currentEvent && currentData) {
                        handleSSEEvent(currentEvent, currentData, callbacks);
                    }
                    currentEvent = '';
                    currentData = '';
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

function handleSSEEvent(event: string, data: string, callbacks: SSECallbacks) {
    try {
        const parsed = JSON.parse(data);

        switch (event) {
            case 'stage':
                callbacks.onStage?.(parsed as SSEStageEvent);
                break;
            case 'log':
                callbacks.onLog?.(parsed as SSELogEvent);
                break;
            case 'delta':
                callbacks.onDelta?.(parsed as SSEDeltaEvent);
                break;
            case 'result':
                callbacks.onResult?.(parsed as SSEResultEvent);
                break;
            case 'error':
                callbacks.onError?.(parsed as SSEErrorEvent);
                break;
            case 'done':
                // Optional: handle implicit done event if sent as distinct event type
                callbacks.onComplete?.();
                break;
            default:
                console.warn(`[SSE] Unknown event type: ${event}`);
        }
    } catch (error) {
        console.error('[SSE] Failed to parse event data:', error);
    }
}

/**
 * Helper to get Supabase auth token
 */
async function getAuthToken(): Promise<string | null> {
    // Import dynamically to avoid circular dependencies
    const { supabase } = await import('../config/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
}
