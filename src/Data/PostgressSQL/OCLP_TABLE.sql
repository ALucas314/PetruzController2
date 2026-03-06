-- ============================================================================
-- Tabela OCLP - Objeto de cadastro de linhas de produção
-- Campos: Código da linha, Descrição da linha
-- Execute este SQL no SQL Editor do Supabase (PostgreSQL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCLP" (
  id      BIGSERIAL PRIMARY KEY,          -- ID interno
  line_id BIGINT,                         -- ID da linha (caso queira usar um identificador numérico interno)
  "Code"  VARCHAR(20) UNIQUE NOT NULL,    -- Código da linha (ex: L01, L02)
  "Name"  VARCHAR(100) NOT NULL,          -- Descrição da linha (ex: LINHA 01)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por código
CREATE INDEX IF NOT EXISTS idx_oclp_code ON "OCLP"("Code");

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_oclp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_oclp_updated_at ON "OCLP";
CREATE TRIGGER trg_oclp_updated_at
  BEFORE UPDATE ON "OCLP"
  FOR EACH ROW
  EXECUTE FUNCTION update_oclp_updated_at();

-- Comentários (documentação)
COMMENT ON TABLE "OCLP" IS 'Objeto de cadastro de linhas de produção';
COMMENT ON COLUMN "OCLP".line_id IS 'ID numérico interno da linha de produção (opcional)';
COMMENT ON COLUMN "OCLP"."Code" IS 'Código da linha de produção';
COMMENT ON COLUMN "OCLP"."Name" IS 'Descrição da linha de produção';

