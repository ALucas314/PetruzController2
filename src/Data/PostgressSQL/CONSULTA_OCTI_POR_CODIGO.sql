-- ============================================================================
-- Consultar item na OCTI por código (Supabase SQL Editor)
-- A coluna "Code" tem aspas no banco, então use "Code" e o valor como texto.
-- ============================================================================

-- Quantos itens estão cadastrados na OCTI
SELECT COUNT(*) AS total_itens FROM "OCTI";

-- Possíveis duplicados: mesmo "Name" com códigos diferentes (ex.: 00001 vs 0001)
SELECT "Code", "Name", COUNT(*) OVER (PARTITION BY TRIM(LOWER("Name"))) AS qtd_mesmo_nome
FROM "OCTI"
ORDER BY qtd_mesmo_nome DESC, "Name";

-- Últimos itens inseridos (se a tabela tiver created_at)
-- SELECT id, "Code", "Name", created_at FROM "OCTI" ORDER BY created_at DESC NULLS LAST LIMIT 20;

-- Exemplo: buscar código 22247
-- SELECT * FROM "OCTI" WHERE "Code" = '22247';

-- Buscar por vários códigos
-- SELECT * FROM "OCTI" WHERE "Code" IN ('22247', '00001', '00004');
