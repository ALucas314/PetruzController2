-- ============================================================================
-- Consulta simples para buscar itens da tabela OCTI
-- cujo grupo de itens contém "REPROCESSO"
-- ============================================================================

-- Opção 1: Busca exata (case-insensitive)
SELECT 
    "Code" AS codigo,
    "Name" AS descricao,
    "U_Uom" AS unidade_medida,
    "U_ItemGroup" AS grupo_itens
FROM "OCTI"
WHERE UPPER(TRIM("U_ItemGroup")) LIKE '%REPROCESSO%'
ORDER BY "Code";

-- Opção 2: Busca mais flexível (pode conter reprocesso em qualquer parte)
SELECT 
    "Code" AS codigo,
    "Name" AS descricao,
    "U_Uom" AS unidade_medida,
    "U_ItemGroup" AS grupo_itens
FROM "OCTI"
WHERE 
    UPPER(TRIM("U_ItemGroup")) LIKE '%REPROCESSO%'
    OR UPPER(TRIM("Name")) LIKE '%REPROCESSO%'
ORDER BY "Code";

-- Opção 3: Busca exata no grupo de itens
SELECT 
    "Code" AS codigo,
    "Name" AS descricao,
    "U_Uom" AS unidade_medida,
    "U_ItemGroup" AS grupo_itens
FROM "OCTI"
WHERE UPPER(TRIM("U_ItemGroup")) = 'REPROCESSO'
ORDER BY "Code";

-- Opção 4: Contagem de itens por grupo que contém REPROCESSO
SELECT 
    "U_ItemGroup" AS grupo_itens,
    COUNT(*) AS total_itens
FROM "OCTI"
WHERE UPPER(TRIM("U_ItemGroup")) LIKE '%REPROCESSO%'
GROUP BY "U_ItemGroup"
ORDER BY total_itens DESC;

-- Opção 5: Lista completa com estatísticas
SELECT 
    "Code" AS codigo,
    "Name" AS descricao,
    "U_Uom" AS unidade_medida,
    "U_ItemGroup" AS grupo_itens,
    COUNT(*) OVER (PARTITION BY "U_ItemGroup") AS total_no_grupo
FROM "OCTI"
WHERE UPPER(TRIM("U_ItemGroup")) LIKE '%REPROCESSO%'
ORDER BY "U_ItemGroup", "Code";

-- ============================================================================
-- INSTRUÇÕES DE USO:
-- ============================================================================
-- Opção 1: Busca itens cujo grupo contém "REPROCESSO" (recomendada)
-- Opção 2: Busca em grupo E nome do item
-- Opção 3: Busca exata (grupo = "REPROCESSO")
-- Opção 4: Contagem de itens por grupo
-- Opção 5: Lista completa com estatísticas do grupo
-- ============================================================================
-- RECOMENDAÇÃO: Use a Opção 1 para busca simples e direta
-- ============================================================================
