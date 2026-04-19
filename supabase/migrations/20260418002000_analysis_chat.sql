-- Conversational analysis sessions for chat-with-analysis-agent

CREATE TABLE IF NOT EXISTS public.analysis_chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    analysis_hash TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.analysis_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.analysis_chat_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'item',
    content JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_chat_sessions_user_hash
    ON public.analysis_chat_sessions (user_id, analysis_hash);

CREATE INDEX IF NOT EXISTS idx_analysis_chat_messages_session
    ON public.analysis_chat_messages (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_chat_messages_user
    ON public.analysis_chat_messages (user_id, created_at);

ALTER TABLE public.analysis_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own analysis chat sessions"
    ON public.analysis_chat_sessions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own analysis chat messages"
    ON public.analysis_chat_messages
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_analysis_chat_sessions_updated_at
BEFORE UPDATE ON public.analysis_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
