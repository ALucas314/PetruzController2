-- ============================================================================
-- Total de reprocesso CORTADO no intervalo de data_dia, por filial (OCPD)
-- Fonte: JSONB "reprocessos" + colunas legado reprocesso_* quando JSON vazio
-- Execute no SQL Editor do Supabase (PostgreSQL)
-- ============================================================================
-- Ajuste datas e lista de filiais em filtro_filial (nomes exatos = OCPD / OCTF).

-- Datas (inclusive)
-- -----------------------------------------------------------------------------
WITH params AS (
  SELECT
    DATE '2026-03-01' AS data_ini,
    DATE '2026-03-28' AS data_fim
),
-- Filiais: uma linha por nome exato em OCPD.filial_nome (cadastro OCTF)
filtro_filial AS (
  SELECT 'BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA'::text AS filial_nome
  UNION ALL
  SELECT 'PETRUZ FRUITY INDUSTRIA, COMERCIO E DISTRIBUIDORA LTDA - PA'::text
),
-- Soma JSONB por filial (tipo Cortado, case-insensitive)
jsonb_cortado_por_filial AS (
  SELECT
    o.filial_nome,
    COALESCE(SUM((r.elem->>'quantidade')::numeric), 0) AS total
  FROM "OCPD" o
  CROSS JOIN params p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.reprocessos, '[]'::jsonb)) AS r(elem)
  WHERE o.data_dia >= p.data_ini
    AND o.data_dia <= p.data_fim
    AND o.reprocessos IS NOT NULL
    AND jsonb_typeof(o.reprocessos) = 'array'
    AND jsonb_array_length(o.reprocessos) > 0
    AND LOWER(TRIM(COALESCE(r.elem->>'tipo', ''))) = 'cortado'
    AND o.filial_nome IN (SELECT filial_nome FROM filtro_filial)
  GROUP BY o.filial_nome
),
-- Legado por filial (sem array preenchido)
legado_cortado_por_filial AS (
  SELECT
    o.filial_nome,
    COALESCE(SUM(o.reprocesso_quantidade::numeric), 0) AS total
  FROM "OCPD" o
  CROSS JOIN params p
  WHERE o.data_dia >= p.data_ini
    AND o.data_dia <= p.data_fim
    AND (
      o.reprocessos IS NULL
      OR jsonb_typeof(o.reprocessos) <> 'array'
      OR jsonb_array_length(o.reprocessos) = 0
    )
    AND TRIM(COALESCE(o.reprocesso_codigo, '')) <> ''
    AND LOWER(TRIM(COALESCE(o.reprocesso_tipo, ''))) = 'cortado'
    AND o.filial_nome IN (SELECT filial_nome FROM filtro_filial)
  GROUP BY o.filial_nome
),
detalhe AS (
  SELECT
    f.filial_nome,
    COALESCE(j.total, 0) AS total_cortado_jsonb,
    COALESCE(l.total, 0) AS total_cortado_legado,
    COALESCE(j.total, 0) + COALESCE(l.total, 0) AS total_cortado_geral
  FROM filtro_filial f
  LEFT JOIN jsonb_cortado_por_filial j ON j.filial_nome = f.filial_nome
  LEFT JOIN legado_cortado_por_filial l ON l.filial_nome = f.filial_nome
)
SELECT
  (SELECT data_ini FROM params) AS periodo_de,
  (SELECT data_fim FROM params) AS periodo_ate,
  filial_nome,
  total_cortado_jsonb,
  total_cortado_legado,
  total_cortado_geral
FROM detalhe
UNION ALL
SELECT
  (SELECT data_ini FROM params),
  (SELECT data_fim FROM params),
  '» CONSOLIDADO (soma das filiais do filtro)'::text,
  SUM(total_cortado_jsonb),
  SUM(total_cortado_legado),
  SUM(total_cortado_geral)
FROM detalhe
ORDER BY
  CASE WHEN filial_nome LIKE '»%' THEN 1 ELSE 0 END,
  filial_nome;

-- ============================================================================
-- Versão rápida (sem linha consolidada): BELA ou PETRUZ por ILIKE
-- Descomente e ajuste datas se preferir:
-- ============================================================================
/*
SELECT
  o.filial_nome,
  COALESCE(SUM((r.elem->>'quantidade')::numeric), 0) AS total_cortado_jsonb
FROM "OCPD" o
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.reprocessos, '[]'::jsonb)) AS r(elem)
WHERE o.data_dia BETWEEN DATE '2026-03-01' AND DATE '2026-03-28'
  AND (o.filial_nome ILIKE '%BELA IACA%' OR o.filial_nome ILIKE '%PETRUZ FRUITY%')
  AND jsonb_typeof(o.reprocessos) = 'array'
  AND jsonb_array_length(o.reprocessos) > 0
  AND LOWER(TRIM(COALESCE(r.elem->>'tipo', ''))) = 'cortado'
GROUP BY o.filial_nome
ORDER BY o.filial_nome;
*/
