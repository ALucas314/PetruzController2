-- ============================================================================
-- Migração: adicionar coluna Grupo nos reprocessos (OCPD e OCPR)
-- Opções fixas: Reprocesso | Matéria Prima Açaí | Matéria Prima Fruto
-- Não é necessário criar tabela OCPR: o grupo já é salvo no JSONB "reprocessos"
-- da OCPD (cada elemento do array pode ter "grupo"). Esta migração adiciona a
-- coluna reprocesso_grupo (espelho do 1º) e, se existir a tabela OCPR, a coluna grupo.
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

-- 1) OCPD: coluna reprocesso_grupo (espelho do 1º reprocesso, para consultas/legado)
ALTER TABLE "OCPD"
  ADD COLUMN IF NOT EXISTS reprocesso_grupo VARCHAR(100);

COMMENT ON COLUMN "OCPD".reprocesso_grupo IS 'Grupo do reprocesso: Reprocesso, Matéria Prima Açaí ou Matéria Prima Fruto';


-- 2) OCPR: coluna grupo (só executa se a tabela OCPR existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'OCPR'
  ) THEN
    ALTER TABLE "OCPR" ADD COLUMN IF NOT EXISTS grupo VARCHAR(100);
    COMMENT ON COLUMN "OCPR".grupo IS 'Grupo do reprocesso: Reprocesso, Matéria Prima Açaí ou Matéria Prima Fruto';
  END IF;
END $$;

-- Opcional: restringir valores (CHECK). Descomente se quiser validar no banco (e se OCPR existir):
-- ALTER TABLE "OCPR" DROP CONSTRAINT IF EXISTS chk_ocpr_grupo;
-- ALTER TABLE "OCPR" ADD CONSTRAINT chk_ocpr_grupo
--   CHECK (grupo IS NULL OR grupo IN ('Reprocesso', 'Matéria Prima Açaí', 'Matéria Prima Fruto'));
