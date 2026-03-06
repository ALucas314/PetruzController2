-- ============================================================================
-- Consulta para identificar quais códigos na tabela OCTI são reprocessos
-- Compara os códigos da OCTI com os códigos usados como reprocesso no sistema
-- ============================================================================

-- Opção 1: Listar TODOS os itens da OCTI que são reprocessos
-- Compara com códigos usados nas tabelas OCPR e OCPD
SELECT 
    i."Code" AS codigo,
    i."Name" AS descricao,
    i."U_Uom" AS unidade_medida,
    i."U_ItemGroup" AS grupo_itens,
    COUNT(DISTINCT r.tipo) AS tipos_reprocesso,
    STRING_AGG(DISTINCT r.tipo, ', ') AS tipos,
    COUNT(*) AS vezes_usado_como_reprocesso,
    SUM(r.quantidade) AS quantidade_total_usada,
    MIN(r.data_dia) AS primeira_vez_usado,
    MAX(r.data_dia) AS ultima_vez_usado,
    'SIM - Usado como reprocesso' AS status
FROM "OCTI" i
INNER JOIN (
    -- Códigos de reprocesso da tabela OCPR
    SELECT codigo, tipo, quantidade, data_dia
    FROM "OCPR"
    WHERE codigo IS NOT NULL AND codigo != ''
    
    UNION ALL
    
    -- Códigos de reprocesso da tabela OCPD (campos individuais)
    SELECT reprocesso_codigo AS codigo, reprocesso_tipo AS tipo, 
           reprocesso_quantidade AS quantidade, data_dia
    FROM "OCPD"
    WHERE reprocesso_codigo IS NOT NULL AND reprocesso_codigo != ''
    
    UNION ALL
    
    -- Códigos de reprocesso da tabela OCPD (JSONB)
    SELECT (reprocesso->>'codigo') AS codigo, 
           (reprocesso->>'tipo') AS tipo,
           CAST(reprocesso->>'quantidade' AS NUMERIC) AS quantidade,
           data_dia
    FROM "OCPD",
         jsonb_array_elements(reprocessos) AS reprocesso
    WHERE reprocessos IS NOT NULL 
      AND jsonb_array_length(reprocessos) > 0
      AND (reprocesso->>'codigo') IS NOT NULL 
      AND (reprocesso->>'codigo') != ''
) r ON i."Code" = r.codigo
GROUP BY i."Code", i."Name", i."U_Uom", i."U_ItemGroup"
ORDER BY vezes_usado_como_reprocesso DESC, i."Code";

-- Opção 2: Listar TODOS os itens da OCTI com indicação se são reprocessos ou não
-- Útil para ver todos os itens e identificar quais são reprocessos
SELECT 
    i."Code" AS codigo,
    i."Name" AS descricao,
    i."U_Uom" AS unidade_medida,
    i."U_ItemGroup" AS grupo_itens,
    CASE 
        WHEN r.codigo IS NOT NULL THEN 'SIM - É reprocesso'
        ELSE 'NÃO - Não é reprocesso'
    END AS eh_reprocesso,
    r.tipos AS tipos_reprocesso,
    r.vezes_usado,
    r.quantidade_total,
    r.primeira_vez,
    r.ultima_vez
