-- ============================================
-- Dump.do v0.1 - Migration 001
-- Enable Required Extensions
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector for future vector store (v0.2)
-- This prepares the database for semantic search/memory
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for text similarity search (fallback)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Comments for documentation
COMMENT ON EXTENSION vector IS 'Vector similarity search - prepared for Dump.do v0.2 long-term memory';
-- ============================================
-- Dump.do v0.1 - Migration 002
-- Users Table (integrated with Supabase Auth)
-- ============================================

-- Users table extends Supabase Auth
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Profile info
    display_name TEXT,
    avatar_url TEXT,
    
    -- Preferences
    preferred_mode TEXT DEFAULT 'dump' CHECK (preferred_mode IN ('dump', 'processar')),
    language TEXT DEFAULT 'pt-BR',
    
    -- LGPD compliance
    data_retention_days INTEGER DEFAULT 90,
    consent_given_at TIMESTAMPTZ,
    consent_version TEXT DEFAULT '1.0',
    
    -- Risk tracking (aggregated, not PII)
    total_sessions INTEGER DEFAULT 0,
    last_risk_level TEXT DEFAULT 'none' CHECK (last_risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-create user profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX idx_users_last_risk ON public.users(last_risk_level) WHERE last_risk_level != 'none';

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

COMMENT ON TABLE public.users IS 'User profiles extending Supabase Auth - LGPD compliant';
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
-- ============================================
-- Dump.do v0.1 - Migration 004
-- Messages Table with Vector Preparation
-- ============================================

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    -- Mode context
    mode TEXT NOT NULL CHECK (mode IN ('dump', 'processar')),
    
    -- MIND-SAFE risk assessment
    risk_level TEXT DEFAULT 'none' CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
    risk_indicators JSONB DEFAULT '[]'::jsonb, -- Array of detected indicators
    is_emergency_response BOOLEAN DEFAULT FALSE,
    
    -- Token usage tracking
    tokens_input INTEGER,
    tokens_output INTEGER,
    
    -- LLM metadata
    model_used TEXT,
    response_time_ms INTEGER,
    
    -- Vector embedding (prepared for v0.2)
    -- Using 768 dimensions (compatible with most embedding models)
    embedding vector(768),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update session message count and risk
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    -- Update message count
    UPDATE public.sessions
    SET 
        message_count = message_count + 1,
        max_risk_level = CASE 
            WHEN NEW.risk_level = 'critical' THEN 'critical'
            WHEN NEW.risk_level = 'high' AND max_risk_level NOT IN ('critical') THEN 'high'
            WHEN NEW.risk_level = 'medium' AND max_risk_level NOT IN ('critical', 'high') THEN 'medium'
            WHEN NEW.risk_level = 'low' AND max_risk_level = 'none' THEN 'low'
            ELSE max_risk_level
        END,
        risk_events_count = CASE 
            WHEN NEW.risk_level IN ('medium', 'high', 'critical') 
            THEN risk_events_count + 1 
            ELSE risk_events_count 
        END,
        emergency_triggered = CASE 
            WHEN NEW.is_emergency_response THEN TRUE 
            ELSE emergency_triggered 
        END
    WHERE id = NEW.session_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER on_message_created
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_on_message();

-- Indexes for performance
CREATE INDEX idx_messages_session ON public.messages(session_id, created_at DESC);
CREATE INDEX idx_messages_user ON public.messages(user_id);
CREATE INDEX idx_messages_risk ON public.messages(risk_level) WHERE risk_level IN ('high', 'critical');
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

-- Prepared for v0.2: Vector similarity search index
-- Using IVFFlat for approximate nearest neighbor search
-- Will be activated when embeddings are populated
-- CREATE INDEX idx_messages_embedding ON public.messages 
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS Policies
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
    ON public.messages FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own messages"
    ON public.messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Messages are immutable - no update policy
-- Deletion handled via session cascade

COMMENT ON TABLE public.messages IS 'Chat messages with MIND-SAFE risk tracking and vector embeddings (v0.2)';
COMMENT ON COLUMN public.messages.embedding IS 'Vector embedding for semantic search - prepared for v0.2 long-term memory';
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
-- ============================================
-- Dump.do v0.2 Preparation - Vector Store
-- Future: Long-term Memory via Semantic Search
-- ============================================

-- Memory summaries table for long-term context
-- This will store processed/summarized memories, not raw messages
CREATE TABLE IF NOT EXISTS public.memory_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Memory content
    summary TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'recurring_theme',    -- Patterns across sessions
        'insight',            -- User realizations
        'coping_strategy',    -- What worked for the user
        'trigger',            -- Identified stressors
        'goal',               -- Expressed goals
        'preference'          -- Communication preferences
    )),
    
    -- Source tracking
    source_session_ids UUID[], -- Sessions this memory was derived from
    extraction_date DATE DEFAULT CURRENT_DATE,
    
    -- Vector embedding for semantic search
    embedding vector(768),
    
    -- Relevance scoring
    importance_score DECIMAL(3,2) DEFAULT 0.50, -- 0.00 to 1.00
    access_count INTEGER DEFAULT 0, -- How often this memory was retrieved
    last_accessed_at TIMESTAMPTZ,
    
    -- LGPD compliance
    expires_at TIMESTAMPTZ, -- User-controlled retention
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER update_memory_summaries_updated_at
    BEFORE UPDATE ON public.memory_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_memory_user ON public.memory_summaries(user_id);
CREATE INDEX idx_memory_type ON public.memory_summaries(user_id, memory_type);
CREATE INDEX idx_memory_importance ON public.memory_summaries(user_id, importance_score DESC);

-- Vector similarity search index (to be enabled in v0.2)
-- CREATE INDEX idx_memory_embedding ON public.memory_summaries 
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS Policies
ALTER TABLE public.memory_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories"
    ON public.memory_summaries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
    ON public.memory_summaries FOR DELETE
    USING (auth.uid() = user_id);

-- Function for semantic search (v0.2)
CREATE OR REPLACE FUNCTION search_user_memories(
    p_user_id UUID,
    p_query_embedding vector(768),
    p_match_count INTEGER DEFAULT 5,
    p_memory_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    summary TEXT,
    memory_type TEXT,
    importance_score DECIMAL,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.summary,
        m.memory_type,
        m.importance_score,
        1 - (m.embedding <=> p_query_embedding) as similarity
    FROM public.memory_summaries m
    WHERE m.user_id = p_user_id
        AND m.embedding IS NOT NULL
        AND (p_memory_types IS NULL OR m.memory_type = ANY(p_memory_types))
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
    ORDER BY m.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$;

COMMENT ON TABLE public.memory_summaries IS 'v0.2: Long-term memory store with semantic search capabilities';
COMMENT ON FUNCTION search_user_memories IS 'v0.2: Semantic search for user memories using vector similarity';
