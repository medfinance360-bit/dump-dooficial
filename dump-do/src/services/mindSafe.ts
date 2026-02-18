// src/services/mindSafe.ts
// MIND-SAFE: Pre-LLM crisis detection system (Brazilian Portuguese)
// Detects mental health crises BEFORE sending to LLM

// Re-export types for external use
export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  riskLevel: RiskLevel;
  riskType: string | null;
  indicators: string[];
  confidenceScore: number;
  requiresEmergencyResponse: boolean;
  emergencyResponse?: string;
}

export interface RiskPattern {
  pattern: RegExp;
  type: string;
  severity: Exclude<RiskLevel, 'none'>;
  confidence: number;
}

// FIX: Store pattern sources instead of RegExp with 'g' flag
// This avoids the lastIndex bug that causes false negatives
interface RiskPatternSource {
  source: string;
  flags: string;
  type: string;
  severity: Exclude<RiskLevel, 'none'>;
  confidence: number;
}

// Exclusion patterns to prevent false positives
const EXCLUSION_PATTERNS: RegExp[] = [
  /morrer de (rir|vontade|vergonha|medo|fome|sede|calor|frio|sono|tédio|curiosidade)/i,
  /matar (a )?saudade/i,
  /matar (a )?fome/i,
  /matar (o )?tempo/i,
  /matar (a )?vontade/i,
  /me matando de (rir|trabalhar|estudar)/i,
  /estou morrendo de (rir|vontade|vergonha)/i,
  /isso me mata de (rir|vergonha)/i,
  /matei (a )?aula/i,
  /sangue (doce|frio|quente|bom)/i,
  /sangue nos olhos/i, // determinação
  /cortar (o )?cabelo/i,
  /cortar (o )?mal pela raiz/i,
  /cortar (o )?barato/i,
  /cortar relações/i,
];

// Crisis detection patterns (Brazilian Portuguese)
// Stored as sources to create fresh RegExp instances for each test
const RISK_PATTERN_SOURCES: RiskPatternSource[] = [
  // ========================================
  // CRITICAL - Suicidal Ideation
  // ========================================
  { source: '\\b(quero morrer|vou me matar|quero suicid|penso em suicid)\\b', flags: 'gi', type: 'suicidal_ideation', severity: 'critical', confidence: 0.95 },
  { source: '\\b(acabar com (a )?minha vida|tirar minha vida|não quero mais viver)\\b', flags: 'gi', type: 'suicidal_ideation', severity: 'critical', confidence: 0.9 },
  { source: '\\b(melhor morto|mundo sem mim|todos estariam melhor sem mim)\\b', flags: 'gi', type: 'suicidal_ideation', severity: 'critical', confidence: 0.85 },
  { source: '\\b(plano (de|pra) me matar|como me matar|jeitos de suicid)\\b', flags: 'gi', type: 'suicidal_ideation', severity: 'critical', confidence: 0.95 },
  { source: '\\b(adeus|despedida|última vez|não aguento mais viver)\\b', flags: 'gi', type: 'suicidal_ideation', severity: 'high', confidence: 0.7 },
  { source: '\\b(vou pular|vou me jogar|tomar (todos os )?remédios)\\b', flags: 'gi', type: 'suicidal_ideation', severity: 'critical', confidence: 0.9 },
  { source: '\\b(carta de suicídio|testamento|quero acabar com isso)\\b', flags: 'gi', type: 'suicidal_ideation', severity: 'critical', confidence: 0.85 },

  // ========================================
  // CRITICAL - Self-Harm
  // ========================================
  { source: '\\b(me cortar|me machucar|me ferir|fazer cortes)\\b', flags: 'gi', type: 'self_harm', severity: 'high', confidence: 0.85 },
  { source: '\\b(lamina|gilete|faca) (na|no) (pulso|braço|corpo)\\b', flags: 'gi', type: 'self_harm', severity: 'critical', confidence: 0.9 },
  { source: '\\b(sangue|sangrar|cortes no corpo|marcas no braço)\\b', flags: 'gi', type: 'self_harm', severity: 'high', confidence: 0.75 },
  { source: '\\b(automutilação|me mutilar|queimar (a|minha) pele)\\b', flags: 'gi', type: 'self_harm', severity: 'critical', confidence: 0.9 },

  // ========================================
  // CRITICAL - Violence Ideation
  // ========================================
  { source: '\\b(matar (ele|ela|alguém)|vou matar|fazer um massacre)\\b', flags: 'gi', type: 'violence', severity: 'critical', confidence: 0.95 },
  { source: '\\b(arma|revólver|faca) (pra|para) (matar|acabar com)\\b', flags: 'gi', type: 'violence', severity: 'critical', confidence: 0.9 },
  { source: '\\b(explodir|bomba|ataque|vingança violenta)\\b', flags: 'gi', type: 'violence', severity: 'high', confidence: 0.8 },

  // ========================================
  // HIGH - Substance Crisis
  // ========================================
  { source: '\\b(overdose|tomar tudo|misturar (remédios|drogas|álcool))\\b', flags: 'gi', type: 'substance_crisis', severity: 'high', confidence: 0.85 },
  { source: '\\b(cheirar|usar (crack|cocaína|heroína)|injetar)\\b', flags: 'gi', type: 'substance_crisis', severity: 'high', confidence: 0.8 },
  { source: '\\b(beber até (morrer|apagar|desmaiar))\\b', flags: 'gi', type: 'substance_crisis', severity: 'high', confidence: 0.75 },

  // ========================================
  // HIGH - Panic Attack / Severe Distress
  // ========================================
  { source: '\\b(não consigo respirar|falta de ar|coração acelerado|vou morrer agora)\\b', flags: 'gi', type: 'panic_attack', severity: 'high', confidence: 0.8 },
  { source: '\\b(ataque de pânico|crise de ansiedade|desmaiar|tudo girando)\\b', flags: 'gi', type: 'panic_attack', severity: 'high', confidence: 0.85 },
  { source: '\\b(peito apertado|suando frio|tremendo (muito|sem parar))\\b', flags: 'gi', type: 'panic_attack', severity: 'medium', confidence: 0.7 },
  { source: '\\b(vou enlouquecer|perdendo o controle|surtando)\\b', flags: 'gi', type: 'severe_distress', severity: 'high', confidence: 0.75 },

  // ========================================
  // MEDIUM - Distress Signals
  // ========================================
  { source: '\\b(não aguento mais|exausto|esgotado|fim da linha)\\b', flags: 'gi', type: 'severe_distress', severity: 'medium', confidence: 0.6 },
  { source: '\\b(sozinho|ninguém me entende|isolado|abandonado)\\b', flags: 'gi', type: 'severe_distress', severity: 'medium', confidence: 0.5 },
];

