-- ============================================================================
-- Tabela OCTRF — Objeto de Cadastro da tabela de funções
--
-- Por que NÃO usar o nome "OCTF" aqui:
--   No seu banco, "OCTF" já é a tabela de FILIAIS (Code, Name, Address).
--   CREATE TABLE IF NOT EXISTS "OCTF" (...) não altera tabela existente — só
--   pula a criação. Os CREATE INDEX / COMMENT em seguida passam a referenciar
--   colunas como numero_do_documento que não existem na OCTF de filiais →
--   ERROR 42703: column "numero_do_documento" does not exist.
--
-- Cadastro de funções = tabela OCTRF (abaixo). OCTF permanece só para filiais.
--
-- Execute no Supabase: SQL Editor → Run
-- Depois: OCTRF_RLS_PERMITIR_LEITURA.sql (e bloco OCTRF em RLS_TODAS_TABELAS_FRONTEND.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public."OCTRF" (
  id                     BIGSERIAL PRIMARY KEY,

  numero_do_documento    VARCHAR(60) NOT NULL,
  nome_da_funcao         VARCHAR(120) NOT NULL,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_octrf_numero_do_documento ON public."OCTRF"(numero_do_documento);
CREATE INDEX IF NOT EXISTS idx_octrf_nome_da_funcao ON public."OCTRF"(nome_da_funcao);

CREATE OR REPLACE FUNCTION public.update_octrf_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_octrf_updated_at ON public."OCTRF";
CREATE TRIGGER trg_octrf_updated_at
  BEFORE UPDATE ON public."OCTRF"
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_octrf_updated_at();

COMMENT ON TABLE public."OCTRF" IS 'Objeto de Cadastro da tabela de funções';
COMMENT ON COLUMN public."OCTRF".numero_do_documento IS 'Número do documento';
COMMENT ON COLUMN public."OCTRF".nome_da_funcao IS 'Nome da função';
