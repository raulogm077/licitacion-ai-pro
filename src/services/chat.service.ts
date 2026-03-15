import { supabase } from '../config/supabase';
import { env } from '../config/env';

export interface ChatMessage {
    id: string;
    licitacion_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

export type ChatStreamEvent =
  | { type: 'agent_message', content: string }
  | { type: 'complete', message: string }
  | { type: 'heartbeat', timestamp: number }
  | { type: 'error', message: string };

class ChatService {
    /**
     * Inicia un chat enviando la pregunta a la Edge Function
     */
    async askQuestion(
        threadId: string,
        assistantId: string,
        content: string,
        onProgress: (event: ChatStreamEvent) => void
    ): Promise<string> {

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Usuario no autenticado');

        const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/chat-with-document`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                thread_id: threadId,
                assistant_id: assistantId,
                content
            })
        });

        if (!response.ok) {
             const err = await response.text();
             throw new Error(`Error en el servidor: ${err}`);
        }

        if (!response.body) {
            throw new Error('No se recibió body en la respuesta de SSE');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let done_outer = false;
        let finalResponse = '';

        try {
            while (!done_outer) {
                const { done, value } = await reader.read();
                if (done) { done_outer = true; break; }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');

                // Conservar el último fragmento si está incompleto
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (!dataStr || dataStr === '[DONE]') continue;

                        try {
                            const event = JSON.parse(dataStr) as ChatStreamEvent;
                            onProgress(event);

                            if (event.type === 'agent_message') {
                                finalResponse += event.content;
                            } else if (event.type === 'complete') {
                                finalResponse = event.message; // El mensaje completo ensamblado
                            } else if (event.type === 'error') {
                                throw new Error(event.message);
                            }
                        } catch (e) {
                            console.error('Error parseando evento SSE chat:', e, dataStr);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return finalResponse;
    }

    /**
     * Carga el historial de la DB
     */
    async getHistory(licitacionId: string): Promise<ChatMessage[]> {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('licitacion_id', licitacionId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data as ChatMessage[];
    }

    /**
     * Guarda un mensaje en la DB
     */
    async saveMessage(licitacionId: string, role: 'user' | 'assistant', content: string): Promise<ChatMessage> {
         const { data, error } = await supabase
            .from('chat_messages')
            .insert({
                licitacion_id: licitacionId,
                role,
                content
            })
            .select()
            .single();

        if (error) throw error;
        return data as ChatMessage;
    }
}

export const chatService = new ChatService();
