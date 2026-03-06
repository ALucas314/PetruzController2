-- ============================================================================
-- Script de UPDATE para adicionar campos de reprocesso na tabela OCPD
-- e criar a tabela OCPR (Objeto de Cadastro de Reprocessos)
-- Execute este SQL no SQL Editor do Supabase (PostgreSQL)
-- ============================================================================

-- Verificar e adicionar campo filial_nome se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'OCPD' AND column_name = 'filial_nome'
  ) THEN
    ALTER TABLE "OCPD" ADD COLUMN filial_nome VARCHAR(255);
    COMMENT ON COLUMN "OCPD".filial_nome IS 'Nome completo da filial';
  END IF;
END $$;

-- Criar índice para filial_nome se não existir
CREATE INDEX IF NOT EXISTS idx_ocpd_filial_nome ON "OCPD"(filial_nome);

-- Criar índice para data_dia se não existir
CREATE INDEX IF NOT EXISTS idx_ocpd_data_dia ON "OCPD"(data_dia);

-- ============================================================================
-- Criar tabela OCPR - Objeto de Cadastro de Reprocessos
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCPR" (
  id                      BIGSERIAL PRIMARY KEY,          -- ID interno
  
  -- Relacionamento com OCPD
  ocpd_id                 BIGINT,                         -- ID do registro de produção (OCPD.id)
  data_dia                DATE NOT NULL,                  -- Data do dia (para facilitar consultas)
  filial_nome             VARCHAR(255),                   -- Nome completo da filial (mesmo da OCPD)
  
  -- Dados do reprocesso
  numero                  INTEGER NOT NULL,               -- Número sequencial do reprocesso no dia
  tipo                    VARCHAR(20) NOT NULL,           -- Tipo: 'Cortado' ou 'Usado'
  codigo                  VARCHAR(100),                   -- Código do reprocesso
  descricao               TEXT,                           -- Descrição do reprocesso
  quantidade              NUMERIC(15,2) DEFAULT 0,        -- Quantidade
  
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint para garantir tipo válido
  CONSTRAINT chk_ocpr_tipo CHECK (tipo IN ('Cortado', 'Usado'))
);

-- Índices úteis para OCPR
CREATE INDEX IF NOT EXISTS idx_ocpr_ocpd_id ON "OCPR"(ocpd_id);
CREATE INDEX IF NOT EXISTS idx_ocpr_data_dia ON "OCPR"(data_dia);
CREATE INDEX IF NOT EXISTS idx_ocpr_filial_nome ON "OCPR"(filial_nome);
CREATE INDEX IF NOT EXISTS idx_ocpr_data_filial ON "OCPR"(data_dia, filial_nome);

-- Atualizar updated_at automaticamente para OCPR
CREATE OR REPLACE FUNCTION update_ocpr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocpr_updated_at ON "OCPR";
CREATE TRIGGER trg_ocpr_updated_at
  BEFORE UPDATE ON "OCPR"
  FOR EACH ROW
  EXECUTE FUNCTION update_ocpr_updated_at();

-- Comentários (documentação) para OCPR
COMMENT ON TABLE "OCPR" IS 'Objeto de cadastro de reprocessos vinculados à programação diária';
COMMENT ON COLUMN "OCPR".ocpd_id                IS 'ID do registro de produção (OCPD.id) - pode ser NULL se não houver vínculo direto';
COMMENT ON COLUMN "OCPR".data_dia                IS 'Data do dia do reprocesso';
COMMENT ON COLUMN "OCPR".filial_nome             IS 'Nome completo da filial';
COMMENT ON COLUMN "OCPR".numero                  IS 'Número sequencial do reprocesso no dia';
COMMENT ON COLUMN "OCPR".tipo                    IS 'Tipo do reprocesso: Cortado ou Usado';
COMMENT ON COLUMN "OCPR".codigo                  IS 'Código do reprocesso';
COMMENT ON COLUMN "OCPR".descricao               IS 'Descrição do reprocesso';
COMMENT ON COLUMN "OCPR".quantidade              IS 'Quantidade do reprocesso';
