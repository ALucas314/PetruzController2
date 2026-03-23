-- ============================================================================
-- RLS (Row Level Security) para a tabela OCPH
--
-- Permite que usuários autenticados (frontend com Supabase Auth) possam
-- SELECT, INSERT, UPDATE e DELETE na tabela OCPH.
--
-- Execute no Supabase: SQL Editor → New query → Run
-- (A tabela OCPH deve existir — execute antes OCPH_TABLE.sql)
-- ============================================================================

ALTER TABLE "OCPH" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocph_authenticated_all" ON "OCPH";
CREATE POLICY "ocph_authenticated_all" ON "OCPH"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
