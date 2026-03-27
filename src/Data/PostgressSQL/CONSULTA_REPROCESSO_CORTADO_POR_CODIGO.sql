-- ============================================================================
-- Quanto foi CORTADO do reprocesso com código informado (ex.: 06898)
-- Fonte: coluna JSONB "reprocessos" na OCPD (tipo = Cortado)
-- Opcional: registros legado nas colunas reprocesso_* (sem JSON ou vazio)
-- Execute no SQL Editor do Supabase (PostgreSQL)
-- ============================================================================

-- Parâmetro: troque '06898' em todas as cláusulas abaixo pelo código desejado
-- (no Supabase não use comandos psql como \set).

-- ---------------------------------------------------------------------------
-- 1) TOTAL GERAL cortado (soma de todas as filiais e datas) — só JSONB
-- ---------------------------------------------------------------------------
SELECT
  TRIM(r.elem->>'codigo') AS codigo,
  COALESCE(SUM((r.elem->>'quantidade')::numeric), 0) AS total_cortado
FROM "OCPD" o
CROSS JOIN LATERAL jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE o.reprocessos IS NOT NULL
  AND jsonb_typeof(o.reprocessos) = 'array'
  AND jsonb_array_length(o.reprocessos) > 0
  AND TRIM(COALESCE(r.elem->>'tipo', '')) = 'Cortado'
  AND TRIM(COALESCE(r.elem->>'codigo', '')) = '06898'
GROUP BY TRIM(r.elem->>'codigo');

-- ---------------------------------------------------------------------------
-- 2) Detalhe por data, filial e documento (auditoria)
-- ---------------------------------------------------------------------------
SELECT
  o.data_dia,
  o.filial_nome,
  o.doc_id,
  o.id AS ocpd_id,
  (r.elem->>'numero')::int AS numero_reprocesso,
  TRIM(r.elem->>'codigo') AS codigo,
  TRIM(r.elem->>'descricao') AS descricao,
  (r.elem->>'quantidade')::numeric(15, 2) AS quantidade_cortada
FROM "OCPD" o
CROSS JOIN LATERAL jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE o.reprocessos IS NOT NULL
  AND jsonb_typeof(o.reprocessos) = 'array'
  AND jsonb_array_length(o.reprocessos) > 0
  AND TRIM(COALESCE(r.elem->>'tipo', '')) = 'Cortado'
  AND TRIM(COALESCE(r.elem->>'codigo', '')) = '06898'
ORDER BY o.data_dia DESC, o.filial_nome, o.id, (r.elem->>'numero')::int;

-- ---------------------------------------------------------------------------
-- 3) Total cortado em um intervalo de data do documento (data_dia)
-- ---------------------------------------------------------------------------
/*
SELECT
  COALESCE(SUM((r.elem->>'quantidade')::numeric), 0) AS total_cortado_no_periodo
FROM "OCPD" o
CROSS JOIN LATERAL jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE o.reprocessos IS NOT NULL
  AND jsonb_array_length(o.reprocessos) > 0
  AND TRIM(COALESCE(r.elem->>'tipo', '')) = 'Cortado'
  AND TRIM(COALESCE(r.elem->>'codigo', '')) = '06898'
  AND o.data_dia >= DATE '2026-01-01'
  AND o.data_dia <= DATE '2026-12-31';
*/

-- ---------------------------------------------------------------------------
-- 4) Uma filial específica (nome exatamente como em OCPD.filial_nome)
-- ---------------------------------------------------------------------------
/*
SELECT
  COALESCE(SUM((r.elem->>'quantidade')::numeric), 0) AS total_cortado_filial
FROM "OCPD" o
CROSS JOIN LATERAL jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE o.reprocessos IS NOT NULL
  AND jsonb_array_length(o.reprocessos) > 0
  AND TRIM(COALESCE(r.elem->>'tipo', '')) = 'Cortado'
  AND TRIM(COALESCE(r.elem->>'codigo', '')) = '06898'
  AND o.filial_nome = 'BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA';
*/

-- ---------------------------------------------------------------------------
-- 5) Legado: colunas reprocesso_* (quando não há array reprocessos preenchido)
--    Cada linha OCPD pode repetir o mesmo doc — use DISTINCT ON ou doc_id.
--    Ajuste conforme seu padrão de gravação.
-- ---------------------------------------------------------------------------
SELECT
  COALESCE(SUM(o.reprocesso_quantidade::numeric), 0) AS total_cortado_legado
FROM "OCPD" o
WHERE (o.reprocessos IS NULL OR jsonb_array_length(COALESCE(o.reprocessos, '[]'::jsonb)) = 0)
  AND TRIM(COALESCE(o.reprocesso_tipo, '')) = 'Cortado'
  AND TRIM(COALESCE(o.reprocesso_codigo, '')) = '06898';

-- ---------------------------------------------------------------------------
-- 6) Soma única JSONB + legado (evite contar o mesmo doc duas vezes: aqui
--    legado só quando JSON vazio; revise se seus dados misturam os dois)
-- ---------------------------------------------------------------------------
SELECT
  (
    SELECT COALESCE(SUM((r.elem->>'quantidade')::numeric), 0)
    FROM "OCPD" o2
    CROSS JOIN LATERAL jsonb_array_elements(o2.reprocessos) AS r(elem)
    WHERE o2.reprocessos IS NOT NULL
      AND jsonb_array_length(o2.reprocessos) > 0
      AND TRIM(COALESCE(r.elem->>'tipo', '')) = 'Cortado'
      AND TRIM(COALESCE(r.elem->>'codigo', '')) = '06898'
  )
  +
  (
    SELECT COALESCE(SUM(o3.reprocesso_quantidade::numeric), 0)
    FROM "OCPD" o3
    WHERE (o3.reprocessos IS NULL OR jsonb_array_length(COALESCE(o3.reprocessos, '[]'::jsonb)) = 0)
      AND TRIM(COALESCE(o3.reprocesso_tipo, '')) = 'Cortado'
      AND TRIM(COALESCE(o3.reprocesso_codigo, '')) = '06898'
  ) AS total_cortado_jsonb_mais_legado;
