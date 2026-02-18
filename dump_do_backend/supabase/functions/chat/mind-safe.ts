/**
 * MIND-SAFE: Sistema de Detecção de Crises do Dump.do
 * 
 * Intercepta mensagens ANTES do LLM para detectar indicadores de risco.
 * Implementa classificação leve via regex + keywords.
 * 
 * Risk Levels:
 * - none: Sem indicadores de risco
 * - low: Mencao leve de estresse/ansiedade
 * - medium: Sinais de sofrimento significativo
 * - high: Indicadores de crise que requerem atenção
 * - critical: Risco iminente - ativa modo de emergência
 */

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type RiskType = 
  | 'suicidal_ideation'
  | 'self_harm'
  | 'violence'
  | 'substance_crisis'
  | 'panic_attack'
  | 'severe_distress'
  | 'other';

export interface RiskAssessment {
  riskLevel: RiskLevel;
  riskType: RiskType | null;
  indicators: string[];
  confidenceScore: number;
  requiresEmergencyResponse: boolean;
  emergencyResponse?: string;
}

// ============================================
// Indicadores de Risco (PT-BR otimizado)
// ============================================

const CRITICAL_INDICATORS = {
  suicidal_ideation: [
    // Expressoes diretas
    /\b(quero|vou|penso em|pensando em)\s*(me\s*)?matar/i,
    /\b(quero|vou|preciso)\s*morrer/i,
    /\b(acabar|terminar)\s*(com\s*)?(tudo|minha vida)/i,
    /\bsuic[ií]d/i,
    /\btirar\s*(a\s*)?(minha\s*)?vida/i,
    /\bn[aã]o\s*(quero|aguento)\s*mais\s*viver/i,
    /\bmelhor\s*(sem\s*mim|se\s*eu\s*morresse)/i,
    /\bfardo\s*p(ara|ra)\s*(todos|todo\s*mundo)/i,
    /\bdesaparecer\s*(de\s*vez|para\s*sempre)/i,
    // Métodos
    /\b(pular|jogar)\s*(do|de)\s*(prédio|ponte|altura)/i,
    /\b(tomar|engolir)\s*(remédios|comprimidos|veneno)/i,
    /\bcortar\s*(os\s*)?(pulsos?|veias?)/i,
  ],
  self_harm: [
    /\b(me\s*)?machucar/i,
    /\b(me\s*)?cortar/i,
    /\b(me\s*)?mutilar/i,
    /\bautomutilar/i,
    /\bauto-?les[aã]o/i,
    /\bqueimar\s*(a\s*)?pele/i,
    /\bbater\s*(em\s*mim|na\s*parede)/i,
    /\bsentir\s*dor\s*(f[ií]sica)?\s*(me\s*)?(ajuda|acalma)/i,
  ],
  violence: [
    /\b(quero|vou)\s*(matar|machucar)\s*(ele|ela|algu[eé]m)/i,
    /\bfazer\s*(ele|ela)\s*pagar/i,
    /\bvou\s*explodir/i,
    /\bvingar/i,
    /\barma\s*(de\s*fogo)?/i,
    /\bviolencia\s*contra/i,
  ],
  substance_crisis: [
    /\b(usei|usando|cheirei|injetei)\s*(muita|demais)/i,
    /\boverdose/i,
    /\bn[aã]o\s*consigo\s*parar\s*(de\s*)?(usar|beber)/i,
    /\babstinencia\s*(pesada|grave|forte)/i,
    /\btremendo\s*(muito|demais)/i,
    /\bconvuls/i,
    /\bvou\s*(usar|beber)\s*at[eé]\s*(morrer|apagar)/i,
  ],
};

const HIGH_INDICATORS = {
  panic_attack: [
    /\b(estou|to)\s*(tendo|no\s*meio)\s*(de\s*)?(um\s*)?ataque\s*(de\s*)?p[aâ]nico/i,
    /\bn[aã]o\s*consigo\s*respirar/i,
    /\bvou\s*(morrer|enfartar|ter\s*um\s*infarto)/i,
    /\bcora[cç][aã]o\s*(disparado|acelerado|saindo)/i,
    /\btremendo\s*(muito|inteiro)/i,
    /\bperdendo\s*(o\s*)?controle/i,
  ],
  severe_distress: [
    /\bn[aã]o\s*aguento\s*mais/i,
    /\bcheguei\s*(no|ao)\s*(meu\s*)?limite/i,
    /\bestou\s*(desesperado|no\s*fundo\s*do\s*po[cç]o)/i,
    // "não sei o que fazer" fora daqui: no dump é sobrecarga comum, não dispara emergência sozinho
    /\bpreciso\s*(de\s*)?ajuda\s*(urgente|agora)/i,
    /\bn[aã]o\s*vejo\s*sa[ií]da/i,
    /\btudo\s*(est[aá]|parece)\s*(perdido|sem\s*sentido)/i,
  ],
};

