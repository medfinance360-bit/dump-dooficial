-- ============================================
-- Dump.do v0.1 - Migration 005
-- Risk Events Logging Table (MIND-SAFE)
-- ============================================

-- Separate table for risk events to enable analysis
-- without exposing message content
CREATE TABLE IF NOT EXISTS public.risk_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References (nullable for anonymized analysis)
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    
    -- Risk classification
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_type TEXT NOT NULL CHECK (risk_type IN (
        'suicidal_ideation',
        'self_harm',
        'violence',
        'substance_crisis',
        'panic_attack',
        'severe_distress',
        'other'
    )),
    
    -- Detection metadata
    detected_indicators TEXT[], -- Keywords/patterns that triggered
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    detection_method TEXT DEFAULT 'keyword' CHECK (detection_method IN ('keyword', 'regex', 'ml', 'manual')),
    
    -- Response tracking
    emergency_response_sent BOOLEAN DEFAULT FALSE,
    response_type TEXT, -- 'cvv_referral', 'grounding_exercise', etc.
    
    -- Anonymized context (no PII)
    session_duration_minutes INTEGER,
    message_count_at_event INTEGER,
    time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'night'
    day_of_week INTEGER, -- 0-6
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analysis
CREATE INDEX idx_risk_events_type ON public.risk_events(risk_type);
CREATE INDEX idx_risk_events_level ON public.risk_events(risk_level);
CREATE INDEX idx_risk_events_time ON public.risk_events(created_at DESC);
CREATE INDEX idx_risk_events_analysis ON public.risk_events(risk_type, risk_level, time_of_day);

-- RLS: Only service role can access risk events
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;

-- No policies for regular users - only service role access
-- This table is for internal analysis only

COMMENT ON TABLE public.risk_events IS 'MIND-SAFE risk event logging for analysis - no PII exposed';
