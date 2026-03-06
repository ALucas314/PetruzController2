-- ============================================================================
-- Consulta para listar TODOS os códigos que são de reprocesso
-- Retorna todos os códigos únicos que aparecem como reprocesso no sistema
-- ============================================================================

-- Opção 1: Listar códigos únicos de reprocesso da tabela OCPR (reprocessos cadastrados)
-- Mostra código, descrição, tipo e quantas vezes foi usado
SELECT 
    codigo,
    descricao,
    tipo,
    COUNT(*) AS vezes_usado,
    SUM(quantidade) AS quantidade_total,
    MIN(data_dia) AS primeira_vez,
    MAX(data_dia) AS ultima_vez,
    'OCPR' AS origem
FROM "OCPR"
WHERE codigo IS NOT NULL AND codigo != ''
GROUP BY codigo, descricao, tipo
ORDER BY codigo, tipo;

-- Opção 2: Listar códigos únicos de reprocesso da tabela OCPD (produção diária)
-- Se a tabela usar campos individuais de reprocesso
SELECT DISTINCT
    reprocesso_codigo AS codigo,
    reprocesso_descricao AS descricao,
    reprocesso_tipo AS tipo,
    COUNT(*) AS vezes_usado,
    SUM(reprocesso_quantidade) AS quantidade_total,
    MIN(data_dia) AS primeira_vez,
    MAX(data_dia) AS ultima_vez,
    'OCPD' AS origem
FROM "OCPD"
WHERE reprocesso_codigo IS NOT NULL AND reprocesso_codigo != ''
GROUP BY reprocesso_codigo, reprocesso_descricao, reprocesso_tipo
ORDER BY reprocesso_codigo, reprocesso_tipo;

-- Opção 3: Listar códigos únicos de reprocesso da tabela OCPD (usando JSONB)
-- Se a tabela usar campo reprocessos como JSONB
SELECT DISTINCT
    (reprocesso->>'codigo') AS codigo,
    (reprocesso->>'descricao') AS descricao,
    (reprocesso->>'tipo') AS tipo,
    COUNT(*) AS vezes_usado,
    SUM(CAST(reprocesso->>'quantidade' AS NUMERIC)) AS quantidade_total,
    MIN(data_dia) AS primeira_vez,
    MAX(data_dia) AS ultima_vez,
    'OCPD_JSONB' AS origem
FROM "OCPD",
     jsonb_array_elements(reprocessos) AS reprocesso
WHERE reprocessos IS NOT NULL 
  AND jsonb_array_length(reprocessos) > 0
  AND (reprocesso->>'codigo') IS NOT NULL 
  AND (reprocesso->>'codigo') != ''
GROUP BY (reprocesso->>'codigo'), (reprocesso->>'descricao'), (reprocesso->>'tipo')
ORDER BY codigo, tipo;

-- Opção 4: Lista COMBINADA de todos os códigos de reprocesso (UNION)
-- Retorna todos os códigos únicos de reprocesso de todas as fontes
(
    SELECT 
        codigo,
        descricao,
        tipo,
        COUNT(*) AS vezes_usado,
        SUM(quantidade) AS quantidade_total,
        MIN(data_dia)::TEXT AS primeira_vez,
        MAX(data_dia)::TEXT AS ultima_vez,
        'OCPR' AS origem
    FROM "OCPR"
    WHERE codigo IS NOT NULL AND codigo != ''
    GROUP BY codigo, descricao, tipo
)
UNION ALL
(
    SELECT DISTINCT
        reprocesso_codigo AS codigo,
        reprocesso_descricao AS descricao,
        reprocesso_tipo AS tipo,
        COUNT(*) AS vezes_usado,
        SUM(reprocesso_quantidade) AS quantidade_total,
        MIN(data_dia)::TEXT AS primeira_vez,
        MAX(data_dia)::TEXT AS ultima_vez,
        'OCPD' AS origem
    FROM "OCPD"
    WHERE reprocesso_codigo IS NOT NULL AND reprocesso_codigo != ''
    GROUP BY reprocesso_codigo, reprocesso_descricao, reprocesso_tipo
)
UNION ALL
(
    SELECT DISTINCT
        (reprocesso->>'codigo') AS codigo,
        (reprocesso->>'descricao') AS descricao,
        (reprocesso->>'tipo') AS tipo,
        COUNT(*) AS vezes_usado,
        SUM(CAST(reprocesso->>'quantidade' AS NUMERIC)) AS quantidade_total,
        MIN(data_dia)::TEXT AS primeira_vez,
        MAX(data_dia)::TEXT AS ultima_vez,
        'OCPD_JSONB' AS origem
    FROM "OCPD",
         jsonb_array_elements(reprocessos) AS reprocesso
    WHERE reprocessos IS NOT NULL 
      AND jsonb_array_length(reprocessos) > 0
      AND (reprocesso->>'codigo') IS NOT NULL 
      AND (reprocesso->>'codigo') != ''
    GROUP BY (reprocesso->>'codigo'), (reprocesso->>'descricao'), (reprocesso->>'tipo')
)
ORDER BY codigo, tipo, origem;

