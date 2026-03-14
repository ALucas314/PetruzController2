-- ============================================================================
-- OCTI: remover duplicados por nome (mesma descrição "Name", códigos diferentes)
-- Mantém 1 registro por nome (o de menor id). Execute no Supabase SQL Editor.
-- ============================================================================

-- 1) VER quantos registros seriam removidos (duplicados por "Name")
SELECT COUNT(*) AS registros_a_remover
FROM "OCTI" a
WHERE EXISTS (
  SELECT 1 FROM "OCTI" b
  WHERE TRIM(LOWER(b."Name")) = TRIM(LOWER(a."Name"))
    AND b.id < a.id
);

-- 2) LISTAR os duplicados (nome + código que fica x código que seria removido)
SELECT
  TRIM("Name") AS nome,
  (SELECT "Code" FROM "OCTI" b
   WHERE TRIM(LOWER(b."Name")) = TRIM(LOWER(a."Name"))
   ORDER BY b.id ASC LIMIT 1) AS codigo_mantido,
  a."Code" AS codigo_removido,
  a.id AS id_removido
FROM "OCTI" a
WHERE EXISTS (
  SELECT 1 FROM "OCTI" b
  WHERE TRIM(LOWER(b."Name")) = TRIM(LOWER(a."Name"))
    AND b.id < a.id
)
ORDER BY nome, a.id;

-- 3) REMOVER duplicados (mantém o registro com menor id por nome)
-- Descomente e execute só depois de conferir os resultados acima.
/*
DELETE FROM "OCTI" a
WHERE EXISTS (
  SELECT 1 FROM "OCTI" b
  WHERE TRIM(LOWER(b."Name")) = TRIM(LOWER(a."Name"))
    AND b.id < a.id
);
*/

-- 4) Conferir total após a limpeza
-- SELECT COUNT(*) AS total_itens FROM "OCTI";

-- ============================================================================
-- Se no CSV só havia 2 repetidos (total certo = 5914, banco = 5916):
-- Remover apenas os 2 últimos inseridos (provavelmente os duplicados da importação).
-- ============================================================================

-- Ver os 2 últimos inseridos (conferir antes de apagar)
SELECT id, "Code", "Name", created_at
FROM "OCTI"
ORDER BY created_at DESC NULLS LAST
LIMIT 2;

-- Remover só esses 2 (descomente e execute após conferir acima)
/*
DELETE FROM "OCTI"
WHERE id IN (
  SELECT id FROM "OCTI"
  ORDER BY created_at DESC NULLS LAST
  LIMIT 2
);
*/

-- Se souber os 2 códigos que estão a mais, pode apagar por código:
-- DELETE FROM "OCTI" WHERE "Code" IN ('CODIGO1', 'CODIGO2');
