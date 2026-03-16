-- ============================================================================
-- OCPP: adicionar campo filial_nome (igual à OCPD)
-- Para vincular registros de planejamento às filiais.
-- Execute no SQL Editor do Supabase antes dos scripts doc_ordem_global / doc_numero.
-- ============================================================================

ALTER TABLE "OCPP"
  ADD COLUMN IF NOT EXISTS filial_nome VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ocpp_filial_nome ON "OCPP"(filial_nome);

COMMENT ON COLUMN "OCPP".filial_nome IS 'Nome completo da filial (referência à tabela OCTF) - Ex: BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA, PETRUZ FRUITY INDUSTRIA, COMERCIO E DISTRIBUIDORA LTDA - PA';
