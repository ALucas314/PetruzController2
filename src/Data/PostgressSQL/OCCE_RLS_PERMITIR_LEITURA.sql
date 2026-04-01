-- ============================================================================
-- RLS — tabela OCCE (controle de estoque)
-- Execute no Supabase após OCCE_TABLE.sql
-- ============================================================================

ALTER TABLE public."OCCE" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "occe_authenticated_all" ON public."OCCE";
CREATE POLICY "occe_authenticated_all" ON public."OCCE"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
