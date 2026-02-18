-- Migration: Create do_actions table
-- Description: Stores action plans generated from dumps with energy-based timeboxing

CREATE TABLE IF NOT EXISTS public.do_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Source dump
    dump_source TEXT NOT NULL,
    session_id UUID,
    
    -- Action details
    action TEXT NOT NULL,
    justification TEXT NOT NULL,
    timebox_minutes INTEGER NOT NULL CHECK (timebox_minutes IN (5, 15, 20, 35, 60)),
    energy_level TEXT NOT NULL CHECK (energy_level IN ('low', 'medium', 'high')),
    
    -- Critic Agent metadata
    critic_score NUMERIC(3,1) CHECK (critic_score >= 0 AND critic_score <= 10),
    empathy_score NUMERIC(3,1),
    professionalism_score NUMERIC(3,1),
    actionability_score NUMERIC(3,1),
    tdah_awareness_score NUMERIC(3,1),
    was_refined BOOLEAN DEFAULT FALSE,
    refinement_rounds INTEGER DEFAULT 0,
    critic_feedback JSONB,
    
    -- Task management
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'skipped')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    time_spent_seconds INTEGER,
    
    -- Queue & Parking
    queue JSONB DEFAULT '[]'::jsonb,
    parking_candidate TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_do_actions_user_status ON public.do_actions(user_id, status, created_at DESC);
CREATE INDEX idx_do_actions_energy ON public.do_actions(energy_level, created_at DESC);
CREATE INDEX idx_do_actions_critic ON public.do_actions(critic_score DESC) WHERE critic_score IS NOT NULL;
CREATE INDEX idx_do_actions_session ON public.do_actions(session_id) WHERE session_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.do_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own actions"
    ON public.do_actions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own actions"
    ON public.do_actions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own actions"
    ON public.do_actions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own actions"
    ON public.do_actions FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_do_actions_updated_at BEFORE UPDATE
    ON public.do_actions FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate time_spent on completion
CREATE OR REPLACE FUNCTION calculate_time_spent()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.time_spent_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_time_spent BEFORE UPDATE
    ON public.do_actions FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION calculate_time_spent();

-- Comments
COMMENT ON TABLE public.do_actions IS 'Energy-based action plans with critic agent refinement';
COMMENT ON COLUMN public.do_actions.critic_score IS 'Overall quality score from critic agent (1-10)';
COMMENT ON COLUMN public.do_actions.queue IS 'Array of secondary tasks identified during processing';
COMMENT ON COLUMN public.do_actions.parking_candidate IS 'Future task to be parked for later';
