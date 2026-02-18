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
