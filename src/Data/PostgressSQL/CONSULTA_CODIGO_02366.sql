-- Consulta simples para buscar a descrição do código 02366
-- Tabela: OCTI (Objeto de Cadastro da Tabela de Itens)

SELECT 
    "Code" AS codigo,
    "Name" AS descricao,
    "U_Uom" AS unidade_medida,
    "U_ItemGroup" AS grupo_itens
FROM "OCTI"
WHERE "Code" = '02366'
LIMIT 1;

-- Alternativa: buscar também sem zeros à esquerda (caso o código esteja armazenado como 2366)
SELECT 
    "Code" AS codigo,
    "Name" AS descricao,
    "U_Uom" AS unidade_medida,
    "U_ItemGroup" AS grupo_itens
FROM "OCTI"
WHERE "Code" = '02366' OR "Code" = '2366'
LIMIT 1;
