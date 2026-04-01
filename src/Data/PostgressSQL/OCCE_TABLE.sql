-- ============================================================================
-- Tabela OCCE — Objeto de cadastro de controle de estoque
--
-- doc_entry / numero_documento: automáticos (mesmo padrão da OCMT).
-- Amarração ao túnel: FK (filial_nome, codigo_tunel) → OCTT.
--
-- Execute no Supabase: SQL Editor → Run
-- Depois: OCCE_RLS_PERMITIR_LEITURA.sql (e bloco em RLS_TODAS_TABELAS_FRONTEND.sql)
-- Habilitar Realtime (opcional): Database → Replication → public.OCCE
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.occe_doc_entry_seq;

CREATE TABLE IF NOT EXISTS public."OCCE" (
  id                      BIGSERIAL PRIMARY KEY,

  doc_entry               BIGINT NOT NULL UNIQUE
                            DEFAULT nextval('public.occe_doc_entry_seq'),

  numero_documento        BIGINT NOT NULL
                            GENERATED ALWAYS AS (doc_entry) STORED
                            UNIQUE,

  data_movimento          DATE NOT NULL,

  codigo_produto          VARCHAR(80) NOT NULL,
  descricao_item          TEXT NOT NULL DEFAULT '',
  unidade_medida          VARCHAR(80) NOT NULL DEFAULT '',
  grupo_itens             TEXT NOT NULL DEFAULT '',

  lote                    VARCHAR(120),

  data_fabricacao         DATE,
  data_vencimento         DATE,

  diferenca_dias_fab_venc INTEGER NOT NULL DEFAULT 0,

  status_validade         VARCHAR(20) NOT NULL DEFAULT 'No prazo'
                            CHECK (status_validade IN ('No prazo', 'Vencido')),

  processo                VARCHAR(10) NOT NULL
                            CHECK (processo IN ('entrada', 'saida')),

  quantidade              NUMERIC(18, 4) NOT NULL
                            CHECK (quantidade > 0),

  custo_unitario          NUMERIC(18, 4) NOT NULL DEFAULT 0
                            CHECK (custo_unitario >= 0),

  valor_total             NUMERIC(18, 4) NOT NULL DEFAULT 0
                            CHECK (valor_total >= 0),

  filial_nome             VARCHAR(255) NOT NULL,
  codigo_tunel            INTEGER NOT NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT occe_fk_tunel FOREIGN KEY (filial_nome, codigo_tunel)
    REFERENCES public."OCTT"(filial_nome, codigo_documento)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- setval não aceita 0 (faixa 1..9223372036854775807). Tabela vazia: próximo doc_entry = 1.
SELECT setval(
  'public.occe_doc_entry_seq',
  GREATEST(COALESCE((SELECT MAX(doc_entry) FROM public."OCCE"), 1), 1),
  COALESCE((SELECT MAX(doc_entry) FROM public."OCCE"), 0) > 0
);

CREATE INDEX IF NOT EXISTS idx_occe_filial_data
  ON public."OCCE"(filial_nome, data_movimento DESC);

CREATE INDEX IF NOT EXISTS idx_occe_codigo_produto
  ON public."OCCE"(codigo_produto);

CREATE INDEX IF NOT EXISTS idx_occe_doc_entry
  ON public."OCCE"(doc_entry DESC);

CREATE OR REPLACE FUNCTION public.update_occe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_occe_updated_at ON public."OCCE";
CREATE TRIGGER trg_occe_updated_at
  BEFORE UPDATE ON public."OCCE"
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_occe_updated_at();

COMMENT ON TABLE public."OCCE" IS 'Objeto de cadastro de controle de estoque';
COMMENT ON COLUMN public."OCCE".doc_entry IS 'Número sequencial do documento (occe_doc_entry_seq)';
COMMENT ON COLUMN public."OCCE".numero_documento IS 'Espelho de doc_entry (somente leitura)';
COMMENT ON COLUMN public."OCCE".data_movimento IS 'Data da movimentação';
COMMENT ON COLUMN public."OCCE".codigo_produto IS 'Código do item (ex.: catálogo CSV)';
COMMENT ON COLUMN public."OCCE".processo IS 'entrada ou saida';
COMMENT ON COLUMN public."OCCE".codigo_tunel IS 'Código do túnel (OCTT.codigo_documento nesta filial)';
