-- ============================================================================
-- OCTE: adicionar coluna Meta Kg
--
-- Nome técnico no banco: meta_kg
-- Nome de exibição: Meta Kg
--
-- Execute no Supabase: SQL Editor -> New query -> Run
-- ============================================================================

ALTER TABLE public."OCTE"
  ADD COLUMN IF NOT EXISTS meta_kg NUMERIC(18,4);

COMMENT ON COLUMN public."OCTE".meta_kg IS 'Meta Kg';

