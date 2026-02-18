/**
 * Sanitização de resposta do modelo - produção
 *
 * - Trunca validation/question ao maxLength
 * - Corta múltiplas interrogações (mantém apenas 1)
 * - Filtra detected_emotions para enum + max 2
 */

import type { StructuredResponse, Emotion } from './response-schema.ts';
import { LIMITS, EMOTION_ENUM } from './response-schema.ts';

const EMOTION_SET = new Set<string>(EMOTION_ENUM);

function truncateToLength(str: string, max: number): string {
  if (str.length <= max) return str;
  const truncated = str.slice(0, max).trim();
  // Evita cortar no meio de palavra
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > max * 0.7) {
    return truncated.slice(0, lastSpace);
  }
  return truncated;
}

/** Remove múltiplas interrogações - mantém só a primeira frase com ? */
function cutMultipleQuestions(text: string): string {
  const firstQ = text.indexOf('?');
  if (firstQ === -1) return text;
  return text.slice(0, firstQ + 1).trim();
}

function sanitizeEmotions(emotions: unknown): Emotion[] {
  if (!Array.isArray(emotions)) return [];
  return emotions
    .filter((e): e is Emotion => typeof e === 'string' && EMOTION_SET.has(e))
    .slice(0, LIMITS.DETECTED_EMOTIONS_MAX);
}

/**
 * Sanitiza resposta estruturada antes de montar mensagem final
 */
export function sanitizeStructuredResponse(raw: unknown): StructuredResponse {
  const obj = raw as Record<string, unknown>;

  let validation = typeof obj?.validation === 'string' ? obj.validation : '';
  validation = truncateToLength(validation, LIMITS.VALIDATION_MAX_LENGTH) || 'Entendi.';

  let question: string | undefined;
  if (typeof obj?.question === 'string' && obj.question.trim()) {
    question = truncateToLength(obj.question.trim(), LIMITS.QUESTION_MAX_LENGTH);
    question = cutMultipleQuestions(question);
  }

  const detected_emotions = sanitizeEmotions(obj?.detected_emotions);

  return {
    validation,
    ...(question && { question }),
    ...(detected_emotions.length > 0 && { detected_emotions }),
  };
}

/**
 * Monta mensagem final para o usuário a partir da resposta sanitizada
 */
export function assembleMessage(response: StructuredResponse): string {
  const parts: string[] = [response.validation];
  if (response.question?.trim()) {
    parts.push(response.question);
  }
  return parts.join(' ');
}
