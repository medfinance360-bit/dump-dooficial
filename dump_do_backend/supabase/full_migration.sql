-- ============================================
-- DUMP.DO v0.1 - MIGRAÇÃO COMPLETA
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. TABELA USERS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    preferred_mode TEXT DEFAULT 'dump' CHECK (preferred_mode IN ('dump', 'processar')),
    language TEXT DEFAULT 'pt-BR',
    data_retention_days INTEGER DEFAULT 90,
    consent_given_at TIMESTAMPTZ,
    consent_version TEXT DEFAULT '1.0',
    total_sessions INTEGER DEFAULT 0,
    last_risk_level TEXT DEFAULT 'none' CHECK (last_risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at
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

-- Auto-create user on signup
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 3. TABELA SESSIONS
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT,
    mode TEXT NOT NULL DEFAULT 'dump' CHECK (mode IN ('dump', 'processar')),
    max_risk_level TEXT DEFAULT 'none' CHECK (max_risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
    risk_events_count INTEGER DEFAULT 0,
    emergency_triggered BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    message_count INTEGER DEFAULT 0,
    context_summary JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    scheduled_deletion_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_session_last_activity ON public.sessions;
CREATE TRIGGER update_session_last_activity
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON public.sessions(user_id, status) WHERE status = 'active';

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
CREATE POLICY "Users can view own sessions" ON public.sessions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own sessions" ON public.sessions;
CREATE POLICY "Users can create own sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;
CREATE POLICY "Users can update own sessions" ON public.sessions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.sessions;
CREATE POLICY "Users can delete own sessions" ON public.sessions FOR DELETE USING (auth.uid() = user_id);

-- 4. TABELA MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('dump', 'processar')),
    risk_level TEXT DEFAULT 'none' CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
    risk_indicators JSONB DEFAULT '[]'::jsonb,
    is_emergency_response BOOLEAN DEFAULT FALSE,
    tokens_input INTEGER,
    tokens_output INTEGER,
    model_used TEXT,
    response_time_ms INTEGER,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_on_message();

CREATE INDEX IF NOT EXISTS idx_messages_session ON public.messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own messages" ON public.messages;
CREATE POLICY "Users can create own messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. TABELA RISK_EVENTS (para análise MIND-SAFE)
CREATE TABLE IF NOT EXISTS public.risk_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_type TEXT NOT NULL CHECK (risk_type IN (
        'suicidal_ideation', 'self_harm', 'violence', 
        'substance_crisis', 'panic_attack', 'severe_distress', 'other'
    )),
    detected_indicators TEXT[],
    confidence_score DECIMAL(3,2),
    detection_method TEXT DEFAULT 'keyword',
    emergency_response_sent BOOLEAN DEFAULT FALSE,
    response_type TEXT,
    session_duration_minutes INTEGER,
    message_count_at_event INTEGER,
    time_of_day TEXT,
    day_of_week INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;

-- 6. TABELA MEMORY_SUMMARIES (preparação v0.2)
CREATE TABLE IF NOT EXISTS public.memory_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'recurring_theme', 'insight', 'coping_strategy', 
        'trigger', 'goal', 'preference'
    )),
    source_session_ids UUID[],
    extraction_date DATE DEFAULT CURRENT_DATE,
    embedding vector(768),
    importance_score DECIMAL(3,2) DEFAULT 0.50,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.memory_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own memories" ON public.memory_summaries;
CREATE POLICY "Users can view own memories" ON public.memory_summaries FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own memories" ON public.memory_summaries;
CREATE POLICY "Users can delete own memories" ON public.memory_summaries FOR DELETE USING (auth.uid() = user_id);