FROM "OCTI" i
LEFT JOIN (
    SELECT 
        codigo,
        STRING_AGG(DISTINCT tipo, ', ') AS tipos,
        COUNT(*) AS vezes_usado,
        SUM(quantidade) AS quantidade_total,
        MIN(data_dia)::TEXT AS primeira_vez,
        MAX(data_dia)::TEXT AS ultima_vez
    FROM (
        SELECT codigo, tipo, quantidade, data_dia
        FROM "OCPR"
        WHERE codigo IS NOT NULL AND codigo != ''
        
        UNION ALL
        
        SELECT reprocesso_codigo AS codigo, reprocesso_tipo AS tipo, 
               reprocesso_quantidade AS quantidade, data_dia
        FROM "OCPD"
        WHERE reprocesso_codigo IS NOT NULL AND reprocesso_codigo != ''
        
        UNION ALL
        
        SELECT (reprocesso->>'codigo') AS codigo, 
               (reprocesso->>'tipo') AS tipo,
               CAST(reprocesso->>'quantidade' AS NUMERIC) AS quantidade,
               data_dia
        FROM "OCPD",
             jsonb_array_elements(reprocessos) AS reprocesso
        WHERE reprocessos IS NOT NULL 
          AND jsonb_array_length(reprocessos) > 0
          AND (reprocesso->>'codigo') IS NOT NULL 
          AND (reprocesso->>'codigo') != ''
    ) AS todos_reprocessos
    GROUP BY codigo
) r ON i."Code" = r.codigo
ORDER BY 
    CASE WHEN r.codigo IS NOT NULL THEN 0 ELSE 1 END,  -- Reprocessos primeiro
    i."Code";

-- Opção 3: Apenas códigos da OCTI que são reprocessos (lista limpa)
-- Retorna apenas os itens que foram usados como reprocesso
SELECT DISTINCT
    i."Code" AS codigo,
    i."Name" AS descricao,
    i."U_Uom" AS unidade_medida,
    i."U_ItemGroup" AS grupo_itens
FROM "OCTI" i
WHERE i."Code" IN (
    -- Códigos únicos de reprocesso
    SELECT DISTINCT codigo
    FROM (
        SELECT codigo FROM "OCPR" WHERE codigo IS NOT NULL AND codigo != ''
        UNION
        SELECT reprocesso_codigo FROM "OCPD" WHERE reprocesso_codigo IS NOT NULL AND reprocesso_codigo != ''
        UNION
        SELECT (reprocesso->>'codigo')
        FROM "OCPD", jsonb_array_elements(reprocessos) AS reprocesso
        WHERE reprocessos IS NOT NULL 
          AND jsonb_array_length(reprocessos) > 0
          AND (reprocesso->>'codigo') IS NOT NULL 
          AND (reprocesso->>'codigo') != ''
    ) AS codigos_reprocesso
)
ORDER BY i."Code";

-- Opção 4: Identificar reprocessos por padrão no código ou grupo de itens
-- Útil se houver um padrão específico (ex: códigos começando com "R" ou grupo "REPROCESSO")
SELECT 
    "Code" AS codigo,
    "Name" AS descricao,
    "U_Uom" AS unidade_medida,
    "U_ItemGroup" AS grupo_itens,
    CASE 
        WHEN UPPER("Code") LIKE 'R%' THEN 'Possível reprocesso (código começa com R)'
        WHEN UPPER("U_ItemGroup") LIKE '%REPROCESSO%' THEN 'Possível reprocesso (grupo contém REPROCESSO)'
        WHEN UPPER("Name") LIKE '%REPROCESSO%' THEN 'Possível reprocesso (nome contém REPROCESSO)'
        ELSE 'Verificar manualmente'
    END AS indicador
FROM "OCTI"
WHERE 
    UPPER("Code") LIKE 'R%'
    OR UPPER("U_ItemGroup") LIKE '%REPROCESSO%'
    OR UPPER("Name") LIKE '%REPROCESSO%'
ORDER BY "Code";

-- Opção 5: Comparação completa - OCTI vs Reprocessos usados
-- Mostra todos os itens da OCTI e indica se foram usados como reprocesso
SELECT 
    i."Code" AS codigo_octi,
    i."Name" AS descricao_octi,
    i."U_ItemGroup" AS grupo_octi,
    CASE 
        WHEN r.codigo IS NOT NULL THEN '✓ Usado como reprocesso'
        ELSE '✗ Nunca usado como reprocesso'
    END AS status_uso,
    r.tipos AS tipos_quando_usado,
    r.vezes_usado,
    r.quantidade_total,
    r.primeira_vez,
    r.ultima_vez