-- Opção 5: Lista SIMPLIFICADA - apenas códigos únicos (sem duplicatas)
-- Útil para obter uma lista limpa de todos os códigos de reprocesso
SELECT DISTINCT
    codigo,
    MAX(descricao) AS descricao,
    STRING_AGG(DISTINCT tipo, ', ') AS tipos,
    SUM(vezes_usado) AS total_vezes_usado,
    SUM(quantidade_total) AS quantidade_total_geral,
    MIN(primeira_vez) AS primeira_vez,
    MAX(ultima_vez) AS ultima_vez
FROM (
    (
        SELECT 
            codigo,
            descricao,
            tipo,
            COUNT(*) AS vezes_usado,
            SUM(quantidade) AS quantidade_total,
            MIN(data_dia)::TEXT AS primeira_vez,
            MAX(data_dia)::TEXT AS ultima_vez
        FROM "OCPR"
        WHERE codigo IS NOT NULL AND codigo != ''
        GROUP BY codigo, descricao, tipo
    )
    UNION ALL
    (
        SELECT DISTINCT
            reprocesso_codigo AS codigo,
            reprocesso_descricao AS descricao,
            reprocesso_tipo AS tipo,
            COUNT(*) AS vezes_usado,
            SUM(reprocesso_quantidade) AS quantidade_total,
            MIN(data_dia)::TEXT AS primeira_vez,
            MAX(data_dia)::TEXT AS ultima_vez
        FROM "OCPD"
        WHERE reprocesso_codigo IS NOT NULL AND reprocesso_codigo != ''
        GROUP BY reprocesso_codigo, reprocesso_descricao, reprocesso_tipo
    )
    UNION ALL
    (
        SELECT DISTINCT
            (reprocesso->>'codigo') AS codigo,
            (reprocesso->>'descricao') AS descricao,
            (reprocesso->>'tipo') AS tipo,
            COUNT(*) AS vezes_usado,
            SUM(CAST(reprocesso->>'quantidade' AS NUMERIC)) AS quantidade_total,
            MIN(data_dia)::TEXT AS primeira_vez,
            MAX(data_dia)::TEXT AS ultima_vez
        FROM "OCPD",
             jsonb_array_elements(reprocessos) AS reprocesso
        WHERE reprocessos IS NOT NULL 
          AND jsonb_array_length(reprocessos) > 0
          AND (reprocesso->>'codigo') IS NOT NULL 
          AND (reprocesso->>'codigo') != ''
        GROUP BY (reprocesso->>'codigo'), (reprocesso->>'descricao'), (reprocesso->>'tipo')
    )
) AS todos_reprocessos
GROUP BY codigo
ORDER BY codigo;

-- Opção 6: Verificar se os códigos de reprocesso existem na tabela OCTI (itens)
-- Útil para validar se os códigos de reprocesso são itens válidos
SELECT DISTINCT
    r.codigo,
    r.descricao AS descricao_reprocesso,
    i."Name" AS descricao_item,
    i."U_Uom" AS unidade_medida,
    i."U_ItemGroup" AS grupo_itens,
    CASE 
        WHEN i."Code" IS NOT NULL THEN 'SIM - Existe na OCTI'
        ELSE 'NÃO - Não encontrado na OCTI'
    END AS existe_na_octi
FROM (
    SELECT DISTINCT codigo, MAX(descricao) AS descricao
    FROM (
        SELECT codigo, descricao FROM "OCPR" WHERE codigo IS NOT NULL AND codigo != ''
        UNION
        SELECT reprocesso_codigo AS codigo, reprocesso_descricao AS descricao 
        FROM "OCPD" 
        WHERE reprocesso_codigo IS NOT NULL AND reprocesso_codigo != ''
        UNION
        SELECT (reprocesso->>'codigo') AS codigo, (reprocesso->>'descricao') AS descricao
        FROM "OCPD", jsonb_array_elements(reprocessos) AS reprocesso
        WHERE reprocessos IS NOT NULL 
          AND jsonb_array_length(reprocessos) > 0
          AND (reprocesso->>'codigo') IS NOT NULL 
          AND (reprocesso->>'codigo') != ''
    ) AS todos_codigos
    GROUP BY codigo
) AS r
LEFT JOIN "OCTI" i ON i."Code" = r.codigo
ORDER BY existe_na_octi DESC, r.codigo;

-- ============================================================================
-- RESUMO DAS OPÇÕES:
-- ============================================================================
-- Opção 1: Lista códigos da tabela OCPR (reprocessos cadastrados)
-- Opção 2: Lista códigos da tabela OCPD (campos individuais)
-- Opção 3: Lista códigos da tabela OCPD (campo JSONB)
-- Opção 4: Lista COMBINADA de todas as fontes (com origem)
-- Opção 5: Lista SIMPLIFICADA - apenas códigos únicos (recomendada)
-- Opção 6: Validação - verifica se os códigos existem na tabela OCTI
-- ============================================================================
-- RECOMENDAÇÃO: Use a Opção 5 para obter uma lista limpa de todos os códigos
-- ============================================================================
