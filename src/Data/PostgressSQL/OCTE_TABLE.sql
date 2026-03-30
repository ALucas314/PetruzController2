-- ============================================================================
-- Tabela OCTE — Objeto de Cadastro de Tabela de empacotamento
--
-- Execute no Supabase: SQL Editor → New query → Run
-- Depois: OCTE_RLS_PERMITIR_LEITURA.sql (e bloco em RLS_TODAS_TABELAS_FRONTEND.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."OCTE" (
  id                     BIGSERIAL PRIMARY KEY,

  data                   DATE NOT NULL DEFAULT CURRENT_DATE,

  codigo_documento       VARCHAR(80),

  filial_nome            VARCHAR(120) NOT NULL DEFAULT '',

  codigo_item            VARCHAR(60) NOT NULL,
  descricao_item         TEXT,
  unidade_item           VARCHAR(30),

  peso                   NUMERIC(18, 4) NOT NULL DEFAULT 0,

  colaborador            VARCHAR(255),

  quantidade_1           NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_2           NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_3           NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_4           NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_5           NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_6           NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_7           NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_8           NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_9           NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_10          NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_11          NUMERIC(18, 4) NOT NULL DEFAULT 0,
  quantidade_12          NUMERIC(18, 4) NOT NULL DEFAULT 0,

  funcao_colaborador     VARCHAR(255),

  meta                   NUMERIC(18, 4),
  horas                  NUMERIC(18, 4),

  observacoes            TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_octe_data ON public."OCTE"(data);
CREATE INDEX IF NOT EXISTS idx_octe_codigo_documento ON public."OCTE"(codigo_documento);
CREATE INDEX IF NOT EXISTS idx_octe_filial_nome ON public."OCTE"(filial_nome);
CREATE INDEX IF NOT EXISTS idx_octe_codigo_item ON public."OCTE"(codigo_item);
CREATE INDEX IF NOT EXISTS idx_octe_peso ON public."OCTE"(peso);
CREATE INDEX IF NOT EXISTS idx_octe_colaborador ON public."OCTE"(colaborador);

CREATE OR REPLACE FUNCTION public.update_octe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_octe_updated_at ON public."OCTE";
CREATE TRIGGER trg_octe_updated_at
  BEFORE UPDATE ON public."OCTE"
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_octe_updated_at();

COMMENT ON TABLE public."OCTE" IS 'Objeto de Cadastro de Tabela de empacotamento';
COMMENT ON COLUMN public."OCTE".data IS 'Data';
COMMENT ON COLUMN public."OCTE".codigo_documento IS 'Código do documento (lote); várias linhas podem compartilhar';
COMMENT ON COLUMN public."OCTE".filial_nome IS 'Nome da filial (alinhado ao cadastro OCTF / demais módulos)';
COMMENT ON COLUMN public."OCTE".codigo_item IS 'Código do item';
COMMENT ON COLUMN public."OCTE".descricao_item IS 'Descrição do item';
COMMENT ON COLUMN public."OCTE".unidade_item IS 'Unidade do item';
COMMENT ON COLUMN public."OCTE".peso IS 'Peso do item em kg';
COMMENT ON COLUMN public."OCTE".colaborador IS 'Colaborador';
COMMENT ON COLUMN public."OCTE".quantidade_1 IS 'Quantidade 1';
COMMENT ON COLUMN public."OCTE".quantidade_2 IS 'Quantidade 2';
COMMENT ON COLUMN public."OCTE".quantidade_3 IS 'Quantidade 3';
COMMENT ON COLUMN public."OCTE".quantidade_4 IS 'Quantidade 4';
COMMENT ON COLUMN public."OCTE".quantidade_5 IS 'Quantidade 5';
COMMENT ON COLUMN public."OCTE".quantidade_6 IS 'Quantidade 6';
COMMENT ON COLUMN public."OCTE".quantidade_7 IS 'Quantidade 7';
COMMENT ON COLUMN public."OCTE".quantidade_8 IS 'Quantidade 8';
COMMENT ON COLUMN public."OCTE".quantidade_9 IS 'Quantidade 9';
COMMENT ON COLUMN public."OCTE".quantidade_10 IS 'Quantidade 10';
COMMENT ON COLUMN public."OCTE".quantidade_11 IS 'Quantidade 11';
COMMENT ON COLUMN public."OCTE".quantidade_12 IS 'Quantidade 12';
COMMENT ON COLUMN public."OCTE".funcao_colaborador IS 'Função do Colaborador';
COMMENT ON COLUMN public."OCTE".meta IS 'Meta';
COMMENT ON COLUMN public."OCTE".horas IS 'Horas';
COMMENT ON COLUMN public."OCTE".observacoes IS 'Observações';
