-- ============================================================================
-- OCTI: itens cujo código tem menos de 5 caracteres
-- Ex.: 1 -> deveria ser 00001, 1037 -> 01037
-- Execute no Supabase SQL Editor.
-- ============================================================================

SELECT
  id,
  "Code" AS codigo_atual,
  LENGTH(TRIM("Code")) AS qtd_caracteres,
  LPAD(TRIM("Code"), 5, '0') AS codigo_com_5_chars,
  "Name",
  "U_Uom",
  "U_ItemGroup"
FROM "OCTI"
WHERE TRIM("Code") ~ '^[0-9]+$'   -- só códigos numéricos
  AND LENGTH(TRIM("Code")) < 5
ORDER BY LENGTH(TRIM("Code")), "Code";
