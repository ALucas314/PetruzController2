-- ============================================================================
-- OCPD: recalcular p_hora_final automaticamente no banco
-- Regra: p_hora_final = qtd_realizada / qtd_hs
-- - Se qtd_hs for nulo, vazio ou <= 0 => p_hora_final = NULL
-- - Recalcula em INSERT e UPDATE de qtd_hs/qtd_realizada
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ocpd_set_prod_hora()
RETURNS TRIGGER AS $$
DECLARE
  v_qtd_hs NUMERIC;
  v_qtd_realizada NUMERIC;
BEGIN
  v_qtd_hs := NULLIF(TRIM(COALESCE(NEW.qtd_hs::text, '')), '')::NUMERIC;
  v_qtd_realizada := COALESCE(NEW.qtd_realizada, 0);

  IF v_qtd_hs IS NULL OR v_qtd_hs <= 0 THEN
    NEW.p_hora_final := NULL;
  ELSE
    NEW.p_hora_final := v_qtd_realizada / v_qtd_hs;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocpd_set_prod_hora ON public."OCPD";
CREATE TRIGGER trg_ocpd_set_prod_hora
  BEFORE INSERT OR UPDATE OF qtd_hs, qtd_realizada
  ON public."OCPD"
  FOR EACH ROW
  EXECUTE FUNCTION public.ocpd_set_prod_hora();

-- (Opcional) Recalcular registros já existentes
UPDATE public."OCPD"
SET p_hora_final = CASE
  WHEN qtd_hs IS NULL OR qtd_hs <= 0 THEN NULL
  ELSE qtd_realizada / qtd_hs
END;

