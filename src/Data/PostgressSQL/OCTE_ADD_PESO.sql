-- Peso do item em kg (por linha OCTE).
-- Execute no Supabase se a tabela já existir sem esta coluna.

ALTER TABLE public."OCTE"
  ADD COLUMN IF NOT EXISTS peso NUMERIC(18, 4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_octe_peso ON public."OCTE"(peso);

COMMENT ON COLUMN public."OCTE".peso IS 'Peso do item em kg (digitado no cadastro).';
