-- ============================================================================
-- RLS — tabela OCTC (Objeto de Cadastro da tabela de colaboradores)
-- Execute no Supabase após OCTC_TABLE.sql
--
-- Mesmo padrão das demais tabelas do frontend: usuário autenticado (role
-- authenticated) pode SELECT/INSERT/UPDATE/DELETE. O anon sem login continua
-- sem acesso às linhas até você definir políticas para anon (não usado aqui).
-- ============================================================================

ALTER TABLE public."OCTC" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "octc_authenticated_all" ON public."OCTC";
CREATE POLICY "octc_authenticated_all" ON public."OCTC"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
