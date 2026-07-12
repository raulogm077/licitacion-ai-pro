import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, FileWarning, MessageSquare, RotateCcw, Send, Sparkles, User } from 'lucide-react';
import { services } from '../../../config/service-registry';
import type { AnalysisChatCitation } from '../../../services/analysis-chat.service';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { cn } from '../../../lib/utils';
import { logger } from '../../../services/logger';

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: AnalysisChatCitation[];
    usedTools?: string[];
};

type StoredChatState = {
    sessionId?: string;
    messages: ChatMessage[];
};

const STORAGE_KEY_PREFIX = 'analysis-chat';

const SUGGESTED_PROMPTS = [
    'Resume los riesgos principales de esta licitación.',
    'Qué criterios de adjudicación pesan más y cómo se valoran?',
    'Qué solvencia económica y técnica se exige?',
    'Qué datos ambiguos o faltantes debería revisar manualmente?',
];

function storageKey(hash: string) {
    return `${STORAGE_KEY_PREFIX}:${hash}`;
}

function isStoredChatState(value: unknown): value is StoredChatState {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as StoredChatState;
    return Array.isArray(candidate.messages);
}

export function AnalysisChatPanel({ analysisHash, analysisTitle }: { analysisHash?: string; analysisTitle?: string }) {
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sessionId, setSessionId] = useState<string>();
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messageEndRef = useRef<HTMLDivElement | null>(null);
    // Last hash the persist effect has seen. Used to skip the first persist
    // pass after a hash change: in that commit the in-memory messages still
    // belong to the previous hash (the restore effect's setState has not been
    // applied yet), and writing them would overwrite the new hash's stored
    // history. The re-render caused by the restore runs the effect again.
    const persistedHashRef = useRef<string | null>(null);

    useEffect(() => {
        if (!analysisHash) {
            setMessages([]);
            setSessionId(undefined);
            setError(null);
            return;
        }

        try {
            const raw = window.localStorage.getItem(storageKey(analysisHash));
            if (!raw) {
                setMessages([]);
                setSessionId(undefined);
                return;
            }

            const parsed = JSON.parse(raw);
            if (!isStoredChatState(parsed)) {
                window.localStorage.removeItem(storageKey(analysisHash));
                setMessages([]);
                setSessionId(undefined);
                return;
            }

            setMessages(parsed.messages);
            setSessionId(parsed.sessionId);
        } catch (storageError) {
            logger.warn('[AnalysisChatPanel] Failed to restore stored chat state', storageError);
            setMessages([]);
            setSessionId(undefined);
        }
    }, [analysisHash]);

    useEffect(() => {
        if (!analysisHash) {
            return;
        }
        if (persistedHashRef.current !== analysisHash) {
            persistedHashRef.current = analysisHash;
            return;
        }
        window.localStorage.setItem(
            storageKey(analysisHash),
            JSON.stringify({
                sessionId,
                messages,
            } satisfies StoredChatState)
        );
    }, [analysisHash, messages, sessionId]);

    useEffect(() => {
        if (typeof messageEndRef.current?.scrollIntoView === 'function') {
            messageEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages, isSending]);

    const subtitle = useMemo(() => {
        if (!analysisTitle || analysisTitle === 'No detectado') {
            return 'Consulta el análisis persistido sin releer los PDFs.';
        }
        return `Consulta el análisis de "${analysisTitle}" sin releer los PDFs.`;
    }, [analysisTitle]);

    const handleSend = async (forcedPrompt?: string) => {
        const nextMessage = (forcedPrompt ?? draft).trim();
        if (!analysisHash || !nextMessage || isSending) {
            return;
        }

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: nextMessage,
        };

        setDraft('');
        setError(null);
        setIsSending(true);
        setMessages((current) => [...current, userMessage]);

        try {
            const response = await services.analysisChat.sendMessage({
                analysisHash,
                message: nextMessage,
                sessionId,
            });

            setSessionId(response.sessionId);
            setMessages((current) => [
                ...current,
                {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: response.answer,
                    citations: response.citations,
                    usedTools: response.usedTools,
                },
            ]);
        } catch (sendError) {
            const message = sendError instanceof Error ? sendError.message : 'No se pudo enviar la consulta';
            setError(message);
            logger.error('[AnalysisChatPanel] Chat request failed', sendError, {
                analysisHash,
                sessionId,
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleResetConversation = () => {
        if (analysisHash) {
            window.localStorage.removeItem(storageKey(analysisHash));
        }
        setMessages([]);
        setSessionId(undefined);
        setError(null);
        setDraft('');
    };

    if (!analysisHash) {
        return (
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6">
                <div className="max-w-[1100px] mx-auto">
                    <Card className="border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/60">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                <FileWarning className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                Chat no disponible
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-slate-600 dark:text-slate-300 space-y-3">
                            <p>El copiloto conversacional solo se activa sobre análisis ya persistidos.</p>
                            <p>
                                Completa un análisis autenticado o abre una licitación desde historial para disponer de
                                un `analysisHash` válido.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
            <div className="p-6 max-w-[1100px] mx-auto space-y-5">
                <Card className="dark:bg-slate-800 dark:border-slate-700">
                    <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                                <Sparkles className="w-4 h-4" />
                                <span className="text-xs font-semibold uppercase tracking-widest">
                                    OpenAI Agents SDK
                                </span>
                            </div>
                            <CardTitle className="flex items-center gap-2 dark:text-white">
                                <MessageSquare className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                                Copiloto del análisis
                            </CardTitle>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
                        </div>

                        <Button variant="outline" size="sm" onClick={handleResetConversation} disabled={isSending}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Nueva conversación
                        </Button>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="h-[560px] overflow-y-auto px-6 py-5 bg-slate-50/70 dark:bg-slate-900/70">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col justify-center gap-6">
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            Haz preguntas concretas sobre el expediente
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                                            El agente usa solo el análisis ya persistido. Si algo es ambiguo o no está
                                            en el resultado, debería decirlo en lugar de inventarlo.
                                        </p>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        {SUGGESTED_PROMPTS.map((prompt) => (
                                            <button
                                                key={prompt}
                                                type="button"
                                                onClick={() => void handleSend(prompt)}
                                                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left text-sm text-slate-700 dark:text-slate-300 shadow-sm transition hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/40 dark:hover:bg-brand-900/20"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={cn(
                                                'flex gap-3',
                                                message.role === 'user' ? 'justify-end' : 'justify-start'
                                            )}
                                        >
                                            {message.role === 'assistant' && (
                                                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                                                    <Bot className="h-4 w-4" />
                                                </div>
                                            )}

                                            <div
                                                className={cn(
                                                    'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm',
                                                    message.role === 'user'
                                                        ? 'bg-slate-900 dark:bg-slate-700 text-white'
                                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                                                )}
                                            >
                                                <p className="whitespace-pre-wrap text-sm leading-6">
                                                    {message.content}
                                                </p>

                                                {message.role === 'assistant' &&
                                                    message.citations &&
                                                    message.citations.length > 0 && (
                                                        <div className="mt-4 space-y-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                                Evidencias
                                                            </p>
                                                            {message.citations.map((citation, index) => (
                                                                <div
                                                                    key={`${message.id}-citation-${index}`}
                                                                    className="rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
                                                                >
                                                                    <p className="font-medium text-slate-700 dark:text-slate-300">
                                                                        {citation.fieldPath || 'Sin fieldPath'}
                                                                    </p>
                                                                    <p className="mt-1 whitespace-pre-wrap">
                                                                        {citation.quote}
                                                                    </p>
                                                                    {(citation.pageHint ||
                                                                        citation.confidence !== undefined) && (
                                                                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                                            {citation.pageHint
                                                                                ? `Página: ${citation.pageHint}`
                                                                                : 'Página no disponible'}
                                                                            {citation.confidence !== undefined
                                                                                ? ` · Confianza: ${Math.round(
                                                                                      citation.confidence * 100
                                                                                  )}%`
                                                                                : ''}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                {message.role === 'assistant' &&
                                                    message.usedTools &&
                                                    message.usedTools.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {message.usedTools.map((toolName) => (
                                                                <span
                                                                    key={`${message.id}-${toolName}`}
                                                                    className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                                                                >
                                                                    {toolName}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                            </div>

                                            {message.role === 'user' && (
                                                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-700 text-white">
                                                    <User className="h-4 w-4" />
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {isSending && (
                                        <div className="flex gap-3">
                                            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                                                <Bot className="h-4 w-4" />
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-500 dark:text-slate-400 shadow-sm">
                                                Consultando el análisis...
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messageEndRef} />
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4">
                            {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

                            <form
                                className="flex gap-3"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void handleSend();
                                }}
                            >
                                <textarea
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    rows={3}
                                    placeholder="Pregunta por riesgos, criterios, solvencia, evidencias o ambigüedades..."
                                    className="min-h-[84px] flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none transition focus:border-brand-400 dark:focus:border-brand-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900"
                                />
                                <Button
                                    type="submit"
                                    className="h-auto min-w-28 self-stretch"
                                    disabled={isSending || !draft.trim()}
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Enviar
                                </Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
