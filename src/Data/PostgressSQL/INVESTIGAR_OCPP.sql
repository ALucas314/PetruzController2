-- ============================================================================
-- Investigar tabela OCPP no Supabase
-- Copie e execute no SQL Editor do Supabase (Dashboard > SQL Editor > New query)
-- ============================================================================

-- 1) A tabela existe?
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'OCPP'
) AS "Tabela OCPP existe?";

-- 2) Colunas da tabela OCPP (nome, tipo, nullable, default)
SELECT
  ordinal_position AS "Ordem",
  column_name AS "Coluna",
  data_type AS "Tipo",
  character_maximum_length AS "Max length",
  numeric_precision AS "Precision",
  numeric_scale AS "Scale",
  is_nullable AS "Nullable",
  column_default AS "Default"
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'OCPP'
ORDER BY ordinal_position;

-- 3) Contagem de linhas
SELECT COUNT(*) AS "Total de registros" FROM "OCPP";

-- 4) Amostra dos primeiros 5 registros (todas as colunas)
SELECT * FROM "OCPP" ORDER BY id ASC LIMIT 5;

-- 5) Índices da tabela OCPP
SELECT
  indexname AS "Índice",
  indexdef AS "Definição"
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'OCPP';

-- 6) RLS (Row Level Security) ativo?
SELECT
  relname AS "Tabela",
  relrowsecurity AS "RLS ativo"
FROM pg_class
WHERE relname = 'OCPP';

-- 7) Políticas RLS na tabela OCPP
SELECT
  policyname AS "Política",
  permissive AS "Permissiva",
  roles AS "Roles",
  cmd AS "Comando",
  qual AS "USING",
  with_check AS "WITH CHECK"
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'OCPP';

-- 8) Quais colunas o frontend usa existem na tabela?
-- (previsao_latas = base; Previsão_Latas = alternativa; filial_nome, doc_* = migrations)
SELECT
  esperadas.col AS "Coluna",
  CASE WHEN c.column_name IS NOT NULL THEN 'SIM' ELSE 'NÃO' END AS "Existe?"
FROM (SELECT unnest(ARRAY[
  'id','data','op','Code','descricao','unidade','grupo','quantidade','quantidade_latas',
  'previsao_latas','quantidade_kg','tipo_fruto','tipo_linha','unidade_base','unidade_chapa',
  'solidos','solid','quantidade_kg_tuneo','quantidade_liquida_prevista','cort_solid','t_cort',
  'quantidade_basqueta','quantidade_chapa','latas','estrutura','basqueta','chapa','tuneo',
  'qual_maquina','mao_de_obra','utilidade','estoque','timbragem','corte_reprocesso','observacao',
  'filial_nome','doc_ordem_global','doc_numero','created_at','updated_at'
]) AS col) esperadas
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'OCPP' AND c.column_name = esperadas.col
ORDER BY esperadas.col;
