-- Migration: Create analytics views
-- Description: Aggregated views for dashboard insights

-- Daily activity summary
CREATE OR REPLACE VIEW public.daily_dump_activity AS
SELECT 
    user_id,
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE role = 'user') as dumps_count,
    COUNT(*) FILTER (WHERE role = 'assistant' AND message_type = 'question') as questions_received,
    COUNT(*) FILTER (WHERE role = 'assistant' AND message_type = 'validation') as validations_received,
    COUNT(*) FILTER (WHERE risk_level IN ('medium', 'high', 'critical')) as risk_events,
    COUNT(DISTINCT session_id) as sessions_count
FROM public.dump_messages
GROUP BY user_id, DATE(created_at);

COMMENT ON VIEW public.daily_dump_activity IS 'Daily summary of dump activity per user';

-- Action completion stats
CREATE OR REPLACE VIEW public.action_stats AS
SELECT 
    user_id,
    energy_level,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'skipped') as skipped_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
    AVG(timebox_minutes) FILTER (WHERE status = 'completed') as avg_timebox_completed,
    AVG(time_spent_seconds / 60.0) FILTER (WHERE status = 'completed') as avg_actual_time_minutes,
    AVG(critic_score) FILTER (WHERE critic_score IS NOT NULL) as avg_critic_score,
    COUNT(*) FILTER (WHERE was_refined = true) as refined_count
FROM public.do_actions
GROUP BY user_id, energy_level;

COMMENT ON VIEW public.action_stats IS 'Action completion and quality statistics by energy level';

-- Risk trends over time
CREATE OR REPLACE VIEW public.risk_trends AS
SELECT 
    user_id,
    DATE(created_at) as date,
    risk_level,
    risk_type,
    COUNT(*) as event_count,
    AVG(confidence_score) as avg_confidence
FROM public.risk_events
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE(created_at), risk_level, risk_type;

COMMENT ON VIEW public.risk_trends IS 'Risk detection trends over time';

-- Message category distribution
CREATE OR REPLACE VIEW public.message_category_dist AS
SELECT 
    user_id,
    category,
    depth,
    COUNT(*) as question_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY user_id), 2) as percentage
FROM public.dump_messages
WHERE role = 'assistant' AND message_type = 'question'
GROUP BY user_id, category, depth;

COMMENT ON VIEW public.message_category_dist IS 'Distribution of reflective question categories';

-- Weekly summary (for dashboard)
CREATE OR REPLACE VIEW public.weekly_summary AS
SELECT 
    dm.user_id,
    DATE_TRUNC('week', dm.created_at) as week_start,
    COUNT(DISTINCT dm.session_id) as total_sessions,
    COUNT(*) FILTER (WHERE dm.role = 'user') as total_dumps,
    COUNT(*) FILTER (WHERE dm.role = 'assistant') as total_reflections,
    COUNT(DISTINCT da.id) as total_actions,
    COUNT(DISTINCT da.id) FILTER (WHERE da.status = 'completed') as completed_actions,
    COALESCE(AVG(da.critic_score), 0) as avg_quality_score,
    COUNT(DISTINCT re.id) FILTER (WHERE re.risk_level IN ('high', 'critical')) as high_risk_events
FROM public.dump_messages dm
LEFT JOIN public.do_actions da ON da.user_id = dm.user_id 
    AND DATE_TRUNC('week', da.created_at) = DATE_TRUNC('week', dm.created_at)
LEFT JOIN public.risk_events re ON re.user_id = dm.user_id 
    AND DATE_TRUNC('week', re.created_at) = DATE_TRUNC('week', dm.created_at)
GROUP BY dm.user_id, DATE_TRUNC('week', dm.created_at);

COMMENT ON VIEW public.weekly_summary IS 'Weekly rollup of all user activity';

-- Grant permissions on views
GRANT SELECT ON public.daily_dump_activity TO authenticated;
GRANT SELECT ON public.action_stats TO authenticated;
GRANT SELECT ON public.risk_trends TO authenticated;
GRANT SELECT ON public.message_category_dist TO authenticated;
GRANT SELECT ON public.weekly_summary TO authenticated;
