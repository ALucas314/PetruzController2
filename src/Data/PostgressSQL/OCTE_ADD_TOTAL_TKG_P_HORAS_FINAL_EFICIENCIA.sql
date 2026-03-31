-- ============================================================================
-- OCTE: adicionar colunas de cálculo/indicadores
--   - Total
--   - T. KG
--   - P. Horas. Final
--   - Eficiência
--
-- Nomes técnicos (snake_case):
--   total
--   t_kg
--   p_horas_final
--   eficiencia
--
-- Execute no Supabase: SQL Editor -> New query -> Run
-- ============================================================================

ALTER TABLE public."OCTE"
  ADD COLUMN IF NOT EXISTS total NUMERIC(18,4),
  ADD COLUMN IF NOT EXISTS t_kg NUMERIC(18,4),
  ADD COLUMN IF NOT EXISTS p_horas_final NUMERIC(18,4),
  ADD COLUMN IF NOT EXISTS eficiencia NUMERIC(18,4);

COMMENT ON COLUMN public."OCTE".total IS 'Total';
COMMENT ON COLUMN public."OCTE".t_kg IS 'T. KG';
COMMENT ON COLUMN public."OCTE".p_horas_final IS 'P. Horas. Final';
COMMENT ON COLUMN public."OCTE".eficiencia IS 'Eficiência';

