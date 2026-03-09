-- ============================================================================
-- RLS (Row Level Security) para a tabela OCTP
--
-- Permite que usuários autenticados (frontend com Supabase Auth) possam
-- SELECT, INSERT, UPDATE e DELETE na tabela OCTP (Problemas e Ações).
-- Sem esta política, as operações retornam 403 (new row violates row-level security).
--
-- Execute no Supabase: SQL Editor → New query → cole e clique Run
-- ============================================================================

ALTER TABLE "OCTP" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "octp_authenticated_all" ON "OCTP";
CREATE POLICY "octp_authenticated_all" ON "OCTP"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
