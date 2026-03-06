-- ============================================================================
-- Sincronizar usuários do Supabase Auth (auth.users) para a tabela OCTU
-- Assim, todo cadastro pelo app passa a aparecer na OCTU.
-- Execute no SQL Editor do Supabase (Dashboard → SQL Editor → New query).
-- ============================================================================

-- 1) Função: ao criar usuário no Auth, inserir na OCTU (email, nome, ativo).
--    password_hash recebe placeholder pois a senha fica só no Auth.
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_octu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."OCTU" (email, nome, password_hash, ativo)
  VALUES (
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', ''),
    '[Supabase Auth]',
    true
  )
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2) Trigger: após INSERT em auth.users, chamar a função acima.
DROP TRIGGER IF EXISTS on_auth_user_created_sync_octu ON auth.users;
CREATE TRIGGER on_auth_user_created_sync_octu
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user_to_octu();

-- 3) Preencher OCTU com usuários que já existem no Auth (rode uma vez).
INSERT INTO public."OCTU" (email, nome, password_hash, ativo)
SELECT
  u.email,
  COALESCE(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'name', ''),
  '[Supabase Auth]',
  true
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public."OCTU" o WHERE o.email = u.email);
