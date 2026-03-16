-- ============================================================================
-- OCPP: adicionar doc_numero (número 1, 2, 3... por data + filial_nome)
-- Para exibir "Doc. 1", "Doc. 2" em vez do id. Agrupa por (data, filial_nome).
-- Execute no SQL Editor do Supabase (após OCPP_ADD_FILIAL_NOME.sql).
-- ============================================================================

ALTER TABLE "OCPP"
  ADD COLUMN IF NOT EXISTS doc_numero INTEGER;

COMMENT ON COLUMN "OCPP".doc_numero IS 'Número do documento por ordem de cadastro (1, 2, 3...) por filial_nome. NULL = documento legado.';

-- Preencher documentos existentes: 1º doc (data+filial) = 1, 2º = 2, etc. (ordenado por data e id)
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

CREATE INDEX IF NOT EXISTS idx_ocpp_doc_numero ON "OCPP"(data, filial_nome, doc_numero);