const MEDIUM_INDICATORS = [
  /\bn[aã]o\s*sei\s*(mais\s*)?o\s*que\s*fazer/i, // sobrecarga comum no dump; não dispara emergência
  /\b(muito|extremamente)\s*(ansios|triste|angustiad|deprimid)/i,
  /\bn[aã]o\s*(durmo|como|saio)\s*(h[aá]|faz)\s*(dias|semanas)/i,
  /\b(pensamentos|ideias)\s*(ruins|negativ|sombri)/i,
  /\bn[aã]o\s*consigo\s*funcionar/i,
  /\b(chorando|chorei)\s*(o\s*dia\s*todo|sem\s*parar)/i,
  /\bme\s*isol(ei|ando)/i,
];

const LOW_INDICATORS = [
  /\b(estou|to|me\s*sinto)\s*(estressad|cansad|esgotad|sobrecarregad)/i,
  /\bdia\s*(dif[ií]cil|pesado|ruim)/i,
  /\bn[aã]o\s*estou\s*bem/i,
  /\bpreciso\s*desabafar/i,
  /\bmuita\s*(press[aã]o|cobran[cç]a)/i,
];

// ============================================
// Funções de Detecção
// ============================================

function checkPatterns(
  text: string, 
  patterns: RegExp[]
): { matched: boolean; matches: string[] } {
  const matches: string[] = [];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }
  
  return {
    matched: matches.length > 0,
    matches,
  };
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos para matching
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// Respostas de Emergência
// ============================================

const EMERGENCY_RESPONSES: Record<RiskType, string> = {
  suicidal_ideation: `🚨 **Estou aqui com você.**

O que você está sentindo é real e muito difícil. Você não precisa passar por isso sozinho(a).

**Agora, por favor:**
1. 📞 **Ligue para o CVV: 188** (24h, gratuito, sigiloso)
2. Ou acesse **cvv.org.br** para chat
3. Se estiver em perigo imediato, ligue **192 (SAMU)**

Enquanto isso, vamos fazer algo juntos:
- Coloque os dois pés no chão
- Respire fundo: 4 segundos inspirando, 7 segurando, 8 soltando
- Olhe ao redor e me diga 3 coisas que você consegue ver

Estou aqui. Você não está sozinho(a).`,

  self_harm: `🚨 **Ei, estou aqui.**

Você merece cuidado, não dor. O que você está sentindo é válido.

**Vamos fazer uma pausa juntos:**
1. Se tiver algo que possa te machucar por perto, pode se afastar dele?
2. Coloque as mãos em água fria ou segure um gelo - isso pode ajudar a aliviar a tensão
3. Respire comigo: inspira... segura... solta...

**Se precisar conversar agora:**
📞 **CVV: 188** (24h, gratuito, sigiloso)

Me conta: onde você está agora? Está em um lugar seguro?`,

  violence: `🚨 **Vamos pausar um segundo.**

O que você está sentindo é intenso. Raiva assim queima por dentro.

**Antes de qualquer coisa:**
1. Se afaste da situação/pessoa, se possível
2. Faça 10 respirações profundas, bem lentas
3. Aperte forte uma almofada ou toalha

**Se você ou alguém está em perigo:**
📞 **190 (Polícia)** ou **192 (SAMU)**

**Para conversar:**
📞 **CVV: 188** (24h, gratuito)

Me conta: o que aconteceu pra você chegar nesse ponto?`,

  substance_crisis: `🚨 **Estou preocupado(a) com você.**

**Se você usou algo e está se sentindo mal:**
📞 **SAMU: 192** - agora mesmo

**Se está em crise de abstinência ou precisa de ajuda:**
1. Não fique sozinho(a)
2. Beba água
3. Sente ou deite em lugar seguro

**Para conversar:**
📞 **CVV: 188** (24h, gratuito)
📞 **CAPS AD** da sua cidade

Me conta: como você está fisicamente agora? Consegue descrever?`,

  panic_attack: `🚨 **Ei, estou aqui. Isso vai passar.**

Eu sei que parece que não, mas vai. Vamos fazer isso juntos.

**Agora mesmo:**
1. **Pés no chão** - sinta o chão te segurando
2. **Respira comigo:**
   - Inspira contando 1... 2... 3... 4...
   - Segura 1... 2... 3... 4...
   - Solta 1... 2... 3... 4... 5... 6...
3. **5 coisas:** Me diz 5 coisas que você consegue ver ao seu redor

Você não está morrendo. É o seu corpo reagindo. E vai passar.

Continua respirando comigo. Estou aqui.`,

  severe_distress: `🚨 **Eu te escuto. Está muito pesado.**

Você não precisa resolver nada agora. Só precisa passar esse momento.

**Vamos fazer uma coisa de cada vez:**
1. Onde você está? Sente em algum lugar.
2. Coloca a mão no peito. Sinta seu coração.
3. Respira fundo 3 vezes.

**Se precisar de alguém agora:**
📞 **CVV: 188** (24h, gratuito, sigiloso)

Você chegou até aqui. Isso já é muito.
Me conta mais sobre o que está acontecendo.`,

  other: `🚨 **Estou aqui com você.**

Parece que você está passando por algo muito difícil.

**Se precisar de ajuda imediata:**
📞 **CVV: 188** (24h, gratuito, sigiloso)
📞 **SAMU: 192** (emergências médicas)

**Vamos respirar juntos:**
- Inspira... segura... solta...
- De novo: inspira... segura... solta...

Me conta o que está acontecendo. Estou ouvindo.`,
};

