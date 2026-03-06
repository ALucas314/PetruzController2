-- ============================================================================
-- Para ao digitar o código do item aparecer a descrição: permitir leitura na OCTI
-- Execute no Supabase: SQL Editor → New query → cole e clique Run
-- ============================================================================

ALTER TABLE "OCTI" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "octi_authenticated_all" ON "OCTI";
CREATE POLICY "octi_authenticated_all" ON "OCTI"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
