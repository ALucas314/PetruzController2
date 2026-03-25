-- ============================================================================
-- RLS (Row Level Security) para a tabela OCTT
--
-- Permite que usuários autenticados (frontend com Supabase Auth) possam
-- SELECT, INSERT, UPDATE e DELETE na tabela OCTT (Cadastro de Túneis).
-- Sem esta política, INSERT retorna: new row violates row level security policy.
--
-- Execute no Supabase: SQL Editor → New query → cole e clique Run
-- ============================================================================

ALTER TABLE "OCTT" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "octt_authenticated_all" ON "OCTT";
CREATE POLICY "octt_authenticated_all" ON "OCTT"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
