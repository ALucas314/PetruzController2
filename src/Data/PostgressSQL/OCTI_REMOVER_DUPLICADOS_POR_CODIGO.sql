-- ============================================================================
-- OCTI: consultar itens com CÓDIGO duplicado
-- (mesmo código em formatos diferentes: 00037, 037, 37)
-- Execute no Supabase SQL Editor.
-- ============================================================================

WITH cod_norm AS (
  SELECT
    id,
    "Code",
    "Name",
    "U_Uom",
    "U_ItemGroup",
    CASE
      WHEN TRIM("Code") ~ '^[0-9]+$' AND LTRIM(TRIM("Code"), '0') <> ''
        THEN LTRIM(TRIM("Code"), '0')
      WHEN TRIM("Code") ~ '^[0-9]+$'
        THEN '0'
      ELSE TRIM("Code")
    END AS code_normalizado
  FROM "OCTI"
),
duplicados AS (
  SELECT code_normalizado
  FROM cod_norm
  GROUP BY code_normalizado
  HAVING COUNT(*) > 1
)
SELECT id, "Code", "Name", "U_Uom", "U_ItemGroup", code_normalizado
FROM cod_norm
WHERE code_normalizado IN (SELECT code_normalizado FROM duplicados)
ORDER BY code_normalizado, id;
