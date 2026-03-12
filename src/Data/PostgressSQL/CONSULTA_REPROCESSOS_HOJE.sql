-- ============================================================================
-- Consulta: Reprocessos cadastrados HOJE (data_dia = data atual)
-- Considera: coluna JSONB "reprocessos" e colunas reprocesso_* na OCPD
-- Execute no SQL Editor do Supabase
-- ============================================================================

-- Opção 1: Reprocessos do JSONB (reprocessos) — somente da data de hoje
SELECT
  o.data_dia,
  o.filial_nome,
  o.doc_id,
  (r.elem->>'numero')::int     AS numero,
  r.elem->>'tipo'             AS tipo,
  r.elem->>'linha'            AS linha,
  r.elem->>'codigo'           AS codigo,
  r.elem->>'descricao'        AS descricao,
  (r.elem->>'quantidade')::numeric(15,2) AS quantidade,
  'JSONB' AS origem
FROM "OCPD" o,
     jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE o.data_dia = CURRENT_DATE
  AND o.reprocessos IS NOT NULL
  AND jsonb_array_length(o.reprocessos) > 0
ORDER BY o.filial_nome, (r.elem->>'numero')::int;


-- Opção 2: Reprocessos das colunas individuais (reprocesso_*) — somente hoje
-- (uma linha OCPD = uma linha de produção que pode ter um reprocesso nas colunas)
SELECT
  o.data_dia,
  o.filial_nome,
  o.doc_id,
  o.reprocesso_numero        AS numero,
  o.reprocesso_tipo          AS tipo,
  o.reprocesso_linha         AS linha,
  o.reprocesso_codigo        AS codigo,
  o.reprocesso_descricao     AS descricao,
  o.reprocesso_quantidade    AS quantidade,
  'Colunas' AS origem
FROM "OCPD" o
WHERE o.data_dia = CURRENT_DATE
  AND (o.reprocesso_codigo IS NOT NULL AND TRIM(o.reprocesso_codigo) != ''
       OR o.reprocesso_numero IS NOT NULL)
ORDER BY o.filial_nome, o.reprocesso_numero;


-- Opção 3: TUDO (JSONB + colunas) em uma única lista — somente hoje
-- Primeiro os do JSONB, depois os das colunas
(
  SELECT
    o.data_dia,
    o.filial_nome,
    o.doc_id,
    (r.elem->>'numero')::int     AS numero,
    r.elem->>'tipo'             AS tipo,
    r.elem->>'linha'            AS linha,
    r.elem->>'codigo'           AS codigo,
    r.elem->>'descricao'        AS descricao,
    (r.elem->>'quantidade')::numeric(15,2) AS quantidade
  FROM "OCPD" o,
       jsonb_array_elements(o.reprocessos) AS r(elem)
  WHERE o.data_dia = CURRENT_DATE
    AND o.reprocessos IS NOT NULL
    AND jsonb_array_length(o.reprocessos) > 0
)
UNION ALL
(
  SELECT
    o.data_dia,
    o.filial_nome,
    o.doc_id,
    o.reprocesso_numero,
    o.reprocesso_tipo,
    o.reprocesso_linha,
    o.reprocesso_codigo,
    o.reprocesso_descricao,
    o.reprocesso_quantidade
  FROM "OCPD" o
  WHERE o.data_dia = CURRENT_DATE
    AND (o.reprocesso_codigo IS NOT NULL AND TRIM(o.reprocesso_codigo) != ''
         OR o.reprocesso_numero IS NOT NULL)
)
ORDER BY filial_nome, numero;


-- Opção 4: Resumo de hoje por filial (qtd de reprocessos e totais Cortado/Usado)
SELECT
  o.data_dia,
  o.filial_nome,
  jsonb_array_length(o.reprocessos) AS qtd_reprocessos,
  (SELECT COALESCE(SUM((elem->>'quantidade')::numeric), 0)
   FROM jsonb_array_elements(o.reprocessos) AS elem
   WHERE (elem->>'tipo') = 'Cortado') AS total_cortado,
  (SELECT COALESCE(SUM((elem->>'quantidade')::numeric), 0)
   FROM jsonb_array_elements(o.reprocessos) AS elem
   WHERE (elem->>'tipo') = 'Usado') AS total_usado
FROM "OCPD" o
WHERE o.data_dia = CURRENT_DATE
  AND o.reprocessos IS NOT NULL
  AND jsonb_array_length(o.reprocessos) > 0
GROUP BY o.data_dia, o.filial_nome, o.reprocessos
ORDER BY o.filial_nome;
