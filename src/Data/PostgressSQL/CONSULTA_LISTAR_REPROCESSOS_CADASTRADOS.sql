-- ============================================================================
-- Consulta: listar os reprocessos cadastrados (a partir da coluna reprocessos JSONB na OCPD)
-- Cada linha = um reprocesso, com data do dia e filial.
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

-- Opção 1: Listar todos os reprocessos (um registro por reprocesso)
SELECT
  o.data_dia,
  o.filial_nome,
  (r.elem->>'numero')::int     AS numero,
  r.elem->>'tipo'             AS tipo,
  r.elem->>'codigo'           AS codigo,
  r.elem->>'descricao'        AS descricao,
  (r.elem->>'quantidade')::numeric(15,2) AS quantidade
FROM "OCPD" o,
     jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE jsonb_array_length(o.reprocessos) > 0
ORDER BY o.data_dia DESC, o.filial_nome, (r.elem->>'numero')::int;


-- Opção 2: Filtrar por data (ex.: um dia específico)
/*
SELECT
  o.data_dia,
  o.filial_nome,
  (r.elem->>'numero')::int     AS numero,
  r.elem->>'tipo'             AS tipo,
  r.elem->>'codigo'           AS codigo,
  r.elem->>'descricao'        AS descricao,
  (r.elem->>'quantidade')::numeric(15,2) AS quantidade
FROM "OCPD" o,
     jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE jsonb_array_length(o.reprocessos) > 0
  AND o.data_dia = '2026-03-06'
ORDER BY o.filial_nome, (r.elem->>'numero')::int;
*/


-- Opção 3: Filtrar por filial (nome completo)
/*
SELECT
  o.data_dia,
  o.filial_nome,
  (r.elem->>'numero')::int     AS numero,
  r.elem->>'tipo'             AS tipo,
  r.elem->>'codigo'           AS codigo,
  r.elem->>'descricao'        AS descricao,
  (r.elem->>'quantidade')::numeric(15,2) AS quantidade
FROM "OCPD" o,
     jsonb_array_elements(o.reprocessos) AS r(elem)
WHERE jsonb_array_length(o.reprocessos) > 0
  AND o.filial_nome = 'BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA'
ORDER BY o.data_dia DESC, (r.elem->>'numero')::int;
*/


-- Opção 4: Resumo por data + filial (quantidade de reprocessos e totais)
SELECT
  o.data_dia,
  o.filial_nome,
  jsonb_array_length(o.reprocessos) AS qtd_reprocessos,
  (SELECT SUM((elem->>'quantidade')::numeric)
   FROM jsonb_array_elements(o.reprocessos) AS elem
   WHERE (elem->>'tipo') = 'Cortado') AS total_cortado,
  (SELECT SUM((elem->>'quantidade')::numeric)
   FROM jsonb_array_elements(o.reprocessos) AS elem
   WHERE (elem->>'tipo') = 'Usado')  AS total_usado
FROM "OCPD" o
WHERE jsonb_array_length(o.reprocessos) > 0
GROUP BY o.data_dia, o.filial_nome, o.reprocessos
ORDER BY o.data_dia DESC, o.filial_nome;
