/**
 * Dump.do v1.2 - dump-core types
 */

export interface DumpMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ai_response?: {
    response: string;
    detected_emotions?: string[];
    micro_action?: string | null;
    should_end?: boolean;
  };
}

// History enviado para o dump-core v1.3
export type HistoryItem = {
  role: 'user' | 'assistant';
  content?: string | null;
  ai_response?: {
    response?: string | null;
  } | null;
};

export interface DumpCoreRequest {
  message: string;
  history: HistoryItem[];
}

// Contrato de saída do dump-core v1.3
export interface DumpCoreResponse {
  response: string;
  detected_emotions: string[];
  micro_action: string | null;
  should_end: boolean;
}
