-- ============================================================================
-- Consulta: Listar registros da tabela OCPD e identificar os que estão vazios
-- (nada preenchido nos campos principais)
-- Execute no SQL Editor do Supabase (PostgreSQL)
-- ============================================================================

-- 1) TODOS os registros OCPD (colunas principais)
-- Use para ver todos os registros da tabela
SELECT
  id,
  data_dia,
  data_cabecalho,
  filial_nome,
  line_id,
  op,
  codigo_item,
  descricao_item,
  linha,
  qtd_planejada,
  qtd_realizada,
  diferenca,
  observacao,
  created_at,
  updated_at
FROM "OCPD"
ORDER BY id DESC;

-- ============================================================================
-- 2) APENAS registros VAZIOS (onde não tem nada preenchido nos campos principais)
-- Um registro é considerado vazio quando:
--   op, codigo_item, descricao_item e linha estão vazios/null
--   e qtd_planejada e qtd_realizada são 0 ou null
-- ============================================================================
SELECT
  id,
  data_dia,
  data_cabecalho,
  filial_nome,
  line_id,
  op,
  codigo_item,
  descricao_item,
  linha,
  qtd_planejada,
  qtd_realizada,
  created_at,
  updated_at
FROM "OCPD"
WHERE (TRIM(COALESCE(op, '')) = '')
  AND (TRIM(COALESCE(codigo_item, '')) = '')
  AND (TRIM(COALESCE(descricao_item, '')) = '')
  AND (TRIM(COALESCE(linha, '')) = '')
  AND (COALESCE(qtd_planejada, 0) = 0)
  AND (COALESCE(qtd_realizada, 0) = 0)
ORDER BY id DESC;

-- ============================================================================
-- 3) Resumo: total de registros e quantos estão vazios
-- ============================================================================
SELECT
  (SELECT COUNT(*) FROM "OCPD") AS total_registros,
  (SELECT COUNT(*)
   FROM "OCPD"
   WHERE (TRIM(COALESCE(op, '')) = '')
     AND (TRIM(COALESCE(codigo_item, '')) = '')
     AND (TRIM(COALESCE(descricao_item, '')) = '')
     AND (TRIM(COALESCE(linha, '')) = '')
     AND (COALESCE(qtd_planejada, 0) = 0)
     AND (COALESCE(qtd_realizada, 0) = 0)
  ) AS registros_vazios;

-- ============================================================================
-- 4) DELETAR registro OCPD por ID (exemplo: id = 132)
-- Execute apenas esta parte no SQL Editor para remover o registro.
-- ============================================================================
DELETE FROM "OCPD"
WHERE id = 132;
