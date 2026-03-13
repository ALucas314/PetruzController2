-- ============================================================================
-- Migração: Grupo nos reprocessos — apenas OCPR; OCPD não tem coluna reprocesso_grupo
-- O grupo fica somente no JSONB "reprocessos" da OCPD (cada elemento pode ter "grupo").
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

-- Remover coluna reprocesso_grupo da OCPD se existir (não deve ser usada)
ALTER TABLE "OCPD"
  DROP COLUMN IF EXISTS reprocesso_grupo;

-- OCPR: coluna grupo (só executa se a tabela OCPR existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'OCPR'
  ) THEN
    ALTER TABLE "OCPR" ADD COLUMN IF NOT EXISTS grupo VARCHAR(100);
    EXECUTE 'COMMENT ON COLUMN "OCPR".grupo IS ''Grupo do reprocesso: Reprocesso, Matéria Prima Açaí ou Matéria Prima Fruto''';
  END IF;
END $$;

-- Opcional: restringir valores (CHECK). Descomente se quiser validar no banco (e se OCPR existir):
-- ALTER TABLE "OCPR" DROP CONSTRAINT IF EXISTS chk_ocpr_grupo;
-- ALTER TABLE "OCPR" ADD CONSTRAINT chk_ocpr_grupo
--   CHECK (grupo IS NULL OR grupo IN ('Reprocesso', 'Matéria Prima Açaí', 'Matéria Prima Fruto'));
