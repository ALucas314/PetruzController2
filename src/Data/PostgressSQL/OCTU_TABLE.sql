-- ============================================================================
-- Tabela OCTU - Objeto de Cadastro de Usuários (login / autenticação)
-- Execute este SQL no SQL Editor do Supabase: Dashboard → SQL Editor → New query
-- Cole o conteúdo abaixo e clique em Run.
-- ============================================================================

-- Criar tabela OCTU (usuários do sistema)
CREATE TABLE IF NOT EXISTS "OCTU" (
  id             BIGSERIAL PRIMARY KEY,
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  nome           VARCHAR(255),
  ativo          BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para login rápido por e-mail
CREATE UNIQUE INDEX IF NOT EXISTS idx_octu_email ON "OCTU"(email);

-- Índice para listar usuários ativos
CREATE INDEX IF NOT EXISTS idx_octu_ativo ON "OCTU"(ativo);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_octu_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_octu_updated_at ON "OCTU";
CREATE TRIGGER trg_octu_updated_at
  BEFORE UPDATE ON "OCTU"
  FOR EACH ROW
  EXECUTE PROCEDURE update_octu_updated_at();

-- Comentários (documentação)
COMMENT ON TABLE "OCTU" IS 'Objeto de cadastro de usuários (login e autenticação)';
COMMENT ON COLUMN "OCTU".id IS 'ID único do usuário';
COMMENT ON COLUMN "OCTU".email IS 'E-mail (login) - único';
COMMENT ON COLUMN "OCTU".password_hash IS 'Senha hasheada (ex: bcrypt)';
COMMENT ON COLUMN "OCTU".nome IS 'Nome completo do usuário';
COMMENT ON COLUMN "OCTU".ativo IS 'Se o usuário está ativo (pode fazer login)';
COMMENT ON COLUMN "OCTU".created_at IS 'Data de criação';
COMMENT ON COLUMN "OCTU".updated_at IS 'Data da última atualização';

-- ============================================================================
-- Habilitar RLS (Row Level Security) - opcional, para segurança por linha
-- ============================================================================
-- ALTER TABLE "OCTU" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Usuários visíveis para service role" ON "OCTU"
--   FOR ALL USING (true);
