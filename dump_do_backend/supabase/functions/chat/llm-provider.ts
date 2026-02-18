/**
 * LLM Provider Abstraction - Dump.do
 * 
 * Abstrai a integração com diferentes LLMs para facilitar troca.
 * Default: Gemini 2.5 Flash
 * Preparado para: GPT-4o, Claude 3.5 Sonnet
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
  responseTimeMs: number;
}

export interface LLMConfig {
  provider: 'gemini' | 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
  /** When set, Gemini returns JSON matching this schema (OpenAPI 3.0) */
  responseSchema?: Record<string, unknown>;
}

// ============================================
// Provider Interface
// ============================================

export interface LLMProvider {
  chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse>;
}

// ============================================
// Gemini Provider (Default)
// ============================================

class GeminiProvider implements LLMProvider {
  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Separate system message from conversation
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    // Convert to Gemini format
    const contents = conversationMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: config.maxTokens || 1024,
      temperature: config.temperature || 0.7,
      topP: 0.95,
      topK: 40,
    };

    if (config.responseSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = config.responseSchema;
    }

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig,
    };

    // Add system instruction if present
    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }]
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const responseTimeMs = Date.now() - startTime;

    // Extract content and usage
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    
    // Gemini usage metadata
    const usageMetadata = data.usageMetadata || {};
    
    return {
      content,
      tokensInput: usageMetadata.promptTokenCount || 0,
      tokensOutput: usageMetadata.candidatesTokenCount || 0,
      model: config.model,
      responseTimeMs,
    };
  }
}

// ============================================
// OpenAI Provider (GPT-4o ready)
// ============================================

class OpenAIProvider implements LLMProvider {
  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: config.maxTokens || 1024,
        temperature: config.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const responseTimeMs = Date.now() - startTime;

    return {
      content: data.choices[0]?.message?.content || '',
      tokensInput: data.usage?.prompt_tokens || 0,
      tokensOutput: data.usage?.completion_tokens || 0,
      model: config.model,
      responseTimeMs,
    };
  }
}

// ============================================
// Anthropic Provider (Claude ready)
// ============================================

class AnthropicProvider implements LLMProvider {
  async chat(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Separate system from messages for Claude
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const requestBody: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens || 1024,
      messages: conversationMessages,
    };

    if (systemMessage) {
      requestBody.system = systemMessage.content;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const responseTimeMs = Date.now() - startTime;

    return {
      content: data.content[0]?.text || '',
      tokensInput: data.usage?.input_tokens || 0,
      tokensOutput: data.usage?.output_tokens || 0,
      model: config.model,
      responseTimeMs,
    };
  }
}

// ============================================
// Provider Factory
// ============================================

const providers: Record<string, LLMProvider> = {
  gemini: new GeminiProvider(),
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
};

export function getLLMProvider(providerName: 'gemini' | 'openai' | 'anthropic'): LLMProvider {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unknown LLM provider: ${providerName}`);
  }
  return provider;
}

// ============================================
// Default Config Factory
// ============================================

export function getDefaultConfig(apiKey: string, provider: 'gemini' | 'openai' | 'anthropic' = 'gemini'): LLMConfig {
  const configs: Record<string, Omit<LLMConfig, 'apiKey'>> = {
    gemini: {
      provider: 'gemini',
      model: 'gemini-2.5-flash-preview-05-20',
      maxTokens: 1024,
      temperature: 0.7,
    },
    openai: {
      provider: 'openai',
      model: 'gpt-4o',
      maxTokens: 1024,
      temperature: 0.7,
    },
    anthropic: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1024,
      temperature: 0.7,
    },
  };

  return {
    ...configs[provider],
    apiKey,
  };
}
