-- Vincula várias linhas OCTE ao mesmo documento (cadastro em lote no frontend).
-- Execute no Supabase se a tabela OCTE já existir sem esta coluna.

ALTER TABLE public."OCTE"
  ADD COLUMN IF NOT EXISTS codigo_documento VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_octe_codigo_documento ON public."OCTE"(codigo_documento);

COMMENT ON COLUMN public."OCTE".codigo_documento IS 'Identificador lógico do documento (ex.: UUID); várias linhas podem compartilhar o mesmo valor.';
