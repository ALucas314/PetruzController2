-- ============================================================================
-- Histórico de Análise de Produção: permitir leitura e escrita na OCPD
--
-- Antes: a API (backend) lia a tabela OCPD com a chave service_role do Supabase,
-- que ignora RLS — por isso o histórico aparecia sem precisar de política.
-- Agora: o frontend chama o Supabase direto (anon key + usuário autenticado),
-- então RLS vale. Sem esta política, a consulta retorna 0 linhas.
--
-- Os dados continuam na mesma tabela OCPD; não é outra tabela.
-- Execute no Supabase: SQL Editor → New query → cole e clique Run
-- ============================================================================

ALTER TABLE "OCPD" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocpd_authenticated_all" ON "OCPD";
CREATE POLICY "ocpd_authenticated_all" ON "OCPD"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
