-- ============================================================================
-- Criar apenas OCTU_DRAFT_AUTH (rascunho da tela Produção)
-- Reprocessos ficam nos campos da própria OCPD; não usar tabela OCPR.
-- Execute no Supabase: SQL Editor → New query → cole tudo e clique Run
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCTU_DRAFT_AUTH" (
  id           BIGSERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL,
  screen       VARCHAR(100) NOT NULL,
  data         JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(auth_user_id, screen)
);
CREATE INDEX IF NOT EXISTS idx_octu_draft_auth_user_screen ON "OCTU_DRAFT_AUTH"(auth_user_id, screen);
COMMENT ON TABLE "OCTU_DRAFT_AUTH" IS 'Rascunho por usuário Supabase Auth (UUID) e tela';

ALTER TABLE "OCTU_DRAFT_AUTH" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octu_draft_auth_own" ON "OCTU_DRAFT_AUTH";
CREATE POLICY "octu_draft_auth_own" ON "OCTU_DRAFT_AUTH"
  FOR ALL TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