// Emergency responses per risk type
const EMERGENCY_RESPONSES: Record<string, string> = {
  suicidal_ideation: `🆘 **EMERGÊNCIA DETECTADA**

Você mencionou pensamentos sobre tirar sua vida. Isso é muito sério e você não está sozinho.

**AJUDA IMEDIATA DISPONÍVEL:**

📞 **CVV - Centro de Valorização da Vida**
- Ligue: **188** (24h, gratuito, confidencial)
- Chat: https://cvv.org.br
- WhatsApp: (11) 93107-3141

🚨 **SAMU (Emergência Médica):** 192

💙 **CAPS (Centro de Atenção Psicossocial)**
- Atendimento especializado gratuito
- Encontre o mais próximo: https://bvsms.saude.gov.br/bvs/folder/centro_atencao_psicossocial_caps.pdf

**AGORA, ENQUANTO ESPERA:**
1. Se estiver em perigo imediato, ligue 192 (SAMU)
2. Avise alguém próximo de você
3. Afaste-se de meios letais (medicações, objetos cortantes)
4. Respire: inspire 4s → segure 4s → expire 6s

Você está passando por uma crise, mas crises passam. Há ajuda disponível.`,

  self_harm: `🆘 **ALERTA: AUTOLESÃO DETECTADA**

Você mencionou pensamentos de se machucar. Isso indica sofrimento intenso.

**AJUDA DISPONÍVEL:**

📞 **CVV:** 188 (24h, gratuito)
- Eles entendem e não julgam

🩺 **Atendimento Médico:**
- SAMU: 192 (se já se machucou)
- CAPS: Atendimento psicológico gratuito

**TÉCNICA IMEDIATA (Ice Dive):**
1. Pegue gelo ou água gelada
2. Segure nas mãos ou passe no rosto
3. Respire profundamente
4. A sensação intensa substitui o impulso de cortar

O impulso de autolesão é real, mas há formas mais seguras de processar a dor emocional.`,

  violence: `🚨 **PENSAMENTOS DE VIOLÊNCIA DETECTADOS**

Você mencionou pensamentos de machucar alguém. É importante buscar ajuda.

**CONTATOS URGENTES:**

📞 **CVV:** 188 (24h)
🩺 **CAPS:** Atendimento psiquiátrico
🚨 **Emergência:** 190 (se houver risco iminente)

**AGORA:**
1. Afaste-se da situação/pessoa
2. Respire fundo (inspire 4s, expire 6s)
3. Ligue para o CVV (188) AGORA

Pensamentos violentos não fazem de você uma má pessoa, mas agir sobre eles teria consequências irreversíveis.`,

  panic_attack: `💙 **CRISE DE PÂNICO DETECTADA**

Você está descrevendo sintomas de ataque de pânico. É assustador, mas NÃO é perigoso.

**TÉCNICA 4-7-8 (FAÇA AGORA):**
1. Inspire pelo nariz por 4 segundos
2. Segure a respiração por 7 segundos
3. Expire pela boca por 8 segundos
4. Repita 4 vezes

**GROUNDING 5-4-3-2-1:**
- 5 coisas que você VÊ
- 4 coisas que você TOCA
- 3 coisas que você OUVE
- 2 coisas que você CHEIRA
- 1 coisa que você SABOREIA

📞 **Se não melhorar em 10 min:**
- CVV: 188
- SAMU: 192 (se sintomas físicos intensos)

Você NÃO está morrendo. Seu corpo está em modo de luta/fuga. Vai passar.`,

  substance_crisis: `⚠️ **USO DE SUBSTÂNCIAS - RISCO DETECTADO**

Você mencionou uso problemático de substâncias.

**AJUDA ESPECIALIZADA:**

☎️ **CAPS-AD (Álcool e Drogas):**
- Atendimento gratuito especializado
- Não é necessário parar de usar para buscar ajuda

📞 **CVV:** 188 (24h, confidencial)

🚨 **EMERGÊNCIA (overdose):**
- SAMU: 192 IMEDIATAMENTE

**REDUÇÃO DE DANOS:**
- Não misture substâncias
- Não use sozinho
- Tenha água e comida próximos

Usar substâncias não faz de você uma pessoa ruim. É uma forma de lidar com a dor. Há outros caminhos.`,

  severe_distress: `💙 **SOFRIMENTO INTENSO DETECTADO**

Você está passando por um momento muito difícil.

**APOIO DISPONÍVEL:**

📞 **CVV:** 188 (24h, gratuito)
- Apenas para conversar, sem julgamento

🩺 **CAPS:** Atendimento psicológico gratuito
- Encontre o mais próximo: busque "CAPS" + sua cidade

**TÉCNICA DE ALÍVIO IMEDIATO:**
1. Coloque a mão no peito
2. Respire fundo e devagar
3. Diga em voz alta: "Isso vai passar"
4. Repita 5 vezes

Crises são intensas, mas temporárias. Você consegue atravessar isso.`
};

