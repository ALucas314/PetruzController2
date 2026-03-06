-- Inserção de dados iniciais na tabela OCTF (Objeto de Cadastro da Tabela de Filiais)
-- PostgreSQL

-- Inserir Filial 01: BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA
INSERT INTO "OCTF" ("Code", "Name", "Address")
VALUES (
    '01',
    'BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA',
    'AVDUQUE DE CAXIAS,250
68741-360-CASTANHAL-PA
BRASIL'
)
ON CONFLICT ("Code") DO UPDATE SET
    "Name" = EXCLUDED."Name",
    "Address" = EXCLUDED."Address",
    updated_at = NOW();

-- Inserir Filial 02: PETRUZ FRUITY INDUSTRIA, COMERCIO E DISTRIBUIDORA LTDA - PA
INSERT INTO "OCTF" ("Code", "Name", "Address")
VALUES (
    '02',
    'PETRUZ FRUITY INDUSTRIA, COMERCIO E DISTRIBUIDORA LTDA - PA',
    'RODOVIACASTANHAL/CURUCA,S/N
68746-899-CASTANHAL-PA
BRASIL'
)
ON CONFLICT ("Code") DO UPDATE SET
    "Name" = EXCLUDED."Name",
    "Address" = EXCLUDED."Address",
    updated_at = NOW();

-- Verificar os registros inseridos
SELECT id, "Code", "Name", "Address", created_at, updated_at
FROM "OCTF"
ORDER BY "Code";
