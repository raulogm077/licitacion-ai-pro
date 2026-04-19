import type { AgentInputItem } from 'npm:@openai/agents@0.1.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.3';

type SessionStoreDeps = {
  supabase: SupabaseClient;
  userId: string;
};

export async function getConversationHistory(
  sessionId: string,
  deps: SessionStoreDeps
): Promise<AgentInputItem[]> {
  const { data, error } = await deps.supabase
    .from('analysis_chat_messages')
    .select('content')
    .eq('session_id', sessionId)
    .eq('user_id', deps.userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`No se pudo leer la sesión: ${error.message}`);
  }

  return structuredClone(
    (data ?? []).map((row) => row.content as AgentInputItem)
  );
}

export async function replaceConversationHistory(
  sessionId: string,
  items: AgentInputItem[],
  deps: SessionStoreDeps
): Promise<void> {
  const { error: deleteError } = await deps.supabase
    .from('analysis_chat_messages')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', deps.userId);

  if (deleteError) {
    throw new Error(`No se pudo limpiar la sesión: ${deleteError.message}`);
  }

  if (items.length === 0) {
    return;
  }

  const rows = items.map((item) => ({
    session_id: sessionId,
    user_id: deps.userId,
    role: inferRole(item),
    content: structuredClone(item),
    metadata: inferMetadata(item),
  }));

  const { error: insertError } = await deps.supabase
    .from('analysis_chat_messages')
    .insert(rows as never);

  if (insertError) {
    throw new Error(`No se pudo persistir la sesión: ${insertError.message}`);
  }
}

function inferRole(item: AgentInputItem): string {
  if (item && typeof item === 'object') {
    if ('role' in item && typeof item.role === 'string') {
      return item.role;
    }
    if ('type' in item && typeof item.type === 'string') {
      return item.type;
    }
  }
  return 'item';
}

function inferMetadata(item: AgentInputItem): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const metadata: Record<string, unknown> = {};

  if ('type' in item && typeof item.type === 'string') {
    metadata.type = item.type;
  }
  if ('role' in item && typeof item.role === 'string') {
    metadata.role = item.role;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}
