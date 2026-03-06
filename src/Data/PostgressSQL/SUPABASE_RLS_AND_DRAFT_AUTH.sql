-- ============================================================================
-- 1) Tabela OCTU_DRAFT_AUTH: rascunho por usuário Supabase Auth (UUID)
--    Use esta tabela quando o frontend usar Supabase Auth (auth.uid()).
-- ============================================================================
CREATE TABLE IF NOT EXISTS "OCTU_DRAFT_AUTH" (
  id          BIGSERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL,
  screen      VARCHAR(100) NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(auth_user_id, screen)
);

CREATE INDEX IF NOT EXISTS idx_octu_draft_auth_user_screen ON "OCTU_DRAFT_AUTH"(auth_user_id, screen);
COMMENT ON TABLE "OCTU_DRAFT_AUTH" IS 'Rascunho por usuário Supabase Auth (UUID) e tela';

-- ============================================================================
-- 2) RLS (Row Level Security) para acesso direto do frontend com anon key
--    Execute após criar as tabelas. Ajuste as políticas conforme sua regra.
-- ============================================================================

-- OCPD: permitir select/insert/update/delete para usuários autenticados
ALTER TABLE "OCPD" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ocpd_authenticated_all" ON "OCPD";
CREATE POLICY "ocpd_authenticated_all" ON "OCPD"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCLP
ALTER TABLE "OCLP" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oclp_authenticated_all" ON "OCLP";
CREATE POLICY "oclp_authenticated_all" ON "OCLP"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTI
ALTER TABLE "OCTI" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octi_authenticated_all" ON "OCTI";
CREATE POLICY "octi_authenticated_all" ON "OCTI"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTF (filiais)
ALTER TABLE "OCTF" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octf_authenticated_all" ON "OCTF";
CREATE POLICY "octf_authenticated_all" ON "OCTF"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCPR (reprocessos)
ALTER TABLE "OCPR" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ocpr_authenticated_all" ON "OCPR";
CREATE POLICY "ocpr_authenticated_all" ON "OCPR"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTU_DRAFT_AUTH: cada usuário só acessa seu próprio rascunho
ALTER TABLE "OCTU_DRAFT_AUTH" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octu_draft_auth_own" ON "OCTU_DRAFT_AUTH";
CREATE POLICY "octu_draft_auth_own" ON "OCTU_DRAFT_AUTH"
  FOR ALL TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
