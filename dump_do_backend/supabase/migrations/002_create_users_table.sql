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
