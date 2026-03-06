-- Migration: Adicionar campo filial_nome na tabela OCPD
-- Data: 2024
-- Descrição: Adiciona campo para vincular registros de produção às filiais usando o nome completo

-- Adicionar coluna filial_nome na tabela OCPD
ALTER TABLE "OCPD" 
ADD COLUMN IF NOT EXISTS "filial_nome" VARCHAR(255);

-- Criar índice para melhorar performance nas consultas filtradas por filial
CREATE INDEX IF NOT EXISTS "idx_ocpd_filial_nome" ON "OCPD"("filial_nome");

-- Adicionar comentário na coluna
COMMENT ON COLUMN "OCPD"."filial_nome" IS 'Nome completo da filial (referência à tabela OCTF) - Ex: BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA, PETRUZ FRUITY INDUSTRIA, COMERCIO E DISTRIBUIDORA LTDA - PA';

-- Atualizar registros existentes (opcional - pode deixar NULL ou definir um valor padrão)
-- UPDATE "OCPD" SET "filial_nome" = 'BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA' WHERE "filial_nome" IS NULL;
