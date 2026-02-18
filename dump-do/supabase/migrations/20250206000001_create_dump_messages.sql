-- Migration: Create dump_messages table
-- Description: Stores chat messages from Day One style conversations

CREATE TABLE IF NOT EXISTS public.dump_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    
    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    message_type TEXT CHECK (message_type IN ('reflection', 'question', 'validation')),
    
    -- MIND-SAFE risk assessment
    risk_level TEXT DEFAULT 'none' CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
    risk_indicators JSONB DEFAULT '[]'::jsonb,
    is_emergency BOOLEAN DEFAULT FALSE,
    
    -- Categorization
    category TEXT CHECK (category IN ('emotion', 'thought', 'body', 'context', 'followup')),
    depth TEXT CHECK (depth IN ('surface', 'medium', 'deep')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_dump_messages_user_session ON public.dump_messages(user_id, session_id, created_at DESC);
CREATE INDEX idx_dump_messages_risk ON public.dump_messages(risk_level, created_at DESC) 
    WHERE risk_level IN ('high', 'critical');
CREATE INDEX idx_dump_messages_session ON public.dump_messages(session_id, created_at ASC);

-- Enable Row Level Security
ALTER TABLE public.dump_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own messages"
    ON public.dump_messages FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
    ON public.dump_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
    ON public.dump_messages FOR UPDATE
    USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dump_messages_updated_at BEFORE UPDATE
    ON public.dump_messages FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.dump_messages IS 'Day One style chat messages with MIND-SAFE risk detection';
COMMENT ON COLUMN public.dump_messages.message_type IS 'Type of assistant message: reflection, question, or validation';
COMMENT ON COLUMN public.dump_messages.category IS 'Categorization of reflective question';
COMMENT ON COLUMN public.dump_messages.depth IS 'Depth level of reflective question';
