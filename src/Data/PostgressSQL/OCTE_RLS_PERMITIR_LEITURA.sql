-- ============================================================================
-- RLS — tabela OCTE (tabela de empacotamento)
-- Execute no Supabase após OCTE_TABLE.sql
-- ============================================================================

ALTER TABLE public."OCTE" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "octe_authenticated_all" ON public."OCTE";
CREATE POLICY "octe_authenticated_all" ON public."OCTE"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
