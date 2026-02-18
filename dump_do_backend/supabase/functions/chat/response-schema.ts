/**
 * Dump.do Structured Output Schema
 *
 * Contrato JSON obrigatório para produção.
 * Menos liberdade = mais estabilidade.
 *
 * - detected_emotions: max 2, enum fechado
 * - validation: maxLength enforced no backend
 * - question: opcional, cirúrgica (não obrigatória)
 */

export const EMOTION_ENUM = [
  'raiva',
  'tristeza',
  'ansiedade',
  'exaustão',
  'culpa',
  'frustração',
  'confusão',
  'esperança',
  'alívio',
  'incerto',
] as const;

export type Emotion = (typeof EMOTION_ENUM)[number];

export interface StructuredResponse {
  /** Validação empática em UMA frase. Max 200 chars. */
  validation: string;
  /** Pergunta cirúrgica - APENAS se a pessoa NÃO estiver clara. Opcional. */
  question?: string;
  /** Emoções detectadas. Máximo 2. Enum fechado. */
  detected_emotions?: Emotion[];
}

/** Limites enforceados no backend */
export const LIMITS = {
  VALIDATION_MAX_LENGTH: 200,
  QUESTION_MAX_LENGTH: 150,
  DETECTED_EMOTIONS_MAX: 2,
} as const;

/**
 * Schema Gemini (OpenAPI 3.0 format)
 * responseMimeType: application/json
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    validation: {
      type: 'string',
      description: 'Validação empática em UMA frase curta. Máximo 200 caracteres.',
      maxLength: LIMITS.VALIDATION_MAX_LENGTH,
    },
    question: {
      type: 'string',
      description: 'Pergunta clarificadora OPCIONAL. Só inclua se a pessoa NÃO estiver clara. Máximo 150 chars.',
      maxLength: LIMITS.QUESTION_MAX_LENGTH,
    },
    detected_emotions: {
      type: 'array',
      description: 'Até 2 emoções detectadas. Use apenas o enum.',
      items: {
        type: 'string',
        enum: [...EMOTION_ENUM],
      },
      maxItems: LIMITS.DETECTED_EMOTIONS_MAX,
    },
  },
  required: ['validation'],
} as const;
