-- ============================================================================
-- OCTE — adiciona coluna filial_nome
-- Execute no Supabase em bases que já possuem a tabela OCTE.
-- ============================================================================

ALTER TABLE public."OCTE"
  ADD COLUMN IF NOT EXISTS filial_nome VARCHAR(120) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_octe_filial_nome ON public."OCTE"(filial_nome);

COMMENT ON COLUMN public."OCTE".filial_nome IS 'Nome da filial (alinhado ao cadastro OCTF / demais módulos)';
