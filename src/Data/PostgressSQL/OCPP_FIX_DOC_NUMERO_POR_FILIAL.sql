-- ============================================================================
-- OCPP: renumerar doc_numero por FILIAL (1, 2, 3... para cada filial_nome)
-- Assim: 1º doc da BELA = 1, 2º = 2, ...; 1º doc da PETRUZ = 1, 2º = 2, ...
-- Execute no SQL Editor do Supabase (após OCPP_ADD_DOC_NUMERO.sql).
-- ============================================================================

WITH doc_groups AS (
  SELECT data, filial_nome, MIN(id) AS min_id
  FROM "OCPP"
  GROUP BY data, filial_nome
),
numbered AS (
  SELECT data, filial_nome,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(filial_nome, '')
           ORDER BY data, min_id
         ) AS rn
  FROM doc_groups
)
UPDATE "OCPP" o
SET doc_numero = n.rn
FROM numbered n
WHERE o.data = n.data
  AND (o.filial_nome IS NOT DISTINCT FROM n.filial_nome);

COMMENT ON COLUMN "OCPP".doc_numero IS 'Número do documento por ordem de cadastro (1, 2, 3...) por filial_nome. NULL = documento legado.';
