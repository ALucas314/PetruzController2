-- ============================================================================
-- Se o campo Filial não lista as filiais: permitir leitura na OCTF para usuários autenticados
-- Execute no Supabase: SQL Editor → New query → cole e clique Run
-- ============================================================================

-- Habilitar RLS na OCTF (se ainda não estiver)
ALTER TABLE "OCTF" ENABLE ROW LEVEL SECURITY;

-- Remover política antiga se existir e criar uma que permite tudo para usuário autenticado
DROP POLICY IF EXISTS "octf_authenticated_all" ON "OCTF";
CREATE POLICY "octf_authenticated_all" ON "OCTF"
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Opcional: se quiser que anônimo também leia (ex.: tela de login antes de logar), descomente:
-- DROP POLICY IF EXISTS "octf_anon_select" ON "OCTF";
-- CREATE POLICY "octf_anon_select" ON "OCTF" FOR SELECT TO anon USING (true);
