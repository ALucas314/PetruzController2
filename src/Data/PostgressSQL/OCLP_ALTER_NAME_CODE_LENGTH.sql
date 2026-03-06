-- ============================================================================
-- Obrigatório para nomes longos: aumentar limite da coluna Name na OCLP
-- Execute no Supabase (SQL Editor) para que a descrição da linha apareça completa.
-- ============================================================================

ALTER TABLE "OCLP"
  ALTER COLUMN "Code" TYPE character varying(50),
  ALTER COLUMN "Name" TYPE character varying(255);
