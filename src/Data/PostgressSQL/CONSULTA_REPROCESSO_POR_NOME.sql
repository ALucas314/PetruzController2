-- ============================================================================
-- Consulta para descobrir o código de um reprocesso pelo nome/descrição
-- Busca em múltiplas tabelas: OCTI (itens) e OCPR (reprocessos)
-- ============================================================================

-- Opção 1: Buscar na tabela OCTI (itens) - busca exata
-- Substitua 'NOME_DO_REPROCESSO' pelo nome que você está procurando
SELECT 
    "Code" AS codigo,
    "Name" AS descricao,
    "U_Uom" AS unidade_medida,
    "U_ItemGroup" AS grupo_itens,
    'OCTI' AS origem
FROM "OCTI"
WHERE LOWER(TRIM("Name")) = LOWER(TRIM('NOME_DO_REPROCESSO'))
LIMIT 10;

-- Opção 2: Buscar na tabela OCTI (itens) - busca parcial (contém)
-- Útil quando você não sabe o nome exato
SELECT 
    "Code" AS codigo,
    "Name" AS descricao,
    "U_Uom" AS unidade_medida,
    "U_ItemGroup" AS grupo_itens,
    'OCTI' AS origem
FROM "OCTI"
WHERE LOWER(TRIM("Name")) LIKE LOWER('%NOME_DO_REPROCESSO%')
ORDER BY "Name"
LIMIT 20;

-- Opção 3: Buscar na tabela OCPR (reprocessos cadastrados)
-- Busca pelos reprocessos que foram cadastrados na produção
SELECT 
    codigo,
    descricao,
    tipo,
    numero,
    quantidade,
    data_dia,
    filial_nome,
    'OCPR' AS origem
FROM "OCPR"
WHERE LOWER(TRIM(descricao)) LIKE LOWER('%NOME_DO_REPROCESSO%')
ORDER BY data_dia DESC, numero DESC
LIMIT 20;

-- Opção 4: Buscar na tabela OCPD (produção diária) - campos de reprocesso
-- Se a tabela usar campos individuais de reprocesso
SELECT DISTINCT
    reprocesso_codigo AS codigo,
    reprocesso_descricao AS descricao,
    reprocesso_tipo AS tipo,
    reprocesso_numero AS numero,
    filial_nome,
    data_dia,
    'OCPD' AS origem
FROM "OCPD"
WHERE reprocesso_descricao IS NOT NULL 
  AND LOWER(TRIM(reprocesso_descricao)) LIKE LOWER('%NOME_DO_REPROCESSO%')
ORDER BY data_dia DESC
LIMIT 20;

-- Opção 5: Busca combinada em todas as tabelas (UNION)
-- Retorna resultados de OCTI, OCPR e OCPD em uma única consulta
(
    SELECT 
        "Code" AS codigo,
        "Name" AS descricao,
        NULL AS tipo,
        NULL AS numero,
        NULL AS quantidade,
        NULL AS data_dia,
        NULL AS filial_nome,
        'OCTI' AS origem
    FROM "OCTI"
    WHERE LOWER(TRIM("Name")) LIKE LOWER('%NOME_DO_REPROCESSO%')
)
UNION ALL
(
    SELECT 
        codigo,
        descricao,
        tipo,
        numero::TEXT AS numero,
        quantidade::TEXT AS quantidade,
        data_dia::TEXT AS data_dia,
        filial_nome,
        'OCPR' AS origem
    FROM "OCPR"
    WHERE LOWER(TRIM(descricao)) LIKE LOWER('%NOME_DO_REPROCESSO%')
)
UNION ALL
(
    SELECT DISTINCT
        reprocesso_codigo AS codigo,
        reprocesso_descricao AS descricao,
        reprocesso_tipo AS tipo,
        reprocesso_numero::TEXT AS numero,
        NULL AS quantidade,
        data_dia::TEXT AS data_dia,
        filial_nome,
        'OCPD' AS origem
    FROM "OCPD"
    WHERE reprocesso_descricao IS NOT NULL 
      AND LOWER(TRIM(reprocesso_descricao)) LIKE LOWER('%NOME_DO_REPROCESSO%')
)
ORDER BY origem, descricao
LIMIT 30;

-- ============================================================================
-- INSTRUÇÕES DE USO:
-- ============================================================================
-- 1. Substitua 'NOME_DO_REPROCESSO' pelo nome/descrição que você está procurando
-- 2. Use a Opção 1 para busca exata (mais rápida)
-- 3. Use a Opção 2 para busca parcial (quando não sabe o nome completo)
-- 4. Use a Opção 5 para buscar em todas as tabelas de uma vez
-- 5. A busca é case-insensitive (não diferencia maiúsculas/minúsculas)
-- 6. A busca remove espaços extras no início e fim do texto
-- ============================================================================
