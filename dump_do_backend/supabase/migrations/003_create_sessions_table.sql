-- ============================================
-- Dump.do v0.1 - Migration 003
-- Chat Sessions Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Session metadata
    title TEXT, -- Auto-generated summary (v0.2)
    mode TEXT NOT NULL DEFAULT 'dump' CHECK (mode IN ('dump', 'processar')),
    
    -- Risk tracking for this session
    max_risk_level TEXT DEFAULT 'none' CHECK (max_risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
    risk_events_count INTEGER DEFAULT 0,
    emergency_triggered BOOLEAN DEFAULT FALSE,
    
    -- Session state
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    message_count INTEGER DEFAULT 0,
    
    -- Context for short-term memory (v0.1)
    -- Stores recent context as JSON for session continuity
    context_summary JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    -- LGPD: scheduled deletion
    scheduled_deletion_at TIMESTAMPTZ
);

-- Trigger to update last_activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_last_activity
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- Indexes for performance
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_user_active ON public.sessions(user_id, status) WHERE status = 'active';
CREATE INDEX idx_sessions_last_activity ON public.sessions(last_activity_at DESC);
CREATE INDEX idx_sessions_risk ON public.sessions(max_risk_level) WHERE max_risk_level IN ('high', 'critical');
CREATE INDEX idx_sessions_deletion ON public.sessions(scheduled_deletion_at) WHERE scheduled_deletion_at IS NOT NULL;

-- RLS Policies
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
    ON public.sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
    ON public.sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON public.sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can soft-delete own sessions"
    ON public.sessions FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON TABLE public.sessions IS 'Chat sessions with risk tracking and LGPD compliance';
