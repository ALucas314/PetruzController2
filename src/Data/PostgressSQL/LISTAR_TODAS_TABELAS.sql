-- ============================================================================
-- Listar todas as tabelas do banco (schema public)
-- Execute no Supabase: SQL Editor → New query → cole e clique Run
-- ============================================================================

-- Opção 1: tabelas do schema public (resumido)
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('public', 'auth')
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;

-- Opção 2: com quantidade de colunas (só public)
SELECT
  t.table_schema,
  t.table_name,
  (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS colunas
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