/**
 * Normalize text for pattern matching
 * - Converts to lowercase
 * - Removes extra whitespace
 * - Normalizes accents (keeps them but normalizes Unicode)
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFC') // Normalize Unicode
    .toLowerCase()
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Check if message matches any exclusion pattern (false positive prevention)
 */
function matchesExclusion(message: string): boolean {
  const normalized = normalizeText(message);
  return EXCLUSION_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Assess risk level based on message content
 * Returns risk assessment with emergency response if needed
 */
export function assessRisk(message: string): RiskAssessment {
  // Input validation
  if (!message || typeof message !== 'string') {
    return {
      riskLevel: 'none',
      riskType: null,
      indicators: [],
      confidenceScore: 0,
      requiresEmergencyResponse: false
    };
  }

  const normalizedMessage = normalizeText(message);
  
  // Check if message matches exclusion patterns (false positive prevention)
  if (matchesExclusion(normalizedMessage)) {
    return {
      riskLevel: 'none',
      riskType: null,
      indicators: ['exclusion_match'],
      confidenceScore: 0,
      requiresEmergencyResponse: false
    };
  }

  const detectedPatterns: string[] = [];
  let highestSeverity: RiskLevel = 'none';
  let highestConfidence = 0;
  let primaryRiskType: string | null = null;

  const severityRank: Record<RiskLevel, number> = { 
    none: 0, 
    low: 1, 
    medium: 2, 
    high: 3, 
    critical: 4 
  };

  // Check all patterns - FIX: Create fresh RegExp instances for each test
  for (const { source, flags, type, severity, confidence } of RISK_PATTERN_SOURCES) {
    // Create fresh regex instance to avoid lastIndex bug
    const pattern = new RegExp(source, flags);
    
    if (pattern.test(normalizedMessage)) {
      detectedPatterns.push(`${type} (${Math.round(confidence * 100)}%)`);
      
      // Update highest severity
      if (severityRank[severity] > severityRank[highestSeverity]) {
        highestSeverity = severity;
        highestConfidence = confidence;
        primaryRiskType = type;
      }
    }
  }

  // Determine if emergency response is required
  const requiresEmergency = highestSeverity === 'critical' || highestSeverity === 'high';

  return {
    riskLevel: highestSeverity,
    riskType: primaryRiskType,
    indicators: detectedPatterns,
    confidenceScore: highestConfidence,
    requiresEmergencyResponse: requiresEmergency,
    emergencyResponse: requiresEmergency && primaryRiskType 
      ? EMERGENCY_RESPONSES[primaryRiskType] 
      : undefined
  };
}

/**
 * Get risk level color for UI
 */
export function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    none: 'green',
    low: 'blue',
    medium: 'yellow',
    high: 'orange',
    critical: 'red'
  };
  return colors[level];
}

/**
 * Get risk level label in Portuguese
 */
export function getRiskLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    none: 'Seguro',
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
    critical: 'Crítico'
  };
  return labels[level];
}
