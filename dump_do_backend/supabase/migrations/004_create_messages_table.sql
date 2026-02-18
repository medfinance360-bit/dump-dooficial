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
