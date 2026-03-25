-- ============================================================================
-- RLS — tabela OCMT (movimentação de túneis)
-- Execute no Supabase após OCMT_TABLE.sql
-- ============================================================================

ALTER TABLE public."OCMT" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocmt_authenticated_all" ON public."OCMT";
CREATE POLICY "ocmt_authenticated_all" ON public."OCMT"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
