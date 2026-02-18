/**
 * Dump.do Chat Edge Function
 * 
 * Endpoint principal de chat com:
 * - Detecção de crises MIND-SAFE
 * - Lógica de modos Dump/Processar
 * - Integração LLM (Gemini/OpenAI/Anthropic)
 * 
 * - Rate limiting e error handling
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assessRisk, getRiskEventData, type RiskAssessment } from './mind-safe.ts';
import { buildSystemPrompt, getModeTransitionMessage, type ChatMode } from './prompts.ts';
import { getLLMProvider, getDefaultConfig, type LLMMessage } from './llm-provider.ts';
import { GEMINI_RESPONSE_SCHEMA } from './response-schema.ts';
import { sanitizeStructuredResponse, assembleMessage } from './sanitize-response.ts';

// ============================================
// Types
// ============================================

interface ChatRequest {
  message: string;
  sessionId?: string;
  mode?: ChatMode;
  switchMode?: boolean; // Flag to switch mode
}

interface ChatResponse {
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

interface SessionContext {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  summary?: string;
}

function getEnvNumber(name: string, fallback: number): number {
  const rawValue = Deno.env.get(name);
  if (!rawValue) {
    return fallback;
  }
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ============================================
// Rate Limiting (Simple in-memory)
// ============================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = getEnvNumber('RATE_LIMIT_MAX', 20);
const MAX_CONTEXT_MESSAGES = getEnvNumber('MAX_CONTEXT_MESSAGES', 10);
const MAX_MESSAGE_LENGTH = getEnvNumber('MAX_MESSAGE_LENGTH', 10000);

const ALLOWED_LLM_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const;
type LLMProviderName = typeof ALLOWED_LLM_PROVIDERS[number];

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

function getProviderFromEnv(): LLMProviderName {
  const envProvider = Deno.env.get('LLM_PROVIDER')?.toLowerCase();
  if (!envProvider) {
    return 'gemini';
  }
  if ((ALLOWED_LLM_PROVIDERS as readonly string[]).includes(envProvider)) {
    return envProvider as LLMProviderName;
  }
  throw new Error(`Unsupported LLM_PROVIDER: ${envProvider}`);
}

function getApiKeyForProvider(provider: LLMProviderName): string {
  const envKeyMap: Record<LLMProviderName, string> = {
    gemini: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  };

  const apiKey = Deno.env.get(envKeyMap[provider]);
  if (!apiKey) {
    throw new Error(`${envKeyMap[provider]} not configured`);
  }
  return apiKey;
}

function buildJsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

// ============================================
// Session Context Management
// ============================================

async function getSessionContext(
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<SessionContext> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(MAX_CONTEXT_MESSAGES);

  if (error) {
    console.error('Error fetching session context:', error);
    return { messages: [] };
  }

  // Reverse to get chronological order
  return {
    messages: (messages || []).reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  };
}

async function createNewSession(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  mode: ChatMode
): Promise<string> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      mode: mode,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data.id;
}

// ============================================
// Message Storage
// ============================================

async function saveMessage(
  supabase: ReturnType<typeof createClient>,
  params: {
    sessionId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    mode: ChatMode;
    riskAssessment?: RiskAssessment;
    tokensInput?: number;
    tokensOutput?: number;
    modelUsed?: string;
    responseTimeMs?: number;
  }
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    session_id: params.sessionId,
    user_id: params.userId,
    role: params.role,
    content: params.content,
    mode: params.mode,
    risk_level: params.riskAssessment?.riskLevel || 'none',
    risk_indicators: params.riskAssessment?.indicators || [],
    is_emergency_response: params.riskAssessment?.requiresEmergencyResponse || false,
    tokens_input: params.tokensInput,
    tokens_output: params.tokensOutput,
    model_used: params.modelUsed,
    response_time_ms: params.responseTimeMs,
  });

  if (error) {
    console.error('Error saving message:', error);
  }
}

// ============================================
// Risk Event Logging
// ============================================

async function logRiskEvent(
  supabase: ReturnType<typeof createClient>,
  params: {
    userId: string;
    sessionId: string;
    messageId?: string;
    riskAssessment: RiskAssessment;
    sessionDurationMinutes?: number;
    messageCount?: number;
  }
): Promise<void> {
  if (params.riskAssessment.riskLevel === 'none' || params.riskAssessment.riskLevel === 'low') {
    return; // Only log medium+ risk events
  }

  const eventData = getRiskEventData(
    params.riskAssessment,
    params.sessionDurationMinutes,
    params.messageCount
  );

  const { error } = await supabase.from('risk_events').insert({
    user_id: params.userId,
    session_id: params.sessionId,
    message_id: params.messageId,
    ...eventData,
  });

  if (error) {
    console.error('Error logging risk event:', error);
  }
}

// ============================================
// Main Handler
// ============================================

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return buildJsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return buildJsonResponse({ error: 'Missing authorization header' }, 401, corsHeaders);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return buildJsonResponse({ error: 'Invalid or expired token' }, 401, corsHeaders);
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return buildJsonResponse(
        { error: 'Rate limit exceeded. Please wait a moment.' },
        429,
        corsHeaders
      );
    }

    // Parse request body
    const body: ChatRequest = await req.json();
    
    if (!body.message || typeof body.message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trim and validate message
    const userMessage = body.message.trim();
    if (userMessage.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Message cannot be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userMessage.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Message too long (max 10000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===========================================
    // MIND-SAFE: Risk Assessment (BEFORE LLM)
    // ===========================================
    const riskAssessment = assessRisk(userMessage);
    
    // Get or create session
    let sessionId = body.sessionId;
    let currentMode: ChatMode = body.mode || 'dump';

    if (!sessionId) {
      sessionId = await createNewSession(supabase, user.id, currentMode);
    } else {
      // Fetch existing session to get mode
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, mode')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        sessionId = await createNewSession(supabase, user.id, currentMode);
      } else {
        currentMode = session.mode as ChatMode;
      }
    }

    // Handle mode switch
    if (body.switchMode && body.mode && body.mode !== currentMode) {
      const previousMode = currentMode;
      currentMode = body.mode;
      
      // Update session mode
      await supabase
        .from('sessions')
        .update({ mode: currentMode })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      // Add transition message
      const transitionMessage = getModeTransitionMessage(previousMode, currentMode);
      if (transitionMessage) {
        await saveMessage(supabase, {
          sessionId,
          userId: user.id,
          role: 'assistant',
          content: transitionMessage,
          mode: currentMode,
        });
      }
    }

    // Save user message
    await saveMessage(supabase, {
      sessionId,
      userId: user.id,
      role: 'user',
      content: userMessage,
      mode: currentMode,
      riskAssessment,
    });

    // Log risk event if needed
    await logRiskEvent(supabase, {
      userId: user.id,
      sessionId,
      riskAssessment,
    });

    // ===========================================
    // Emergency Response (bypass LLM)
    // ===========================================
    if (riskAssessment.requiresEmergencyResponse && riskAssessment.emergencyResponse) {
      // Save emergency response
      await saveMessage(supabase, {
        sessionId,
        userId: user.id,
        role: 'assistant',
        content: riskAssessment.emergencyResponse,
        mode: currentMode,
        riskAssessment,
      });

      // Update session emergency flag
      await supabase
        .from('sessions')
        .update({ emergency_triggered: true })
        .eq('id', sessionId);

      const response: ChatResponse = {
        message: riskAssessment.emergencyResponse,
        sessionId,
        mode: currentMode,
        riskLevel: riskAssessment.riskLevel,
        isEmergencyResponse: true,
      };

      return buildJsonResponse(response, 200, corsHeaders);
    }

    // ===========================================
    // Normal Flow: Call LLM
    // ===========================================
    
    // Get session context
    const sessionContext = await getSessionContext(supabase, sessionId);
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      mode: currentMode,
      previousMessages: sessionContext.messages.length,
      sessionContext: sessionContext.summary,
    });

    // Build message history for LLM
    const llmMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...sessionContext.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    // Get LLM response
    const llmProviderName = getProviderFromEnv();
    const llmApiKey = getApiKeyForProvider(llmProviderName);
    const llmConfig = getDefaultConfig(llmApiKey, llmProviderName);

    // Structured output (JSON) for dump mode + Gemini - contrato obrigatório
    if (currentMode === 'dump' && llmProviderName === 'gemini') {
      llmConfig.responseSchema = GEMINI_RESPONSE_SCHEMA;
    }

    const llmProvider = getLLMProvider(llmProviderName);
    const llmResponse = await llmProvider.chat(llmMessages, llmConfig);

    // Sanitize and assemble: dump mode with structured output
    let assistantContent = llmResponse.content;
    if (currentMode === 'dump' && llmConfig.responseSchema) {
      try {
        const parsed = JSON.parse(llmResponse.content);
        const sanitized = sanitizeStructuredResponse(parsed);
        assistantContent = assembleMessage(sanitized);
      } catch {
        // Fallback se JSON inválido - trunca raw
        assistantContent = llmResponse.content.slice(0, 400).trim() || 'Entendi.';
      }
    }

    // Save assistant response
    await saveMessage(supabase, {
      sessionId,
      userId: user.id,
      role: 'assistant',
      content: assistantContent,
      mode: currentMode,
      tokensInput: llmResponse.tokensInput,
      tokensOutput: llmResponse.tokensOutput,
      modelUsed: llmResponse.model,
      responseTimeMs: llmResponse.responseTimeMs,
    });

    // Build response
    const response: ChatResponse = {
      message: assistantContent,
      sessionId,
      mode: currentMode,
      riskLevel: riskAssessment.riskLevel,
      isEmergencyResponse: false,
      tokensUsed: {
        input: llmResponse.tokensInput,
        output: llmResponse.tokensOutput,
      },
    };

    return buildJsonResponse(response, 200, corsHeaders);

  } catch (error) {
    console.error('Chat function error:', error);

    const errorMessage = sanitizeErrorMessage(error);
    return buildJsonResponse(
      {
        error: 'Internal server error',
        details: Deno.env.get('ENVIRONMENT') === 'development' ? errorMessage : undefined,
      },
      500,
      corsHeaders
    );
  }
});
