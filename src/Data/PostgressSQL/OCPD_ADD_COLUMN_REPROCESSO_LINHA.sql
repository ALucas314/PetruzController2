-- ============================================================================
-- Migração: adicionar coluna reprocesso_linha na tabela OCPD
-- Armazena a linha de produção associada ao reprocesso (código da linha, ex: "10", "12").
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

ALTER TABLE "OCPD"
  ADD COLUMN IF NOT EXISTS reprocesso_linha VARCHAR(50);

COMMENT ON COLUMN "OCPD".reprocesso_linha IS 'Código da linha de produção do reprocesso (quando preenchido nas colunas de reprocesso)';
