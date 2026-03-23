-- Remove a coluna "Bi- Horária" (time) da tabela OCPD.
-- Execute no SQL Editor do Supabase (ou psql) após backup se necessário.
-- Os registros agregados por turno continuam em bi_horaria_registros (JSONB).

ALTER TABLE public."OCPD"
  DROP COLUMN IF EXISTS "Bi- Horária";
