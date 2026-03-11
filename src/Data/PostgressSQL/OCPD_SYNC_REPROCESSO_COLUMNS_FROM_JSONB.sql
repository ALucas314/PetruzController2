-- ============================================================================
-- Estruturar nas colunas os dados que já estão no JSONB "reprocessos"
-- Copia o 1º elemento do array para as colunas reprocesso_* e calcula os totais.
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

-- 1) Opcional: conferir o que será gravado (rode só o SELECT, depois rode o UPDATE)
/*
SELECT
  o.id,
  o.data_dia,
  o.filial_nome,
  o.reprocessos->0->>'numero'     AS novo_reprocesso_numero,
  o.reprocessos->0->>'tipo'       AS novo_reprocesso_tipo,
  o.reprocessos->0->>'linha'      AS novo_reprocesso_linha,
  o.reprocessos->0->>'codigo'     AS novo_reprocesso_codigo,
  o.reprocessos->0->>'descricao'  AS novo_reprocesso_descricao,
  o.reprocessos->0->>'quantidade' AS novo_reprocesso_quantidade
FROM "OCPD" o
WHERE o.reprocessos IS NOT NULL
  AND jsonb_typeof(o.reprocessos) = 'array'
  AND jsonb_array_length(o.reprocessos) > 0;
*/

-- 2) Atualizar: preencher colunas a partir do JSONB (1º elemento + totais)
UPDATE "OCPD" o
SET
  reprocesso_numero        = (o.reprocessos->0->>'numero')::INT,
  reprocesso_tipo          = COALESCE(NULLIF(TRIM(o.reprocessos->0->>'tipo'), ''), 'Cortado'),
  reprocesso_linha         = NULLIF(TRIM(COALESCE(o.reprocessos->0->>'linha', '')), ''),
  reprocesso_codigo        = NULLIF(TRIM(o.reprocessos->0->>'codigo'), ''),
  reprocesso_descricao     = NULLIF(TRIM(o.reprocessos->0->>'descricao'), ''),
  reprocesso_quantidade    = COALESCE((o.reprocessos->0->>'quantidade')::NUMERIC, 0),
  reprocesso_total_cortado = (
    SELECT COALESCE(SUM((elem->>'quantidade')::NUMERIC), 0)
    FROM jsonb_array_elements(o.reprocessos) AS elem
    WHERE elem->>'tipo' = 'Cortado'
  ),
  reprocesso_total_usado   = (
    SELECT COALESCE(SUM((elem->>'quantidade')::NUMERIC), 0)
    FROM jsonb_array_elements(o.reprocessos) AS elem
    WHERE elem->>'tipo' = 'Usado'
  ),
  total_reprocesso_usado   = (
    SELECT COALESCE(SUM((elem->>'quantidade')::NUMERIC), 0)
    FROM jsonb_array_elements(o.reprocessos) AS elem
  )
WHERE o.reprocessos IS NOT NULL
  AND jsonb_typeof(o.reprocessos) = 'array'
  AND jsonb_array_length(o.reprocessos) > 0;
