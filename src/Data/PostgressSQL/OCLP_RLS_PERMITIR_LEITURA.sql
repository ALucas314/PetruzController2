-- ============================================================================
-- Se o campo Linha não lista as linhas: permitir leitura na OCLP para usuários autenticados
-- Execute no Supabase: SQL Editor → New query → cole e clique Run
-- ============================================================================

ALTER TABLE "OCLP" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oclp_authenticated_all" ON "OCLP";
CREATE POLICY "oclp_authenticated_all" ON "OCLP"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
