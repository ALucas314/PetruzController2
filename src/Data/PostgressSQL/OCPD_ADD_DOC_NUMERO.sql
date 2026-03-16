-- ============================================================================
-- OCPD: adicionar doc_numero (número simples 1, 2, 3... por data + filial)
-- Para exibir "Doc. 1", "Doc. 2" em vez do UUID longo.
-- Execute no SQL Editor do Supabase.
-- ============================================================================

ALTER TABLE "OCPD"
  ADD COLUMN IF NOT EXISTS doc_numero INTEGER;

COMMENT ON COLUMN "OCPD".doc_numero IS 'Número do documento por ordem de cadastro (1, 2, 3...) por filial_nome. NULL = documento legado.';

-- Preencher documentos existentes: 1º doc da filial = 1, 2º = 2, etc. (ordenado por data_dia e id)
WITH doc_groups AS (
  SELECT data_dia, filial_nome, doc_id, MIN(id) AS min_id
  FROM "OCPD"
  GROUP BY data_dia, filial_nome, doc_id
),
numbered AS (
  SELECT data_dia, filial_nome, doc_id,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(filial_nome, '') ORDER BY data_dia, min_id) AS rn
  FROM doc_groups
)
UPDATE "OCPD" o
SET doc_numero = n.rn
FROM numbered n
WHERE o.data_dia = n.data_dia
  AND (o.filial_nome IS NOT DISTINCT FROM n.filial_nome)
  AND (o.doc_id IS NOT DISTINCT FROM n.doc_id);

CREATE INDEX IF NOT EXISTS idx_ocpd_doc_numero ON "OCPD"(data_dia, filial_nome, doc_numero);