// ============================================
// Função Principal de Assessment
// ============================================

export function assessRisk(message: string): RiskAssessment {
  const normalizedText = normalizeText(message);
  const originalText = message.toLowerCase();
  const allIndicators: string[] = [];
  let maxRiskLevel: RiskLevel = 'none';
  let detectedRiskType: RiskType | null = null;
  let confidenceScore = 0;

  // Check CRITICAL indicators first
  for (const [riskType, patterns] of Object.entries(CRITICAL_INDICATORS)) {
    const result = checkPatterns(normalizedText, patterns);
    const resultOriginal = checkPatterns(originalText, patterns);
    
    if (result.matched || resultOriginal.matched) {
      maxRiskLevel = 'critical';
      detectedRiskType = riskType as RiskType;
      allIndicators.push(...result.matches, ...resultOriginal.matches);
      confidenceScore = Math.min(0.7 + (allIndicators.length * 0.1), 0.95);
      break;
    }
  }

  // Check HIGH indicators if not critical
  if (maxRiskLevel !== 'critical') {
    for (const [riskType, patterns] of Object.entries(HIGH_INDICATORS)) {
      const result = checkPatterns(normalizedText, patterns);
      const resultOriginal = checkPatterns(originalText, patterns);
      
      if (result.matched || resultOriginal.matched) {
        maxRiskLevel = 'high';
        detectedRiskType = riskType as RiskType;
        allIndicators.push(...result.matches, ...resultOriginal.matches);
        confidenceScore = Math.min(0.6 + (allIndicators.length * 0.1), 0.85);
        break;
      }
    }
  }

  // Check MEDIUM indicators if not high/critical
  if (maxRiskLevel === 'none') {
    const result = checkPatterns(normalizedText, MEDIUM_INDICATORS);
    const resultOriginal = checkPatterns(originalText, MEDIUM_INDICATORS);
    
    if (result.matched || resultOriginal.matched) {
      maxRiskLevel = 'medium';
      detectedRiskType = 'severe_distress';
      allIndicators.push(...result.matches, ...resultOriginal.matches);
      confidenceScore = Math.min(0.5 + (allIndicators.length * 0.1), 0.75);
    }
  }

  // Check LOW indicators if none found
  if (maxRiskLevel === 'none') {
    const result = checkPatterns(normalizedText, LOW_INDICATORS);
    const resultOriginal = checkPatterns(originalText, LOW_INDICATORS);
    
    if (result.matched || resultOriginal.matched) {
      maxRiskLevel = 'low';
      allIndicators.push(...result.matches, ...resultOriginal.matches);
      confidenceScore = Math.min(0.4 + (allIndicators.length * 0.1), 0.6);
    }
  }

  // Deduplicate indicators
  const uniqueIndicators = [...new Set(allIndicators)];

  // Determine if emergency response is needed
  const requiresEmergencyResponse = maxRiskLevel === 'critical' || maxRiskLevel === 'high';

  return {
    riskLevel: maxRiskLevel,
    riskType: detectedRiskType,
    indicators: uniqueIndicators,
    confidenceScore,
    requiresEmergencyResponse,
    emergencyResponse: requiresEmergencyResponse && detectedRiskType 
      ? EMERGENCY_RESPONSES[detectedRiskType] 
      : undefined,
  };
}

// ============================================
// Helper para logging
// ============================================

export function getRiskEventData(
  assessment: RiskAssessment,
  sessionDurationMinutes?: number,
  messageCount?: number
) {
  const now = new Date();
  const hour = now.getHours();
  
  let timeOfDay: string;
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
  else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
  else timeOfDay = 'night';

  return {
    risk_level: assessment.riskLevel,
    risk_type: assessment.riskType || 'other',
    detected_indicators: assessment.indicators,
    confidence_score: assessment.confidenceScore,
    detection_method: 'regex',
    emergency_response_sent: assessment.requiresEmergencyResponse,
    response_type: assessment.requiresEmergencyResponse 
      ? (assessment.riskType === 'suicidal_ideation' ? 'cvv_referral' : 'grounding_exercise')
      : null,
    session_duration_minutes: sessionDurationMinutes,
    message_count_at_event: messageCount,
    time_of_day: timeOfDay,
    day_of_week: now.getDay(),
  };
}
