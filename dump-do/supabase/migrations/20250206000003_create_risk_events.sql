-- Migration: Create risk_events table
-- Description: Analytics for MIND-SAFE risk detection (anonymized, no message content)

CREATE TABLE IF NOT EXISTS public.risk_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Anonymizable
    
    -- Risk data
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_type TEXT NOT NULL,
    detected_indicators JSONB NOT NULL,
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Context (no content)
    source_type TEXT NOT NULL CHECK (source_type IN ('dump', 'do', 'chat')),
    time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    
    -- Response tracking
    emergency_response_sent BOOLEAN DEFAULT FALSE,
    response_type TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_risk_events_level ON public.risk_events(risk_level, created_at DESC);
CREATE INDEX idx_risk_events_type ON public.risk_events(risk_type, created_at DESC);
CREATE INDEX idx_risk_events_user ON public.risk_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_risk_events_time ON public.risk_events(time_of_day, day_of_week);

-- Enable RLS
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own risk events"
    ON public.risk_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own risk events"
    ON public.risk_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Anonymization function (for LGPD compliance)
CREATE OR REPLACE FUNCTION anonymize_old_risk_events()
RETURNS void AS $$
BEGIN
    UPDATE public.risk_events
    SET user_id = NULL
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.risk_events IS 'MIND-SAFE risk detection analytics (LGPD compliant - no message content)';
COMMENT ON COLUMN public.risk_events.detected_indicators IS 'Array of regex patterns that triggered detection';
COMMENT ON COLUMN public.risk_events.confidence_score IS 'MIND-SAFE confidence level (0.0 - 1.0)';
COMMENT ON FUNCTION anonymize_old_risk_events IS 'Anonymizes risk events older than 90 days for LGPD compliance';
