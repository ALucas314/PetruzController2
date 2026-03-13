-- ============================================================================
-- Tabela OCPP - Objeto de Cadastro de Planejamento de Produção
-- Execute este SQL no SQL Editor do Supabase (PostgreSQL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCPP" (
  id                          BIGSERIAL PRIMARY KEY,

  -- Identificação e data
  data                        DATE NOT NULL,                 -- Data
  op                          VARCHAR(50),                   -- OP (Ordem de Produção)
  "Code"                      NUMERIC(15),                   -- Código do Item
  descricao                   TEXT,                          -- Descrição
  unidade                     VARCHAR(50),                  -- Unidade
  grupo                       VARCHAR(100),                 -- Grupo

  -- Quantidades
  quantidade                  NUMERIC(15,2) DEFAULT 0,      -- Quantidade
  quantidade_latas            NUMERIC(15,2) DEFAULT 0,      -- Quantidade de Latas
  previsao_latas              NUMERIC(15,2) DEFAULT 0,      -- Quantidade prevista (Previsão Latas)
  quantidade_kg               NUMERIC(15,2) DEFAULT 0,      -- Quantidade em Kg

  -- Tipo e linha
  tipo_fruto                  VARCHAR(100),                 -- Tipo de Fruto
  tipo_linha                  VARCHAR(100),                 -- Tipo da linha
  unidade_base                VARCHAR(50),                 -- Unidade Base
  unidade_chapa               VARCHAR(50),                  -- Unidade Chapa

  -- Solidos e cortes
  solidos                     NUMERIC(15,2),                -- Solidos
  solid                       NUMERIC(15,2),                -- Solid
  quantidade_kg_tuneo         NUMERIC(15,2) DEFAULT 0,      -- Quantidade de Kg no Túneo
  quantidade_liquida_prevista NUMERIC(15,2) DEFAULT 0,      -- Quantidade Líquida Prevista
  cort_solid                  VARCHAR(50),                  -- Cort / Solid
  t_cort                      VARCHAR(50),                  -- T. Cort

  -- Quantidades (basqueta, chapa, latas)
  quantidade_basqueta         NUMERIC(15,2) DEFAULT 0,      -- Quantidade de basqueta
  quantidade_chapa            NUMERIC(15,2) DEFAULT 0,      -- Quantidade Chapa
  latas                       NUMERIC(15,2) DEFAULT 0,      -- Latas

  -- Estrutura e recursos
  estrutura                   VARCHAR(255),                 -- Estrutura
  basqueta                    VARCHAR(100),                 -- Basqueta
  chapa                       VARCHAR(100),                 -- Chapa
  tuneo                       VARCHAR(100),                 -- Túneo

  -- Recursos de produção
  qual_maquina                VARCHAR(255),                 -- Máquina
  mao_de_obra                 VARCHAR(255),                 -- Mão de Obra
  utilidade                   VARCHAR(255),                 -- Utilidade
  estoque                     VARCHAR(255),                 -- Estoque
  timbragem                   VARCHAR(255),                 -- Timbragem
  corte_reprocesso            VARCHAR(255),                 -- Corte Reprocesso

  observacao                  TEXT,                         -- Observação

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ocpp_data ON "OCPP"(data);
CREATE INDEX IF NOT EXISTS idx_ocpp_op ON "OCPP"(op);
CREATE INDEX IF NOT EXISTS idx_ocpp_grupo ON "OCPP"(grupo);
CREATE INDEX IF NOT EXISTS idx_ocpp_tipo_fruto ON "OCPP"(tipo_fruto);
CREATE INDEX IF NOT EXISTS idx_ocpp_tipo_linha ON "OCPP"(tipo_linha);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ocpp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocpp_updated_at ON "OCPP";
CREATE TRIGGER trg_ocpp_updated_at
  BEFORE UPDATE ON "OCPP"
  FOR EACH ROW
  EXECUTE FUNCTION update_ocpp_updated_at();

-- Comentários
COMMENT ON TABLE "OCPP" IS 'Objeto de Cadastro de Planejamento de Produção';
COMMENT ON COLUMN "OCPP".data                        IS 'Data do planejamento';
COMMENT ON COLUMN "OCPP".op                          IS 'Ordem de Produção (OP)';
COMMENT ON COLUMN "OCPP"."Code"                      IS 'Código do Item';
COMMENT ON COLUMN "OCPP".descricao                   IS 'Descrição';
COMMENT ON COLUMN "OCPP".unidade                     IS 'Unidade';
COMMENT ON COLUMN "OCPP".grupo                       IS 'Grupo';
COMMENT ON COLUMN "OCPP".quantidade                   IS 'Quantidade';
COMMENT ON COLUMN "OCPP".quantidade_latas             IS 'Quantidade de Latas';
COMMENT ON COLUMN "OCPP".previsao_latas               IS 'Quantidade prevista (Previsão Latas)';
COMMENT ON COLUMN "OCPP".quantidade_kg                IS 'Quantidade em Kg';
COMMENT ON COLUMN "OCPP".tipo_fruto                   IS 'Tipo de Fruto';
COMMENT ON COLUMN "OCPP".tipo_linha                   IS 'Tipo da linha';
COMMENT ON COLUMN "OCPP".unidade_base                 IS 'Unidade Base';
COMMENT ON COLUMN "OCPP".unidade_chapa                IS 'Unidade Chapa';
COMMENT ON COLUMN "OCPP".solidos                      IS 'Solidos';
COMMENT ON COLUMN "OCPP".solid                        IS 'Solid';
COMMENT ON COLUMN "OCPP".quantidade_kg_tuneo          IS 'Quantidade de Kg no Túneo';
COMMENT ON COLUMN "OCPP".quantidade_liquida_prevista  IS 'Quantidade Líquida Prevista';
COMMENT ON COLUMN "OCPP".cort_solid                   IS 'Cort / Solid';
COMMENT ON COLUMN "OCPP".t_cort                       IS 'T. Cort';
COMMENT ON COLUMN "OCPP".quantidade_basqueta          IS 'Quantidade de basqueta';
COMMENT ON COLUMN "OCPP".quantidade_chapa             IS 'Quantidade Chapa';
COMMENT ON COLUMN "OCPP".latas                        IS 'Latas';
COMMENT ON COLUMN "OCPP".estrutura                    IS 'Estrutura';
COMMENT ON COLUMN "OCPP".basqueta                     IS 'Basqueta';
COMMENT ON COLUMN "OCPP".chapa                        IS 'Chapa';
COMMENT ON COLUMN "OCPP".tuneo                        IS 'Túneo';
COMMENT ON COLUMN "OCPP".qual_maquina                 IS 'Máquina';
COMMENT ON COLUMN "OCPP".mao_de_obra                  IS 'Mão de Obra';
COMMENT ON COLUMN "OCPP".utilidade                    IS 'Utilidade';
COMMENT ON COLUMN "OCPP".estoque                      IS 'Estoque';
COMMENT ON COLUMN "OCPP".timbragem                    IS 'Timbragem';
COMMENT ON COLUMN "OCPP".corte_reprocesso             IS 'Corte Reprocesso';
COMMENT ON COLUMN "OCPP".observacao                   IS 'Observação';
