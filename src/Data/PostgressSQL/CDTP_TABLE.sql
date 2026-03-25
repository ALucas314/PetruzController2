-- ============================================================================
-- Tabela CDTP — Cadastro de tipo de produtos (estoque)
--
-- Campos: filial, código sequencial por filial (ex.: 0001), tempo máx. congelamento,
--         nome, descrição do produto.
-- Execute no Supabase: SQL Editor → Run
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."CDTP" (
  id                            BIGSERIAL PRIMARY KEY,

  filial_nome                   VARCHAR(255) NOT NULL,
  codigo_documento              INTEGER NOT NULL,

  -- Duração máxima de congelamento; na UI pode ser exibida como HH:MM (converter minutos)
  tempo_max_congelamento_minutos INTEGER NOT NULL DEFAULT 0
    CHECK (tempo_max_congelamento_minutos >= 0),

  nome                          VARCHAR(255) NOT NULL,
  descricao_produto             TEXT,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cdtp_filial_codigo_uidx
  ON public."CDTP" (filial_nome, codigo_documento);

CREATE INDEX IF NOT EXISTS idx_cdtp_filial_nome ON public."CDTP"(filial_nome);

CREATE OR REPLACE FUNCTION public.update_cdtp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cdtp_updated_at ON public."CDTP";
CREATE TRIGGER trg_cdtp_updated_at
  BEFORE UPDATE ON public."CDTP"
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_cdtp_updated_at();

COMMENT ON TABLE public."CDTP" IS 'Cadastro de tipo de produtos (estoque)';
COMMENT ON COLUMN public."CDTP".filial_nome IS 'Nome da filial (referência OCTF)';
COMMENT ON COLUMN public."CDTP".codigo_documento IS 'Código sequencial por filial (1, 2, 3… exibir 0001)';
COMMENT ON COLUMN public."CDTP".tempo_max_congelamento_minutos IS 'Tempo máximo de congelamento em minutos (UI: formato HH:MM)';
COMMENT ON COLUMN public."CDTP".nome IS 'Nome do tipo de produto';
COMMENT ON COLUMN public."CDTP".descricao_produto IS 'Descrição do produto';

-- Depois: CDTP_RLS_PERMITIR_LEITURA.sql (e bloco em RLS_TODAS_TABELAS_FRONTEND.sql)
