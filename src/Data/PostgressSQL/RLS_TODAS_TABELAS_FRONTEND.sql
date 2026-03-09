-- ============================================================================
-- RLS (Row Level Security) — mesmo padrão para todas as tabelas do frontend
--
-- O frontend usa Supabase com anon key + usuário autenticado. Sem estas
-- políticas, as consultas retornam 0 linhas (Filial, Linha, Itens, Produção,
-- Histórico de Análise de Produção).
--
-- Execute uma vez no Supabase: SQL Editor → New query → cole tudo → Run
-- ============================================================================

-- OCPD (produção diária + histórico de análise de produção)
ALTER TABLE "OCPD" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ocpd_authenticated_all" ON "OCPD";
CREATE POLICY "ocpd_authenticated_all" ON "OCPD"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTF (filiais)
ALTER TABLE "OCTF" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octf_authenticated_all" ON "OCTF";
CREATE POLICY "octf_authenticated_all" ON "OCTF"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCLP (linhas de produção)
ALTER TABLE "OCLP" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oclp_authenticated_all" ON "OCLP";
CREATE POLICY "oclp_authenticated_all" ON "OCLP"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTI (itens / catálogo — código → descrição ao digitar)
ALTER TABLE "OCTI" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octi_authenticated_all" ON "OCTI";
CREATE POLICY "octi_authenticated_all" ON "OCTI"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTP (problemas e ações / status)
ALTER TABLE "OCTP" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octp_authenticated_all" ON "OCTP";
CREATE POLICY "octp_authenticated_all" ON "OCTP"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTU_DRAFT_AUTH (rascunho por usuário logado)
ALTER TABLE "OCTU_DRAFT_AUTH" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octu_draft_auth_own" ON "OCTU_DRAFT_AUTH";
CREATE POLICY "octu_draft_auth_own" ON "OCTU_DRAFT_AUTH"
  FOR ALL TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
