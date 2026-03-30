-- ============================================================================
-- Tabela OCTC — Objeto de Cadastro da tabela de colaboradores
--
-- Execute no Supabase: SQL Editor → New query → Run
-- Depois: OCTC_RLS_PERMITIR_LEITURA.sql (e o bloco OCTC em RLS_TODAS_TABELAS_FRONTEND.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."OCTC" (
  id                     BIGSERIAL PRIMARY KEY,

  codigo_do_documento    VARCHAR(60) NOT NULL,
  nome_do_colaborador    VARCHAR(50) NOT NULL,
  setor                  VARCHAR(30) NOT NULL,
  filial_nome            VARCHAR(120) NOT NULL DEFAULT '',

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_octc_codigo_do_documento ON public."OCTC"(codigo_do_documento);
CREATE INDEX IF NOT EXISTS idx_octc_nome_do_colaborador ON public."OCTC"(nome_do_colaborador);
CREATE INDEX IF NOT EXISTS idx_octc_setor ON public."OCTC"(setor);
CREATE INDEX IF NOT EXISTS idx_octc_filial_nome ON public."OCTC"(filial_nome);

CREATE OR REPLACE FUNCTION public.update_octc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_octc_updated_at ON public."OCTC";
CREATE TRIGGER trg_octc_updated_at
  BEFORE UPDATE ON public."OCTC"
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_octc_updated_at();

COMMENT ON TABLE public."OCTC" IS 'Objeto de Cadastro da tabela de colaboradores';
COMMENT ON COLUMN public."OCTC".codigo_do_documento IS 'Código do documento (ex.: vínculo com lote / identificador lógico)';
COMMENT ON COLUMN public."OCTC".nome_do_colaborador IS 'Nome do colaborador';
COMMENT ON COLUMN public."OCTC".setor IS 'Setor';
COMMENT ON COLUMN public."OCTC".filial_nome IS 'Nome da filial (referência ao cadastro de filiais / contexto operacional)';
