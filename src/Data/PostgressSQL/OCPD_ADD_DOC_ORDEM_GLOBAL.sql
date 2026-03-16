-- ============================================================================
-- OCPD: adicionar doc_ordem_global (sequencial 1, 2, 3... independente de filial)
-- Ex.: 1=BELA, 2=PETRUZ, 3=BELA, 4=PETRUZ... (ordem por data_dia e id)
-- Coluna fica antes de doc_numero na lógica (ordem global do documento).
-- Execute no SQL Editor do Supabase.
-- ============================================================================

ALTER TABLE "OCPD"
  ADD COLUMN IF NOT EXISTS doc_ordem_global INTEGER;

COMMENT ON COLUMN "OCPD".doc_ordem_global IS 'Ordem global do documento (1, 2, 3...) independente de filial. Cada documento recebe o próximo número na ordem data_dia, id.';

-- Preencher: um número por (data_dia, filial_nome, doc_id) em ordem global (data_dia, min_id)
WITH doc_groups AS (
  SELECT data_dia, filial_nome, doc_id, MIN(id) AS min_id
  FROM "OCPD"
  GROUP BY data_dia, filial_nome, doc_id
),
numbered AS (
  SELECT data_dia, filial_nome, doc_id,
         ROW_NUMBER() OVER (ORDER BY data_dia, min_id) AS rn
  FROM doc_groups
)
UPDATE "OCPD" o
SET doc_ordem_global = n.rn
FROM numbered n
WHERE o.data_dia = n.data_dia
  AND (o.filial_nome IS NOT DISTINCT FROM n.filial_nome)
  AND (o.doc_id IS NOT DISTINCT FROM n.doc_id);

CREATE INDEX IF NOT EXISTS idx_ocpd_doc_ordem_global ON "OCPD"(doc_ordem_global);
