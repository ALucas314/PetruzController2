-- ============================================================================
-- Migração: coluna turno na tabela OCPH
-- Número sequencial do turno (ex.: 1 a 5 para os intervalos bi-horários fixos).
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

ALTER TABLE public."OCPH"
  ADD COLUMN IF NOT EXISTS turno SMALLINT;

COMMENT ON COLUMN public."OCPH".turno IS 'Turno por linha fixa bi-horária: linhas 1–5 → valores 1, 2, 1, 2, 3 (ex.: 1°, 2°, 1°, 2°, 3°).';

-- Índice opcional para filtrar/ordenar por documento + turno
CREATE INDEX IF NOT EXISTS idx_ocph_doc_turno ON public."OCPH"(doc_id, turno);
