// src/types/index.ts

export const AppView = {
  DUMP: 'dump',
  DO: 'do',
  DASHBOARD: 'dashboard',
  NEURAL_MAP: 'neural_map'
} as const;

export type AppView = (typeof AppView)[keyof typeof AppView];

export type EnergyLevel = 'low' | 'medium' | 'high';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type MessageRole = 'user' | 'assistant' | 'system';

export type ChatMode = 'dump' | 'processar';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export type MessageType = 'reflection' | 'question' | 'validation';

export type QuestionCategory = 'emotion' | 'thought' | 'body' | 'context' | 'followup';

export type QuestionDepth = 'surface' | 'medium' | 'deep';

export type ActionStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'skipped';

export interface DumpMessage {
  id: string;
  user_id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  message_type?: MessageType;
  risk_level: RiskLevel;
  risk_indicators: string[];
  is_emergency: boolean;
  category?: QuestionCategory;
  depth?: QuestionDepth;
  created_at: string;
  updated_at: string;
}

export interface DoAction {
  id: string;
  user_id: string;
  dump_source: string;
  session_id?: string;
  
  // Action details
  action: string;
  justification: string;
  timebox_minutes: 5 | 15 | 20 | 35 | 60;
  energy_level: EnergyLevel;
  
  // Critic scores
  critic_score?: number;
  empathy_score?: number;
  professionalism_score?: number;
  actionability_score?: number;
  tdah_awareness_score?: number;
  was_refined: boolean;
  refinement_rounds: number;
  critic_feedback?: any;
  
  // Execution
  status: ActionStatus;
  started_at?: string;
  completed_at?: string;
  time_spent_seconds?: number;
  
  // Queue
  queue: string[];
  parking_candidate?: string;
  
  created_at: string;
  updated_at: string;
}

export interface RiskEvent {
  id: string;
  user_id?: string;
  risk_level: Exclude<RiskLevel, 'none'>;
  risk_type: string;
  detected_indicators: string[];
  confidence_score: number;
  source_type: 'dump' | 'do' | 'chat';
  time_of_day?: 'morning' | 'afternoon' | 'evening' | 'night';
  day_of_week?: number;
  emergency_response_sent: boolean;
  response_type?: string;
  created_at: string;
}

export interface ReflectiveQuestion {
  question: string;
  category: QuestionCategory;
  depth: QuestionDepth;
  reasoning: string;
}

export interface DayOneResponse {
  validation: string;
  questions: ReflectiveQuestion[];
}

export interface ProcessedDump {
  action: string;
  justification: string;
  timebox_minutes: 5 | 15 | 20 | 35 | 60;
  queue: string[];
  parking_candidate: string | null;
  criticEvaluation?: CriticEvaluation;
  wasRefined?: boolean;
  refinementRounds?: number;
}

export interface CriticEvaluation {
  empathyScore: number;
  professionalismScore: number;
  actionabilityScore: number;
  tdahAwarenessScore: number;
  overallScore: number;
  feedback: string;
  suggestedImprovements: string[];
  shouldRefine: boolean;
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  riskType: string | null;
  indicators: string[];
  confidenceScore: number;
  requiresEmergencyResponse: boolean;
  emergencyResponse?: string;
}
