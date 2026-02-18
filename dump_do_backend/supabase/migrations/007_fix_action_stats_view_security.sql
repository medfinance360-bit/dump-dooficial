-- ============================================
-- Fix: public.action_stats SECURITY DEFINER → SECURITY INVOKER
-- Resolves Supabase advisory: view should respect RLS/caller context.
-- Requires PostgreSQL 15+ (Supabase). Em versões < 15, seria necessário
-- recriar a view sem SECURITY DEFINER (DROP + CREATE com o mesmo SELECT).
-- ============================================

-- Make the view run with the caller's privileges (respects RLS)
ALTER VIEW IF EXISTS public.action_stats SET (security_invoker = on);

-- Política: apenas usuários autenticados podem consultar; RLS nas tabelas base
-- restringe a visibilidade por tenant/user. anon não tem acesso.
REVOKE ALL ON TABLE public.action_stats FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.action_stats TO authenticated;
-- Opcional (server-side/jobs): GRANT SELECT ON TABLE public.action_stats TO my_server_role;

COMMENT ON VIEW public.action_stats IS 'Fixed: security_invoker=on so RLS is respected (Dump.do security fix).';

-- ============================================
-- DEPENDÊNCIAS (se a view for referenciada por outras views/materialized views)
-- ============================================
-- Após aplicar, revalidar dependentes se aplicável:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.<nome_da_mv>;
-- Ou REINDEX em índices que dependam desta view.

-- ============================================
-- CHECKLIST PÓS-APLICAÇÃO (segurança)
-- ============================================
-- 1. RLS: Como anon, confirmar que não há acesso (ou só se GRANT explícito).
--    Como authenticated, confirmar que só vê linhas permitidas por RLS das tabelas base.
-- 2. GRANTs: Verificar se algum papel (ex.: funções/server-side jobs) precisa de
--    GRANT SELECT ON public.action_stats.
-- 3. Dependências: Se a view alimenta relatórios ou jobs, validar que não quebraram.
-- 4. Índices: Se a view/tabelas base filtram por user_id/tenant_id em RLS,
--    garantir índices nessas colunas.
--
-- EDGE CASE (se precisar de privilégio elevado no futuro):
-- Mover só a lógica necessária para uma função SECURITY DEFINER restrita
-- (REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE só ao papel necessário).
-- Manter a view como invoker ou fazer a view chamar essa função de forma controlada.
-- Assim o acesso elevado fica explícito e auditável.

-- ============================================
-- VERIFICAÇÃO RÁPIDA (descomente para rodar após aplicar)
-- ============================================
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'action_stats';
-- SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'action_stats';
-- \dd+ public.action_stats  -- no psql: lista opções da view (deve mostrar security_invoker)
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='action_stats';
