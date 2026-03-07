-- ============================================================================
-- Migração: adicionar coluna reprocessos (JSONB) na tabela OCPD
-- Necessário para salvar e carregar MÚLTIPLOS reprocessos por dia/filial.
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

-- Adiciona a coluna se ainda não existir (não dá erro se já existir)
ALTER TABLE "OCPD"
  ADD COLUMN IF NOT EXISTS reprocessos JSONB DEFAULT '[]'::jsonb;

-- Índice para consultas que filtram por reprocessos (opcional)
CREATE INDEX IF NOT EXISTS idx_ocpd_reprocessos ON "OCPD" USING GIN (reprocessos);

COMMENT ON COLUMN "OCPD".reprocessos IS 'Array JSON de reprocessos: [{"numero": 1, "tipo": "Cortado"|"Usado", "codigo": "...", "descricao": "...", "quantidade": 0.00}, ...]';