FROM "OCTI" i
LEFT JOIN (
    SELECT 
        codigo,
        STRING_AGG(DISTINCT tipo, ', ') AS tipos,
        COUNT(*) AS vezes_usado,
        SUM(quantidade) AS quantidade_total,
        MIN(data_dia)::TEXT AS primeira_vez,
        MAX(data_dia)::TEXT AS ultima_vez
    FROM (
        SELECT codigo, tipo, quantidade, data_dia
        FROM "OCPR"
        WHERE codigo IS NOT NULL AND codigo != ''
        
        UNION ALL
        
        SELECT reprocesso_codigo AS codigo, reprocesso_tipo AS tipo, 
               reprocesso_quantidade AS quantidade, data_dia
        FROM "OCPD"
        WHERE reprocesso_codigo IS NOT NULL AND reprocesso_codigo != ''
        
        UNION ALL
        
        SELECT (reprocesso->>'codigo') AS codigo, 
               (reprocesso->>'tipo') AS tipo,
               CAST(reprocesso->>'quantidade' AS NUMERIC) AS quantidade,
               data_dia
        FROM "OCPD",
             jsonb_array_elements(reprocessos) AS reprocesso
        WHERE reprocessos IS NOT NULL 
          AND jsonb_array_length(reprocessos) > 0
          AND (reprocesso->>'codigo') IS NOT NULL 
          AND (reprocesso->>'codigo') != ''
    ) AS todos_reprocessos
    GROUP BY codigo
) r ON i."Code" = r.codigo
ORDER BY 
    CASE WHEN r.codigo IS NOT NULL THEN 0 ELSE 1 END,  -- Reprocessos primeiro
    i."Code";

-- Opção 6: Estatísticas de reprocessos na OCTI
-- Resumo estatístico dos reprocessos
SELECT 
    COUNT(DISTINCT i."Code") AS total_itens_octi,
    COUNT(DISTINCT r.codigo) AS total_reprocessos_identificados,
    COUNT(DISTINCT i."Code") - COUNT(DISTINCT r.codigo) AS itens_nao_reprocesso,
    ROUND(
        (COUNT(DISTINCT r.codigo)::NUMERIC / COUNT(DISTINCT i."Code")::NUMERIC) * 100, 
        2
    ) AS percentual_reprocessos
FROM "OCTI" i
LEFT JOIN (
    SELECT DISTINCT codigo
    FROM (
        SELECT codigo FROM "OCPR" WHERE codigo IS NOT NULL AND codigo != ''
        UNION
        SELECT reprocesso_codigo FROM "OCPD" WHERE reprocesso_codigo IS NOT NULL AND reprocesso_codigo != ''
        UNION
        SELECT (reprocesso->>'codigo')
        FROM "OCPD", jsonb_array_elements(reprocessos) AS reprocesso
        WHERE reprocessos IS NOT NULL 
          AND jsonb_array_length(reprocessos) > 0
          AND (reprocesso->>'codigo') IS NOT NULL 
          AND (reprocesso->>'codigo') != ''
    ) AS codigos_reprocesso
) r ON i."Code" = r.codigo;

-- ============================================================================
-- RESUMO DAS OPÇÕES:
-- ============================================================================
-- Opção 1: Lista itens da OCTI que são reprocessos (com estatísticas de uso)
-- Opção 2: Lista TODOS os itens da OCTI indicando quais são reprocessos
-- Opção 3: Lista limpa - apenas códigos da OCTI que são reprocessos
-- Opção 4: Identifica reprocessos por padrão (código/grupo/nome)
-- Opção 5: Comparação completa - todos os itens com status de uso
-- Opção 6: Estatísticas gerais de reprocessos
-- ============================================================================
-- RECOMENDAÇÃO: 
-- - Use Opção 3 para lista simples de códigos reprocesso
-- - Use Opção 2 para ver todos os itens e identificar reprocessos
-- - Use Opção 5 para análise completa
-- ============================================================================
