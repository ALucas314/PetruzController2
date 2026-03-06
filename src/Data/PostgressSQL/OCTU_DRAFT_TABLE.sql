-- ============================================================================
-- Tabela OCTU_DRAFT - Rascunho por usuário e tela (Produção, etc.)
-- Permite que o mesmo usuário (ex.: turno manhã/tarde) veja o estado deixado
-- pela última sessão, mesmo sem ter clicado em "Salvar no banco".
-- Execute no Supabase: Dashboard → SQL Editor → New query → Run
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCTU_DRAFT" (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES "OCTU"(id) ON DELETE CASCADE,
  screen      VARCHAR(100) NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, screen)
);

CREATE INDEX IF NOT EXISTS idx_octu_draft_user_screen ON "OCTU_DRAFT"(user_id, screen);

COMMENT ON TABLE "OCTU_DRAFT" IS 'Rascunho por usuário e tela (ex: producao) para persistir estado entre sessões/turnos';
COMMENT ON COLUMN "OCTU_DRAFT".user_id IS 'ID do usuário (OCTU)';
COMMENT ON COLUMN "OCTU_DRAFT".screen IS 'Identificador da tela (ex: producao, planejamento)';
COMMENT ON COLUMN "OCTU_DRAFT".data IS 'Estado serializado (JSON) da tela';
COMMENT ON COLUMN "OCTU_DRAFT".updated_at IS 'Última atualização do rascunho';
