-- ============================================================================
-- OCPD: renumerar doc_numero por FILIAL (1, 2, 3... para cada filial)
-- Assim: 1º doc da BELA = 1, 2º = 2, ...; 1º doc da PETRUZ = 1, 2º = 2, ...
-- Execute no SQL Editor do Supabase (após OCPD_ADD_DOC_NUMERO.sql).
-- ============================================================================

WITH doc_groups AS (
  SELECT data_dia, filial_nome, doc_id, MIN(id) AS min_id
  FROM "OCPD"
  GROUP BY data_dia, filial_nome, doc_id
),
numbered AS (
  SELECT data_dia, filial_nome, doc_id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(filial_nome, '')
           ORDER BY data_dia, min_id
         ) AS rn
  FROM doc_groups
)
UPDATE "OCPD" o
SET doc_numero = n.rn
FROM numbered n
WHERE o.data_dia = n.data_dia
  AND (o.filial_nome IS NOT DISTINCT FROM n.filial_nome)
  AND (o.doc_id IS NOT DISTINCT FROM n.doc_id);

-- Atualizar comentário da coluna
COMMENT ON COLUMN "OCPD".doc_numero IS 'Número do documento por ordem de cadastro (1, 2, 3...) por filial_nome. NULL = documento legado.';
