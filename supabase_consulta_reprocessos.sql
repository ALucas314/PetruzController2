-- ============================================================
-- Consultas para REPROCESSOS no Supabase (tabela OCPD)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1) Ver todos os reprocessos (extraídos da coluna JSONB "reprocessos" da OCPD)
-- Cada linha é um item do array reprocessos com dados do documento (data_dia, filial, etc.)
SELECT 
  o.id AS ocpd_id,
  o.data_dia,
  o.filial_nome,
  o.doc_id,
  r.elem->>'numero'    AS numero,
  r.elem->>'tipo'      AS tipo,
  r.elem->>'linha'     AS linha,
  r.elem->>'codigo'    AS codigo,
  r.elem->>'descricao' AS descricao,
  (r.elem->>'quantidade')::numeric AS quantidade
FROM "OCPD" o,
     jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE o.reprocessos IS NOT NULL
  AND jsonb_array_length(o.reprocessos) > 0
ORDER BY o.data_dia DESC, o.id, (r.elem->>'numero')::int;


-- 2) Reprocessos cujo nome contém "ACAÍ REPROCESSO CLA 12 TB" (busca na coluna JSONB)
SELECT 
  o.id AS ocpd_id,
  o.data_dia,
  o.filial_nome,
  o.doc_id,
  r.elem->>'numero'    AS numero,
  r.elem->>'tipo'      AS tipo,
  r.elem->>'linha'     AS linha,
  r.elem->>'codigo'    AS codigo,
  r.elem->>'descricao' AS descricao,
  (r.elem->>'quantidade')::numeric AS quantidade
FROM "OCPD" o,
     jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE o.reprocessos IS NOT NULL
  AND (r.elem->>'descricao') ILIKE '%ACAÍ REPROCESSO CLA 12 TB%'
ORDER BY o.data_dia DESC, o.id;


-- 3) Se existirem colunas antigas reprocesso_* na OCPD (registros legado)
SELECT id, data_dia, filial_nome, doc_id,
       reprocesso_numero, reprocesso_tipo, reprocesso_linha,
       reprocesso_codigo, reprocesso_descricao, reprocesso_quantidade
FROM "OCPD"
WHERE reprocesso_descricao IS NOT NULL
  AND reprocesso_descricao ILIKE '%ACAÍ REPROCESSO CLA 12 TB%'
ORDER BY data_dia DESC, id;


-- 4) Resumo: apenas documentos (OCPD) que contêm o reprocesso "ACAÍ REPROCESSO CLA 12 TB"
SELECT DISTINCT o.id, o.data_dia, o.filial_nome, o.doc_id
FROM "OCPD" o
WHERE o.reprocessos IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(o.reprocessos) AS r(elem)
    WHERE (r.elem->>'descricao') ILIKE '%ACAÍ REPROCESSO CLA 12 TB%'
  )
ORDER BY o.data_dia DESC, o.id;
