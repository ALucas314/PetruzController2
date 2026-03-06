-- ============================================================================
-- Tabela para tokens de redefinição de senha (Esqueci minha senha)
-- Execute no SQL Editor do Supabase após criar a OCTU.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCTU_RESET" (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES "OCTU"(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_octu_reset_token_hash ON "OCTU_RESET"(token_hash);
CREATE INDEX IF NOT EXISTS idx_octu_reset_expires_at ON "OCTU_RESET"(expires_at);

COMMENT ON TABLE "OCTU_RESET" IS 'Tokens de redefinição de senha (esqueci minha senha)';
