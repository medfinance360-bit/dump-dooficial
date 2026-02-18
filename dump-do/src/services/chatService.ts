// src/services/chatService.ts
// Dump.do chat via Supabase Edge Function

import { supabase } from './supabaseClient';

export type ChatMode = 'dump' | 'processar';

export interface ChatRequest {
  message: string;
  sessionId?: string;
  mode?: ChatMode;
  switchMode?: boolean;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  mode: ChatMode;
  riskLevel: string;
  isEmergencyResponse: boolean;
  tokensUsed?: {
    input: number;
    output: number;
  };
}

export interface ChatError {
  error: string;
  details?: string;
}

/**
 * Send a message to the Dump.do chat Edge Function.
 * Auth token is sent automatically via supabase session.
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke<ChatResponse | ChatError>('chat', {
    body: {
      message: request.message.trim(),
      sessionId: request.sessionId,
      mode: request.mode ?? 'dump',
      switchMode: request.switchMode,
    },
  });

  if (error) {
    throw new Error(error.message || 'Falha ao enviar mensagem');
  }

  const result = data as ChatResponse | ChatError;
  if (result && 'error' in result) {
    throw new Error(result.error || 'Erro no servidor');
  }

  const response = result as ChatResponse;
  if (!response || response.sessionId == null) {
    throw new Error('Resposta inválida do servidor');
  }

  return response;
}
