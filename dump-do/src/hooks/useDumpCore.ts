/**
 * Dump.do v1.2 - useDumpCore hook
 *
 * Calls dump-core edge function.
 * When user is logged in: persists session + messages for premium (insights later).
 * When not: in-memory only.
 * MIND-SAFE only on backend.
 */

import { useState, useCallback, useEffect } from 'react';
import type { DumpMessage, DumpCoreRequest, DumpCoreResponse } from '../types/dump';
import { supabase } from '../services/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MODE = 'dump';

function dbMessageToDumpMessage(row: { id: string; role: string; content: string }): DumpMessage {
  return {
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    ...(row.role === 'assistant' && {
      ai_response: {
        response: row.content,
        detected_emotions: [],
        micro_action: null,
        should_end: false,
      },
    }),
  };
}

export function useDumpCore() {
  const [messages, setMessages] = useState<DumpMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Carrega última sessão ativa e mensagens quando logado (base para premium/insights)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      if (!user || cancelled) return;
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('mode', MODE)
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !session?.id) return;
      setSessionId(String(session.id));
      const { data: rows } = await supabase
        .from('messages')
        .select('id, role, content')
        .eq('session_id', session.id)
        .eq('mode', MODE)
        .order('created_at', { ascending: true });
      if (cancelled || !rows?.length) return;
      setMessages(rows.map(dbMessageToDumpMessage));
    })();
    return () => { cancelled = true; };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: DumpMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    let currentSessionId = sessionId ?? null;
    if (user && !currentSessionId) {
      const { data: newSession } = await supabase
        .from('sessions')
        .insert({ user_id: user.id, mode: MODE })
        .select('id')
        .single();
      if (newSession?.id) {
        currentSessionId = String(newSession.id);
        setSessionId(currentSessionId);
      }
    }
    if (user && currentSessionId) {
      await supabase.from('messages').insert({
        session_id: currentSessionId,
        user_id: user.id,
        role: 'user',
        content: text.trim(),
        mode: MODE,
        risk_level: 'none',
      });
    }

    try {
      // Historico no formato esperado pelo dump-core v1.3
      const history: DumpCoreRequest['history'] = messages.map((m) =>
        m.role === 'assistant' && m.ai_response?.response
          ? {
              role: 'assistant',
              content: m.ai_response.response,
              ai_response: { response: m.ai_response.response },
            }
          : { role: m.role, content: m.content }
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dump-core`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          message: text.trim(),
          history,
        } satisfies DumpCoreRequest),
      });
      clearTimeout(timeoutId);

      let json: unknown;
      try {
        const text = await res.text();
        json = text ? JSON.parse(text) : {};
      } catch {
        setError('Resposta do servidor não é JSON válido');
        return;
      }

      if (!res.ok) {
        let errMsg: string = 'Erro ao processar';
        if (json && typeof json === 'object') {
          if ('error' in json && typeof (json as { error?: string }).error === 'string') {
            errMsg = (json as { error: string }).error;
          } else if ('message' in json && typeof (json as { message?: string }).message === 'string') {
            errMsg = (json as { message: string }).message;
          }
        }
        setError(errMsg);
        return;
      }

      const data = json as DumpCoreResponse;

      // Backend pode retornar 200 com { error, ok: false } em alguns fluxos
      if (data && typeof data === 'object' && 'error' in data && (data as { ok?: boolean }).ok === false) {
        setError((data as { error?: string }).error ?? 'Erro no servidor');
        return;
      }

      if (!data || typeof data.response !== 'string') {
        console.error('dump-core: resposta inválida (esperado { response: string, ... })', json);
        const serverMsg =
          data && typeof data === 'object' && 'error' in data && typeof (data as { error?: string }).error === 'string'
            ? (data as { error: string }).error
            : null;
        setError(serverMsg ? `Resposta inválida do servidor: ${serverMsg}` : 'Resposta inválida do servidor');
        return;
      }

      const assistMsg: DumpMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        ai_response: {
          response: data.response,
          detected_emotions: data.detected_emotions ?? [],
          micro_action: data.micro_action ?? null,
          should_end: data.should_end ?? false,
        },
      };
      setMessages((prev) => [...prev, assistMsg]);

      if (user && currentSessionId) {
        await supabase.from('messages').insert({
          session_id: currentSessionId,
          user_id: user.id,
          role: 'assistant',
          content: data.response,
          mode: MODE,
          risk_level: 'none',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro de conexão';
      if (msg === 'Failed to fetch' || msg.includes('fetch') || msg.includes('NetworkError')) {
        setError('Não foi possível conectar. Verifique sua internet e tente de novo.');
      } else if (e instanceof Error && e.name === 'AbortError') {
        setError('A conexão demorou demais. Tente de novo.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, sessionId]);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearError,
    isLoggedIn: isLoggedIn ?? false,
    isPersisted: isLoggedIn === true && sessionId !== null,
  };
}
