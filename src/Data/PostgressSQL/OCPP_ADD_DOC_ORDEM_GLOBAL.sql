-- ============================================================================
-- OCPP: adicionar doc_ordem_global (sequencial 1, 2, 3... independente de filial)
-- Ordem por (data, id). Cada grupo (data, filial_nome) recebe o próximo número.
-- Execute no SQL Editor do Supabase (após OCPP_ADD_FILIAL_NOME.sql).
-- ============================================================================

ALTER TABLE "OCPP"
  ADD COLUMN IF NOT EXISTS doc_ordem_global INTEGER;

COMMENT ON COLUMN "OCPP".doc_ordem_global IS 'Ordem global do documento (1, 2, 3...) por data e id. Cada grupo (data, filial_nome) recebe o próximo número.';

-- Preencher: um número por (data, filial_nome) em ordem global (data, min_id)
WITH doc_groups AS (
  SELECT data, filial_nome, MIN(id) AS min_id
  FROM "OCPP"
  GROUP BY data, filial_nome
),
numbered AS (
  SELECT data, filial_nome,
         ROW_NUMBER() OVER (ORDER BY data, min_id) AS rn
  FROM doc_groups
)
UPDATE "OCPP" o
SET doc_ordem_global = n.rn
FROM numbered n
WHERE o.data = n.data
  AND (o.filial_nome IS NOT DISTINCT FROM n.filial_nome);

CREATE INDEX IF NOT EXISTS idx_ocpp_doc_ordem_global ON "OCPP"(doc_ordem_global);
