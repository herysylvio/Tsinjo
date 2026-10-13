import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ConversationSummary = {
  conversationId: string;
  title: string;
  createdAt: string;
  isActive: boolean;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const TITLE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-title`;

export const useChat = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);

  const generateTitle = useCallback(async (convId: string, msgs: ChatMessage[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(TITLE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          conversationId: convId,
          messages: msgs.slice(0, 4).map(m => ({ role: m.role, content: m.content.slice(0, 200) })),
        }),
      });
    } catch (e) {
      console.error('Title generation failed:', e);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;

    // Get all conversation IDs with their first message date
    const { data: chatData } = await supabase
      .from('chat_messages')
      .select('conversation_id, content, role, created_at')
      .eq('user_id', user.id)
      .eq('role', 'user')
      .order('created_at', { ascending: true });

    if (!chatData || chatData.length === 0) {
      setConversations([]);
      return;
    }

    // Group by conversation_id
    const convMap = new Map<string, { fallbackTitle: string; createdAt: string }>();
    for (const row of chatData) {
      if (!convMap.has(row.conversation_id)) {
        convMap.set(row.conversation_id, {
          fallbackTitle: row.content.slice(0, 80),
          createdAt: row.created_at,
        });
      }
    }

    const convIds = Array.from(convMap.keys());

    // Fetch AI-generated titles
    const { data: titles } = await supabase
      .from('conversation_titles')
      .select('conversation_id, title')
      .eq('user_id', user.id)
      .in('conversation_id', convIds);

    const titleMap = new Map<string, string>();
    (titles || []).forEach(t => titleMap.set(t.conversation_id, t.title));

    const list: ConversationSummary[] = convIds
      .map(id => ({
        conversationId: id,
        title: titleMap.get(id) || convMap.get(id)!.fallbackTitle,
        createdAt: convMap.get(id)!.createdAt,
        isActive: id === conversationId,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setConversations(list);
  }, [user?.id, conversationId]);

  const loadConversation = useCallback(async (convId: string) => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      setConversationId(convId);
      setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
    }
  }, [user?.id]);

  const deleteConversation = useCallback(async (convId: string) => {
    if (!user?.id) return;
    await Promise.all([
      supabase.from('chat_messages').delete().eq('user_id', user.id).eq('conversation_id', convId),
      supabase.from('conversation_titles').delete().eq('user_id', user.id).eq('conversation_id', convId),
    ]);

    if (convId === conversationId) {
      setMessages([]);
      setConversationId(null);
    }
    await loadConversations();
  }, [user?.id, conversationId, loadConversations]);

  // Load latest conversation on mount
  useEffect(() => {
    if (!user?.id || historyLoaded) return;

    const loadHistory = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('role, content, conversation_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const convId = data[0].conversation_id;
        const { data: convMessages } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('user_id', user.id)
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (convMessages && convMessages.length > 0) {
          setConversationId(convId);
          setMessages(convMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
        }
      }
      setHistoryLoaded(true);
    };

    loadHistory();
  }, [user?.id, historyLoaded]);

  const persistMessage = useCallback(async (msg: ChatMessage, convId: string) => {
    if (!user?.id) return;
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: msg.role,
      content: msg.content,
      conversation_id: convId,
    });
  }, [user?.id]);

  const sendMessage = useCallback(async (input: string) => {
    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const isNewConversation = !conversationId;
    const convId = conversationId || crypto.randomUUID();
    if (!conversationId) setConversationId(convId);

    await persistMessage(userMsg, convId);

    let assistantSoFar = '';

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const allMessages = [...messages, userMsg];
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        toast({ title: t('chat.error'), variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          accountId: accountId || undefined,
        }),
      });

      if (resp.status === 429) {
        toast({ title: t('chat.rate_limited'), variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast({ title: t('chat.payment_required'), variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      if (assistantSoFar) {
        await persistMessage({ role: 'assistant', content: assistantSoFar }, convId);

        // Generate title for new conversations after first exchange
        if (isNewConversation) {
          generateTitle(convId, [...allMessages, { role: 'assistant', content: assistantSoFar }]);
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      toast({ title: t('chat.error'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [messages, t, conversationId, persistMessage, generateTitle, accountId]);

  const clearChat = useCallback(async () => {
    if (user?.id && conversationId) {
      await Promise.all([
        supabase.from('chat_messages').delete().eq('user_id', user.id).eq('conversation_id', conversationId),
        supabase.from('conversation_titles').delete().eq('user_id', user.id).eq('conversation_id', conversationId),
      ]);
    }
    setMessages([]);
    setConversationId(null);
  }, [user?.id, conversationId]);

  const renameConversation = useCallback(async (convId: string, newTitle: string) => {
    if (!user?.id) return;
    // Upsert: if title row exists update it, otherwise insert
    const { data: existing } = await supabase
      .from('conversation_titles')
      .select('id')
      .eq('conversation_id', convId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('conversation_titles')
        .update({ title: newTitle })
        .eq('conversation_id', convId)
        .eq('user_id', user.id);
    } else {
      await supabase.from('conversation_titles').insert({
        conversation_id: convId,
        user_id: user.id,
        title: newTitle,
      });
    }

    setConversations(prev =>
      prev.map(c => c.conversationId === convId ? { ...c, title: newTitle } : c)
    );
  }, [user?.id]);

  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return {
    messages, isLoading, sendMessage, clearChat, newConversation, historyLoaded,
    conversations, loadConversations, loadConversation, deleteConversation, renameConversation,
    accountId, setAccountId,
  };
};
