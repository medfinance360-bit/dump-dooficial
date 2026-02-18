/**
 * Dump.do dump-core Edge Function (v1.2+)
 *
 * JSON-only endpoint for /app: MIND-SAFE → LLM → sanitize → JSON.
 * Refined prompt: flexibilidade, validar recusas, não forçar ação, formato adaptável.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { assessRisk } from '../chat/mind-safe.ts';

// ============================================
// Constants
// ============================================

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 8000;
const RESPONSE_MAX_CHARS = 400;
const MICRO_ACTION_MAX_CHARS = 120;

const ALLOWED_EMOTIONS = new Set([
  'raiva', 'tristeza', 'ansiedade', 'exaustão', 'culpa', 'frustração',
  'confusão', 'esperança', 'alívio', 'incerto',
]);

// ============================================
// SYSTEM_PROMPT_V13 – Refined: flexibilidade e adaptação
// ============================================

const SYSTEM_PROMPT_V13 = `Você é o Dump.do — um espaço seguro para desabafo. Modo apenas escuta: acolher e validar emoção; sem conselhos, sem soluções, sem planos. Fale em português BR, curto e humano.

REGRAS OBRIGATÓRIAS:

1) Validar recusas e "só ficar"
- Se a pessoa disser que não quer anotar, mover, fazer nada, ou que só quer ficar na sua / refletir: NÃO sugira ação. Responda com validação curta ("Tudo bem.", "Ok.", "Parece exaustivo mesmo.") e no máximo UMA pergunta opcional ou oferta de formato alternativo (ex.: "Quer só silêncio ou prefere descarregar em 2 frases?").

2) Não forçar micro-ação
- A maioria das respostas NÃO precisa ter micro_action; ela é opcional e deve aparecer só quando for muito óbvio que pode ajudar.
- Micro-ação só quando a pessoa NÃO tiver acabado de recusar ação ou de dizer que quer só ficar/refletir. Se ela disse "não quero fazer X" ou "só queria ficar de boa", a resposta NÃO pode pedir que faça X nem outra ação no lugar. Se houver qualquer recusa explícita de ação nas últimas 2 mensagens, micro_action deve ser sempre null.

3) Formato flexível da resposta (response)
Conforme o contexto, você pode usar:
- Uma validação + pergunta cirúrgica.
- Uma validação + pergunta de múltipla escolha (ex.: "Qual combina mais? A) tô no limite B) travado C) com medo").
- Pedido de lista curta ("Lista 3, com poucas palavras").
- Duas frases para completar ("1) Hoje eu tô ___ 2) O que mais me assusta é ___").
- Só validação quando fizer sentido ("Ok. Então hoje talvez seja mais sobre aguentar do que resolver.").

4) Tom
- Frases curtas e humanas: "Beleza.", "Tudo bem.", "Ok.", "Parece exaustivo mesmo."
- Evite jargão de terapia/coach; português simples e direto.

5) "Aguentar vs resolver"
- Em momentos de muito cansaço ou sobrecarga, às vezes a resposta pode ser que hoje é mais sobre aguentar do que resolver — não pressione por solução ou ação nesses casos.

6) Quando a pessoa recusa escrever/agir
- Se não quiser anotar ou escrever, ofereça alternativa mais fácil: múltipla escolha (A/B/C/D) ou pergunta sim/não ("Quer ficar em silêncio ou prefere descarregar em 2 frases?").

7) Contexto pesado e âncora no concreto
- Se o usuário trouxer contexto forte (perdas, crise, vício, ruptura, sobrecarga): reconheça em UMA frase ("Entendido.", "Parece pesado mesmo."); não romantize, sem clichês.
- Ancore no concreto: use detalhes que a pessoa deu (plantão, hospital, madrugada, "no trabalho", "em casa") para UMA pergunta focada naquele momento (ex.: "No hospital, quase fechando o plantão: qual foi o momento mais pesado dessa noite?").
- Quando a pessoa disser que a pergunta é complexa ou difícil: não insista na mesma pergunta. Ofereça 2 ou 3 subperguntas mais simples ou múltipla escolha ("Qual dessas três bateu mais forte?").
- Se a pessoa já respondeu que são várias coisas juntas ("mistura dos 3", "um pouco dos 3", "tudo junto"): NÃO repita a mesma pergunta (ex.: "qual pesa mais: trabalho, família ou pessoal?"). Valide ("Faz sentido, tudo junto mesmo.") e mude o ângulo — por exemplo pergunte pela sensação no momento (múltipla escolha: "Qual combina mais agora? A) cansado B) pressionado C) vazio") ou uma pergunta concreta diferente.

EXEMPLOS (estilo referência — anonimizados):
a) Validação + pergunta concreta (contexto de plantão): usuário diz que está de plantão de madrugada e que foi pesado. Resposta: "Plantão de madrugada pode ser puxado. Qual foi o momento mais pesado dessa noite?"
b) Recusa de ação: usuário diz "não quero anotar nada, só queria ficar refletindo." Resposta: "Tudo bem não anotar. Hoje talvez seja mais sobre aguentar do que resolver."
c) Pergunta complexa: oferecer múltipla escolha. Ex.: "Qual combina mais com você agora? A) tô no limite B) travado C) com medo de falhar"
d) Usuário disse que são várias áreas juntas ("mistura dos 3"): não repetir "qual pesa mais: trabalho, família ou pessoal?". Valide e mude o ângulo. Ex.: "Faz sentido, tudo junto mesmo. Qual sensação tá mais forte agora? A) cansado B) pressionado C) vazio"

SAÍDA OBRIGATÓRIA (JSON apenas, sem markdown):
{
  "response": "sua resposta em texto (validação + eventual pergunta ou opções; max ~400 caracteres)",
  "detected_emotions": ["emoção1", "emoção2"],
  "micro_action": null ou "uma microação opcional em até 120 caracteres, só se fizer sentido e a pessoa não recusou ação",
  "should_end": false
}
Emoções permitidas: raiva, tristeza, ansiedade, exaustão, culpa, frustração, confusão, esperança, alívio, incerto. Máximo 2.`;

// ============================================
// Sanitize model output
// ============================================

interface RawToolOutput {
  response?: string | null;
  detected_emotions?: unknown;
  micro_action?: string | null;
  should_end?: boolean;
}

function sanitizeModelOutput(raw: RawToolOutput): {
  response: string;
  detected_emotions: string[];
  micro_action: string | null;
  should_end: boolean;
} {
  let response = typeof raw.response === 'string' ? raw.response.trim() : '';
  if (!response) response = 'Entendi.';

  // Truncate to RESPONSE_MAX_CHARS. Do NOT cut at the first "?" when the text
  // contains multiple-choice options (A) B) C)) so "Qual combina mais? A) ... B) ..." stays intact.
  if (response.length > RESPONSE_MAX_CHARS) {
    const hasOptions = /(^|\s)[A-D][\)\.]\s/.test(response);
    if (hasOptions) {
      response = response.slice(0, RESPONSE_MAX_CHARS).trim();
      const lastSpace = response.lastIndexOf(' ');
      if (lastSpace > RESPONSE_MAX_CHARS - 30) {
        response = response.slice(0, lastSpace).trim();
      }
    } else {
      const firstQ = response.indexOf('?');
      if (firstQ >= 0 && firstQ < RESPONSE_MAX_CHARS) {
        response = response.slice(0, firstQ + 1).trim();
      } else {
        response = response.slice(0, RESPONSE_MAX_CHARS).trim();
      }
    }
  }

  let detected_emotions: string[] = [];
  if (Array.isArray(raw.detected_emotions)) {
    detected_emotions = raw.detected_emotions
      .filter((e): e is string => typeof e === 'string' && ALLOWED_EMOTIONS.has(e.toLowerCase()))
      .slice(0, 2)
      .map((e) => e.toLowerCase());
  }

  let micro_action: string | null = null;
  if (typeof raw.micro_action === 'string' && raw.micro_action.trim()) {
    micro_action = raw.micro_action.trim().slice(0, MICRO_ACTION_MAX_CHARS);
  }

  const should_end = Boolean(raw.should_end);

  return {
    response,
    detected_emotions,
    micro_action,
    should_end,
  };
}

// ============================================
// Build history for LLM
// ============================================

interface HistoryItem {
  role: 'user' | 'assistant';
  content?: string | null;
  ai_response?: { response?: string | null } | null;
}

function buildHistoryMessages(history: HistoryItem[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let totalChars = 0;
  const limited = history.slice(-MAX_HISTORY_MESSAGES);

  for (let i = limited.length - 1; i >= 0; i--) {
    const item = limited[i];
    const content =
      item.role === 'assistant' && item.ai_response?.response
        ? item.ai_response.response
        : item.content;
    const text = (content ?? '').trim();
    if (!text) continue;
    if (totalChars + text.length > MAX_HISTORY_CHARS) break;
    totalChars += text.length;
    out.unshift({ role: item.role, content: text });
  }
  return out;
}

// ============================================
// OpenAI chat (JSON mode)
// ============================================

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): Promise<string> {
  const allMessages = [
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...allMessages,
      ],
      max_tokens: 512,
      temperature: 0.7,
      response_format: { type: 'json_object' as const },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('OpenAI: empty or invalid response');
  return content;
}

// ============================================
// Handler
// ============================================

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: { message?: string; history?: HistoryItem[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return jsonResponse({ error: 'message is required' }, 400);
  }

  const history: HistoryItem[] = Array.isArray(body.history) ? body.history : [];

  // MIND-SAFE
  const risk = assessRisk(message);
  if (risk.requiresEmergencyResponse && risk.emergencyResponse) {
    return jsonResponse(
      {
        ok: true,
        response: risk.emergencyResponse,
        detected_emotions: [],
        micro_action: null,
        should_end: false,
      },
      200
    );
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'OpenAI API key not configured' }, 500);
  }

  try {
    const historyMessages = buildHistoryMessages(history);
    const rawContent = await callOpenAI(
      apiKey,
      SYSTEM_PROMPT_V13,
      historyMessages,
      message
    );

    let raw: RawToolOutput;
    try {
      raw = JSON.parse(rawContent) as RawToolOutput;
    } catch {
      return jsonResponse(
        {
          ok: true,
          response: rawContent.slice(0, RESPONSE_MAX_CHARS).trim() || 'Entendi.',
          detected_emotions: [],
          micro_action: null,
          should_end: false,
        },
        200
      );
    }

    const sanitized = sanitizeModelOutput(raw);
    return jsonResponse(
      {
        ok: true,
        response: sanitized.response,
        detected_emotions: sanitized.detected_emotions,
        micro_action: sanitized.micro_action,
        should_end: sanitized.should_end,
      },
      200
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('dump-core error:', msg);
    return jsonResponse(
      { error: 'Failed to get response from AI' },
      500
    );
  }
});
