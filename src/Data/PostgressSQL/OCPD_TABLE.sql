-- ============================================================================
-- Tabela OCPD - Objeto de cadastro de programação diária
-- Programação diária por linha de produção
-- Execute este SQL no SQL Editor do Supabase (PostgreSQL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCPD" (
  id                      BIGSERIAL PRIMARY KEY,          -- ID interno

  -- Identificação básica
  line_id                 BIGINT NOT NULL,                -- id da linha (referência a OCLP.id, se desejar)
  hora_cabecalho          TIME,                           -- Hora do cabeçalho (hora de geração do planejamento)
  data_cabecalho          DATE,                           -- Data do cabeçalho (data de geração do planejamento)
  data_dia                DATE   NOT NULL,                -- data do dia
  op                      VARCHAR(50),                    -- Ordem de produção / OP
  codigo_item             VARCHAR(100),                   -- Código do item
  descricao_item          TEXT,                           -- Descrição do Item
  linha                   VARCHAR(100),                   -- Linha (nome/código)

  -- Quantidades
  qtd_planejada           NUMERIC(15,2) DEFAULT 0,        -- Quantidade planejada
  qtd_realizada           NUMERIC(15,2) DEFAULT 0,        -- Quantidade realizada
  diferenca               NUMERIC(15,2) DEFAULT 0,        -- Diferença

  -- Tempo / cálculo
  calculo_1_horas         NUMERIC(10,2),                  -- cálculo_1_horas
  restante_horas          VARCHAR(50),                    -- Restante de horas (ex: '2h 30m')
  hora_atual              TIMESTAMPTZ DEFAULT NOW(),      -- Hora atual
  hora_final              TIMESTAMPTZ,                    -- Hora final

  observacao              TEXT,                           -- Observação

  -- Totais agregados do dia
  total_qtd_planejada     NUMERIC(15,2) DEFAULT 0,        -- Total Quantidade planejada
  total_qtd_realizada     NUMERIC(15,2) DEFAULT 0,        -- Total Quantidade Realizada
  total_diferenca         NUMERIC(15,2) DEFAULT 0,        -- Total Diferença
  total_reprocesso_usado  NUMERIC(15,2) DEFAULT 0,        -- Total de Reprocesso Usado

  estim_latas_previstas   NUMERIC(15,2) DEFAULT 0,        -- Estimativa de Latas de açaí previstas
  estim_latas_realizadas  NUMERIC(15,2) DEFAULT 0,        -- Estimativa de Latas de açaí realizadas
  latas_ja_batidas        NUMERIC(15,2) DEFAULT 0,        -- Latas já batidas
  total_ja_cortado        NUMERIC(15,2) DEFAULT 0,        -- Total já cortado
  percentual_meta         NUMERIC(5,2)  DEFAULT 0,        -- Percentual meta (0–100)

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_ocpd_data_linha ON "OCPD"(data_dia, line_id);
CREATE INDEX IF NOT EXISTS idx_ocpd_op ON "OCPD"(op);
CREATE INDEX IF NOT EXISTS idx_ocpd_codigo_item ON "OCPD"(codigo_item);

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_ocpd_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocpd_updated_at ON "OCPD";
CREATE TRIGGER trg_ocpd_updated_at
  BEFORE UPDATE ON "OCPD"
  FOR EACH ROW
  EXECUTE FUNCTION update_ocpd_updated_at();

-- Comentários (documentação)
COMMENT ON TABLE "OCPD" IS 'Objeto de cadastro de programação diária por linha de produção';
COMMENT ON COLUMN "OCPD".line_id                IS 'ID da linha de produção (referência a OCLP.id, se usado como FK)';
COMMENT ON COLUMN "OCPD".hora_cabecalho         IS 'Hora do cabeçalho (hora de geração do planejamento)';
COMMENT ON COLUMN "OCPD".data_cabecalho         IS 'Data do cabeçalho (data de geração do planejamento)';
COMMENT ON COLUMN "OCPD".data_dia               IS 'Data do dia da programação';
COMMENT ON COLUMN "OCPD".op                     IS 'Ordem de produção (OP)';
COMMENT ON COLUMN "OCPD".codigo_item            IS 'Código do item';
COMMENT ON COLUMN "OCPD".descricao_item         IS 'Descrição do item';
COMMENT ON COLUMN "OCPD".linha                  IS 'Linha de produção';
COMMENT ON COLUMN "OCPD".qtd_planejada          IS 'Quantidade planejada';
COMMENT ON COLUMN "OCPD".qtd_realizada          IS 'Quantidade realizada';
COMMENT ON COLUMN "OCPD".diferenca              IS 'Diferença entre planejado e realizado';
COMMENT ON COLUMN "OCPD".calculo_1_horas        IS 'Cálculo 1 em horas';
COMMENT ON COLUMN "OCPD".restante_horas         IS 'Restante de horas';
COMMENT ON COLUMN "OCPD".hora_atual             IS 'Hora atual do registro';
COMMENT ON COLUMN "OCPD".hora_final             IS 'Hora final prevista';
COMMENT ON COLUMN "OCPD".observacao             IS 'Observação';
COMMENT ON COLUMN "OCPD".total_qtd_planejada    IS 'Total Quantidade planejada do dia';
COMMENT ON COLUMN "OCPD".total_qtd_realizada    IS 'Total Quantidade Realizada do dia';
COMMENT ON COLUMN "OCPD".total_diferenca        IS 'Total Diferença do dia';
COMMENT ON COLUMN "OCPD".total_reprocesso_usado IS 'Total de Reprocesso Usado';
COMMENT ON COLUMN "OCPD".estim_latas_previstas  IS 'Estimativa de Latas de açaí previstas';
COMMENT ON COLUMN "OCPD".estim_latas_realizadas IS 'Estimativa de Latas de açaí realizadas';
COMMENT ON COLUMN "OCPD".latas_ja_batidas       IS 'Latas já batidas';
COMMENT ON COLUMN "OCPD".total_ja_cortado       IS 'Total já cortado';
COMMENT ON COLUMN "OCPD".percentual_meta        IS 'Percentual da meta atingida';

