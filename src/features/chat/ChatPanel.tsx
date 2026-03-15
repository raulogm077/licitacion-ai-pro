import { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    licitacionId: string;
    threadId: string | null;
}

export function ChatPanel({ isOpen, onClose, threadId }: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new message
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        // TODO: Integrate chat.service.ts here (Step 4)
        // Simulate response for now
        setTimeout(() => {
             const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Estoy buscando la respuesta en el pliego...",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMessage]);
            setIsTyping(false);
        }, 1000);
    };

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl flex flex-col z-50 transform transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
                    <Bot size={20} className="text-brand-500" />
                    <span>Asistente Legal IA</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-900">
                {messages.length === 0 ? (
                    <div className="text-center text-slate-500 dark:text-slate-400 mt-10">
                        <Bot size={40} className="mx-auto mb-4 text-slate-300" />
                        <p>Haz preguntas sobre el pliego actual.</p>
                        <div className="mt-4 flex flex-col gap-2">
                             <Button variant="outline" size="sm" onClick={() => setInput("¿Cuáles son los plazos de entrega?")}>
                                ¿Cuáles son los plazos de entrega?
                             </Button>
                             <Button variant="outline" size="sm" onClick={() => setInput("¿Existen penalidades por retraso?")}>
                                ¿Existen penalidades por retraso?
                             </Button>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                msg.role === 'user' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`p-3 rounded-2xl text-sm ${
                                msg.role === 'user'
                                    ? 'bg-brand-500 text-white rounded-tr-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                            }`}>
                                {/* Consider markdown parser here */}
                                {msg.content}
                            </div>
                        </div>
                    ))
                )}
                {isTyping && (
                    <div className="flex gap-3 max-w-[85%] mr-auto items-center">
                         <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                            <Bot size={16} />
                         </div>
                         <div className="text-slate-400 text-sm animate-pulse flex gap-1">
                             <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                             <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                             <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                         </div>
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Pregunta sobre el pliego..."
                        className="w-full pr-12 pl-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-brand-500 text-sm text-slate-900 dark:text-white placeholder-slate-500"
                        disabled={isTyping || !threadId}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isTyping || !threadId}
                        className="absolute right-2 p-2 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
}
