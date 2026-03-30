-- ============================================================================
-- OCTC — adiciona coluna filial_nome (filial do colaborador)
-- Execute no Supabase SQL Editor em bases que já possuem a tabela OCTC.
-- Novas instalações: use OCTC_TABLE.sql atualizado (já inclui a coluna).
-- ============================================================================

ALTER TABLE public."OCTC"
  ADD COLUMN IF NOT EXISTS filial_nome VARCHAR(120) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_octc_filial_nome ON public."OCTC"(filial_nome);

COMMENT ON COLUMN public."OCTC".filial_nome IS 'Nome da filial (referência ao cadastro de filiais / contexto operacional)';
