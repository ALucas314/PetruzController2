-- ============================================================================
-- Consulta: apenas códigos e descrições com base no grupo de itens REPROCESSOS
-- Tabela: OCTI (Objeto de cadastro de tabela de itens)
-- ============================================================================

SELECT
    "Code" AS codigo,
    "Name" AS descricao
FROM "OCTI"
WHERE UPPER(TRIM("U_ItemGroup")) LIKE '%REPROCESSO%'
ORDER BY "Code";
