-- ============================================================================
-- Migração: coluna bi_horaria_registros (JSONB) na tabela OCPD
-- Registros agregados por turno (Manhã / Tarde / Noite / Madrugada) com
-- código do item e quantidades planejada/realizada — independente das linhas
-- principais de produção. Gravado no primeiro registro OCPD do documento
-- (mesmo padrão da coluna "reprocessos").
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

ALTER TABLE public."OCPD"
  ADD COLUMN IF NOT EXISTS bi_horaria_registros JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ocpd_bi_horaria_registros ON public."OCPD" USING GIN (bi_horaria_registros);

COMMENT ON COLUMN public."OCPD".bi_horaria_registros IS 'Array JSON: [{"numero": 1, "periodo": "Manhã"|"Tarde"|"Noite"|"Madrugada", "codigo_item": "...", "descricao_item": "...", "qtd_planejada": 0, "qtd_realizada": 0}, ...]';
