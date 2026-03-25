-- ============================================================================
-- RLS — tabela CDTP (Cadastro de tipo de produtos)
-- Execute no Supabase após CDTP_TABLE.sql
-- ============================================================================

ALTER TABLE public."CDTP" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cdtp_authenticated_all" ON public."CDTP";
CREATE POLICY "cdtp_authenticated_all" ON public."CDTP"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
