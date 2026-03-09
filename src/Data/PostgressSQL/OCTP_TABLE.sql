-- ============================================================================
-- Tabela OCTP - Objeto de Cadastro de [registros] (ex.: acompanhamento / problemas e ações)
-- Colunas: N° (número da linha), Problema, Ação, Responsável, Hora (automática),
--          Início (data do dia, editável), Descrição do Status
-- Execute este SQL no SQL Editor do Supabase (PostgreSQL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCTP" (
  id                  BIGSERIAL PRIMARY KEY,           -- ID interno

  -- N° = número da linha (1, 2, 3...)
  numero              INTEGER NOT NULL,                 -- Número da linha (ordem: 1, 2, 3...)

  problema            TEXT,                             -- Problema
  acao                TEXT,                             -- Ação
  responsavel         VARCHAR(255),                     -- Responsável

  -- Hora automática (registro do momento)
  hora                TIMESTAMPTZ DEFAULT NOW(),        -- Hora (automática)

  -- Início: data do dia por padrão, com possibilidade de selecionar outra
  inicio              DATE DEFAULT CURRENT_DATE,        -- Início (data automática do dia; pode ser alterada)

  descricao_status    TEXT,                             -- Descrição do Status

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_octp_inicio ON "OCTP"(inicio);
CREATE INDEX IF NOT EXISTS idx_octp_numero ON "OCTP"(numero);
CREATE INDEX IF NOT EXISTS idx_octp_hora ON "OCTP"(hora);

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_octp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_octp_updated_at ON "OCTP";
CREATE TRIGGER trg_octp_updated_at
  BEFORE UPDATE ON "OCTP"
  FOR EACH ROW
  EXECUTE PROCEDURE update_octp_updated_at();

-- Comentários (documentação)
COMMENT ON TABLE "OCTP" IS 'Objeto de cadastro: problemas, ações, responsável, hora e status';
COMMENT ON COLUMN "OCTP".numero            IS 'Número da linha (1, 2, 3...)';
COMMENT ON COLUMN "OCTP".problema          IS 'Problema';
COMMENT ON COLUMN "OCTP".acao              IS 'Ação';
COMMENT ON COLUMN "OCTP".responsavel       IS 'Responsável';
COMMENT ON COLUMN "OCTP".hora              IS 'Hora (automática ao inserir/atualizar)';
COMMENT ON COLUMN "OCTP".inicio            IS 'Data de início (padrão: dia atual; pode ser alterada)';
COMMENT ON COLUMN "OCTP".descricao_status  IS 'Descrição do Status';

-- Depois de criar a tabela, execute OCTP_RLS_PERMITIR_LEITURA.sql para permitir
-- acesso do frontend (usuários autenticados) à tabela OCTP.
