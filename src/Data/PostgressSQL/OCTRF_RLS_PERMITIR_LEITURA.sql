-- ============================================================================
-- RLS — tabela OCTRF (Objeto de Cadastro da tabela de funções)
-- Execute no Supabase: SQL Editor → New query → Run (sempre após OCTRF_TABLE.sql)
--
-- Mesmo padrão de OCTC, OCTE, OCTF (filiais), etc.: role authenticated pode
-- SELECT/INSERT/UPDATE/DELETE. Sem política, com RLS ativo, o cliente retorna 0 linhas.
--
-- Alternativa: rode só o bloco "-- OCTRF" em RLS_TODAS_TABELAS_FRONTEND.sql
-- ============================================================================

ALTER TABLE public."OCTRF" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "octrf_authenticated_all" ON public."OCTRF";
CREATE POLICY "octrf_authenticated_all" ON public."OCTRF"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
