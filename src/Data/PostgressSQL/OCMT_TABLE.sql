-- ============================================================================
-- Tabela OCMT — Objeto de cadastro de movimentação de túneis
--
-- doc_entry: automático via sequência public.ocmt_doc_entry_seq
-- numero_documento: automático, espelha doc_entry (GENERATED ALWAYS AS STORED)
--
-- Códigos de túnel e tipo de produto: mesma filial + código (OCTT e CDTP).
--
-- Execute no Supabase: SQL Editor → Run
-- Requer em OCTT e CDTP: UNIQUE (filial_nome, codigo_documento) para as FKs.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.ocmt_doc_entry_seq;

CREATE TABLE IF NOT EXISTS public."OCMT" (
  id                      BIGSERIAL PRIMARY KEY,

  doc_entry               BIGINT NOT NULL UNIQUE
                            DEFAULT nextval('public.ocmt_doc_entry_seq'),

  -- Sempre igual a doc_entry; somente leitura no INSERT/UPDATE
  numero_documento        BIGINT NOT NULL
                            GENERATED ALWAYS AS (doc_entry) STORED
                            UNIQUE,

  filial_nome             VARCHAR(255) NOT NULL,
  codigo_tunel            INTEGER NOT NULL,
  codigo_tipo_produto     INTEGER NOT NULL,

  qtd_inserida            NUMERIC(18, 4) NOT NULL DEFAULT 0
                            CHECK (qtd_inserida >= 0),

  data_fechamento         DATE,
  hora_fechamento         TIME WITHOUT TIME ZONE,
  data_abertura           DATE,

  observacao              TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ocmt_fk_tunel FOREIGN KEY (filial_nome, codigo_tunel)
    REFERENCES public."OCTT"(filial_nome, codigo_documento)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT ocmt_fk_tipo_produto FOREIGN KEY (filial_nome, codigo_tipo_produto)
    REFERENCES public."CDTP"(filial_nome, codigo_documento)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

SELECT setval(
  'public.ocmt_doc_entry_seq',
  COALESCE((SELECT MAX(doc_entry) FROM public."OCMT"), 0)
);

CREATE INDEX IF NOT EXISTS idx_ocmt_filial_data_abertura
  ON public."OCMT"(filial_nome, data_abertura);

CREATE INDEX IF NOT EXISTS idx_ocmt_filial_data_fechamento
  ON public."OCMT"(filial_nome, data_fechamento);

CREATE INDEX IF NOT EXISTS idx_ocmt_doc_entry ON public."OCMT"(doc_entry);

CREATE OR REPLACE FUNCTION public.update_ocmt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocmt_updated_at ON public."OCMT";
CREATE TRIGGER trg_ocmt_updated_at
  BEFORE UPDATE ON public."OCMT"
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_ocmt_updated_at();

COMMENT ON TABLE public."OCMT" IS 'Objeto de cadastro de movimentação de túneis';
COMMENT ON COLUMN public."OCMT".doc_entry IS 'DocEntry automático (sequência ocmt_doc_entry_seq)';
COMMENT ON COLUMN public."OCMT".numero_documento IS 'Número do documento; gerado automaticamente (= doc_entry)';
COMMENT ON COLUMN public."OCMT".filial_nome IS 'Filial (OCTF); amarra túnel e tipo de produto';
COMMENT ON COLUMN public."OCMT".codigo_tunel IS 'Código do túnel (OCTT.codigo_documento nesta filial)';
COMMENT ON COLUMN public."OCMT".codigo_tipo_produto IS 'Código do tipo de produto (CDTP.codigo_documento nesta filial)';
COMMENT ON COLUMN public."OCMT".qtd_inserida IS 'Quantidade inserida';
COMMENT ON COLUMN public."OCMT".data_fechamento IS 'Data do fechamento';
COMMENT ON COLUMN public."OCMT".hora_fechamento IS 'Hora do fechamento';
COMMENT ON COLUMN public."OCMT".data_abertura IS 'Data de abertura';
COMMENT ON COLUMN public."OCMT".observacao IS 'Observação';

-- ============================================================================
-- Exemplos (comentados) — ajuste filial/códigos a registros reais em OCTT/CDTP
-- ============================================================================
--
-- INSERT INTO public."OCMT" (
--   filial_nome,
--   codigo_tunel,
--   codigo_tipo_produto,
--   qtd_inserida,
--   data_abertura,
--   data_fechamento,
--   hora_fechamento,
--   observacao
-- ) VALUES (
--   'BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA',
--   1,
--   1,
--   1250.5000,
--   CURRENT_DATE - 1,
--   CURRENT_DATE,
--   '14:30:00',
--   'Exemplo de movimentação'
-- );
-- -- doc_entry e numero_documento são preenchidos sozinhos.
--
-- SELECT
--   m.id,
--   m.doc_entry,
--   m.numero_documento,
--   m.filial_nome,
--   m.codigo_tunel,
--   m.codigo_tipo_produto,
--   m.qtd_inserida,
--   m.data_abertura,
--   m.data_fechamento,
--   m.hora_fechamento,
--   m.observacao,
--   m.created_at,
--   t.nome AS nome_tunel,
--   p.nome AS nome_tipo_produto
-- FROM public."OCMT" m
-- LEFT JOIN public."OCTT" t
--   ON t.filial_nome = m.filial_nome
--  AND t.codigo_documento = m.codigo_tunel
-- LEFT JOIN public."CDTP" p
--   ON p.filial_nome = m.filial_nome
--  AND p.codigo_documento = m.codigo_tipo_produto
-- WHERE m.filial_nome = 'BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA'
-- ORDER BY m.doc_entry DESC;
--
-- ============================================================================
-- Depois: OCMT_RLS_PERMITIR_LEITURA.sql (e bloco em RLS_TODAS_TABELAS_FRONTEND.sql)
-- ============================================================================
