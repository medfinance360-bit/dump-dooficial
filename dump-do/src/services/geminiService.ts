// src/services/geminiService.ts
// Gemini API wrapper with structured outputs support
// FIX: Added timeout, retry with exponential backoff, rate limiting, better error handling

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.warn('⚠️ VITE_GEMINI_API_KEY not found. Gemini features will not work.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ========================================
// Configuration
// ========================================

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

// ========================================
// Types
// ========================================

type StructuredOutputSchema = Schema;

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface RateLimitState {
  timestamps: number[];
}

// ========================================
// Rate Limiter
// ========================================

const rateLimitState: RateLimitState = {
  timestamps: []
};

function checkRateLimit(): boolean {
  const now = Date.now();
  // Remove timestamps outside the window
  rateLimitState.timestamps = rateLimitState.timestamps.filter(
    ts => now - ts < RATE_LIMIT_WINDOW_MS
  );
  
  if (rateLimitState.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limited
  }
  
  rateLimitState.timestamps.push(now);
  return true;
}

function getTimeUntilRateLimitReset(): number {
  if (rateLimitState.timestamps.length === 0) return 0;
  const oldestTimestamp = Math.min(...rateLimitState.timestamps);
  return Math.max(0, RATE_LIMIT_WINDOW_MS - (Date.now() - oldestTimestamp));
}

// ========================================
// Error Classes
// ========================================

export class GeminiError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(message: string, code: string, retryable: boolean = false) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.retryable = retryable;
  }
}

export class GeminiTimeoutError extends GeminiError {
  constructor(timeoutMs: number) {
    super(`Requisição expirou após ${timeoutMs}ms`, 'TIMEOUT', true);
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiRateLimitError extends GeminiError {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(
      `Rate limit excedido. Tente novamente em ${Math.ceil(retryAfterMs / 1000)} segundos.`,
      'RATE_LIMIT',
      true
    );
    this.name = 'GeminiRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

// ========================================
// Utility Functions
// ========================================

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number): number {
  const baseDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * baseDelay; // Add 0-30% jitter
  return Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Create a promise that rejects after a timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abortController: AbortController
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new GeminiTimeoutError(timeoutMs));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Parse error from Gemini API response
 */
function parseGeminiError(error: unknown): GeminiError {
  const message = error instanceof Error ? error.message : String(error);
  
  if (message.includes('API_KEY')) {
    return new GeminiError(
      'Gemini API key inválida. Verifique VITE_GEMINI_API_KEY no .cal',
      'INVALID_API_KEY',
      false
    );
  }
  
  if (message.includes('quota') || message.includes('429')) {
    return new GeminiError(
      'Quota da API Gemini excedida. Tente novamente em alguns minutos.',
      'QUOTA_EXCEEDED',
      true
    );
  }
  
  if (message.includes('safety')) {
    return new GeminiError(
      'Conteúdo bloqueado por filtros de segurança do Gemini.',
      'SAFETY_BLOCKED',
      false
    );
  }

  if (message.includes('RESOURCE_EXHAUSTED')) {
    return new GeminiError(
      'Recursos da API esgotados. Tente novamente em breve.',
      'RESOURCE_EXHAUSTED',
      true
    );
  }

  if (message.includes('UNAVAILABLE') || message.includes('503')) {
    return new GeminiError(
      'Serviço Gemini temporariamente indisponível.',
      'SERVICE_UNAVAILABLE',
      true
    );
  }
  
  return new GeminiError(
    `Erro na API Gemini: ${message}`,
    'UNKNOWN',
    false
  );
}

// ========================================
// Core API Functions
// ========================================

/**
 * Generate structured JSON output using Gemini with retry and timeout
 * Uses gemini-2.0-flash-exp for best performance
 */
export async function generateStructuredOutput<T = unknown>(
  systemPrompt: string,
  userInput: string,
  schema: StructuredOutputSchema,
  options?: GenerateOptions
): Promise<T> {
  if (!genAI) {
    throw new GeminiError(
      'Gemini API not configured. Please set VITE_GEMINI_API_KEY in .cal',
      'NOT_CONFIGURED',
      false
    );
  }

  // Check rate limit
  if (!checkRateLimit()) {
    throw new GeminiRateLimitError(getTimeUntilRateLimitReset());
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const abortController = new AbortController();

    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: options?.maxTokens ?? 8192,
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });

      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          },
          {
            role: 'model',
            parts: [{ text: 'Entendido. Estou pronto para processar conforme as instruções.' }]
          }
        ]
      });

      const resultPromise = chat.sendMessage(userInput);
      const result = await withTimeout(resultPromise, timeoutMs, abortController);
      const response = result.response;
      const text = response.text();

      // Parse JSON response
      try {
        return JSON.parse(text) as T;
      } catch {
        // Try to extract JSON from markdown fences
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]) as T;
        }
        
        // Try to parse as-is one more time
        return JSON.parse(text) as T;
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on non-retryable errors
      const geminiError = error instanceof GeminiError ? error : parseGeminiError(error);
      if (!geminiError.retryable) {
        throw geminiError;
      }

      // Don't retry on last attempt
      if (attempt === MAX_RETRIES - 1) {
        throw geminiError;
      }

      // Wait before retrying with exponential backoff
      const delay = calculateBackoffDelay(attempt);
      console.warn(`Gemini API error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms:`, lastError.message);
      await sleep(delay);
    }
  }

  throw lastError || new GeminiError('Erro desconhecido', 'UNKNOWN', false);
}

/**
 * Generate title for a dump (max 3 words)
 */
export async function generateTitle(content: string): Promise<string> {
  if (!genAI) {
    return 'Sem título';
  }

  try {
    const response = await generateStructuredOutput<{ title: string }>(
      'Gere um título de no máximo 3 palavras que resuma o conteúdo emocional principal.',
      content,
      {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING }
        },
        required: ['title']
      },
      { timeoutMs: 10000 } // Shorter timeout for simple task
    );

    return response.title;
  } catch (error) {
    console.error('Title generation failed:', error);
    return 'Dump';
  }
}

/**
 * Simple text generation (fallback for non-structured outputs)
 */
export async function generateText(
  systemPrompt: string,
  userInput: string,
  options?: GenerateOptions
): Promise<string> {
  if (!genAI) {
    throw new GeminiError('Gemini API not configured', 'NOT_CONFIGURED', false);
  }

  // Check rate limit
  if (!checkRateLimit()) {
    throw new GeminiRateLimitError(getTimeUntilRateLimitReset());
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const abortController = new AbortController();

    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 2048
        }
      });

      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          },
          {
            role: 'model',
            parts: [{ text: 'Entendido.' }]
          }
        ]
      });

      const resultPromise = chat.sendMessage(userInput);
      const result = await withTimeout(resultPromise, timeoutMs, abortController);
      return result.response.text();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      const geminiError = error instanceof GeminiError ? error : parseGeminiError(error);
      if (!geminiError.retryable || attempt === MAX_RETRIES - 1) {
        throw geminiError;
      }

      const delay = calculateBackoffDelay(attempt);
      console.warn(`Gemini API error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms:`, lastError.message);
      await sleep(delay);
    }
  }

  throw lastError || new GeminiError('Erro desconhecido', 'UNKNOWN', false);
}

// ========================================
// Export
// ========================================

export const gemini = {
  generateStructuredOutput,
  generateTitle,
  generateText,
  GeminiError,
  GeminiTimeoutError,
  GeminiRateLimitError
};
