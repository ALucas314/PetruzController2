-- ============================================================================
-- OCTE: calcular automaticamente total, t_kg, p_horas_final e eficiencia
--
-- Regras adotadas:
--   total         = soma(quantidade_1 ... quantidade_12)
--   t_kg          = total * peso
--   p_horas_final = total / horas                (NULL se horas <= 0)
--   eficiencia    = (total / meta) * 100         (NULL se meta <= 0)
--   meta_kg       = meta * peso                  (NULL se meta NULL ou <= 0)
--
-- Execute no Supabase: SQL Editor -> Run
-- Recomendado após:
--   - OCTE_ADD_TOTAL_TKG_P_HORAS_FINAL_EFICIENCIA.sql
--   - OCTE_ADD_META_KG.sql (coluna meta_kg)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.octe_calc_campos_derivados()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC;
  v_peso NUMERIC;
  v_horas NUMERIC;
  v_meta NUMERIC;
BEGIN
  v_total :=
      COALESCE(NEW.quantidade_1, 0)
    + COALESCE(NEW.quantidade_2, 0)
    + COALESCE(NEW.quantidade_3, 0)
    + COALESCE(NEW.quantidade_4, 0)
    + COALESCE(NEW.quantidade_5, 0)
    + COALESCE(NEW.quantidade_6, 0)
    + COALESCE(NEW.quantidade_7, 0)
    + COALESCE(NEW.quantidade_8, 0)
    + COALESCE(NEW.quantidade_9, 0)
    + COALESCE(NEW.quantidade_10, 0)
    + COALESCE(NEW.quantidade_11, 0)
    + COALESCE(NEW.quantidade_12, 0);

  v_peso := COALESCE(NEW.peso, 0);
  v_horas := NEW.horas;
  v_meta := NEW.meta;

  NEW.total := v_total;
  NEW.t_kg := v_total * v_peso;
  NEW.p_horas_final := CASE
    WHEN v_horas IS NULL OR v_horas <= 0 THEN NULL
    ELSE v_total / v_horas
  END;
  NEW.eficiencia := CASE
    WHEN v_meta IS NULL OR v_meta <= 0 THEN NULL
    ELSE (v_total / v_meta) * 100
  END;
  NEW.meta_kg := CASE
    WHEN v_meta IS NULL OR v_meta <= 0 THEN NULL
    ELSE v_meta * v_peso
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_octe_calc_campos_derivados ON public."OCTE";
CREATE TRIGGER trg_octe_calc_campos_derivados
BEFORE INSERT OR UPDATE OF
  quantidade_1, quantidade_2, quantidade_3, quantidade_4, quantidade_5, quantidade_6,
  quantidade_7, quantidade_8, quantidade_9, quantidade_10, quantidade_11, quantidade_12,
  peso, horas, meta
ON public."OCTE"
FOR EACH ROW
EXECUTE FUNCTION public.octe_calc_campos_derivados();

-- Recalcular registros já existentes
UPDATE public."OCTE"
SET
  total =
      COALESCE(quantidade_1, 0)
    + COALESCE(quantidade_2, 0)
    + COALESCE(quantidade_3, 0)
    + COALESCE(quantidade_4, 0)
    + COALESCE(quantidade_5, 0)
    + COALESCE(quantidade_6, 0)
    + COALESCE(quantidade_7, 0)
    + COALESCE(quantidade_8, 0)
    + COALESCE(quantidade_9, 0)
    + COALESCE(quantidade_10, 0)
    + COALESCE(quantidade_11, 0)
    + COALESCE(quantidade_12, 0),
  t_kg =
    (
        COALESCE(quantidade_1, 0)
      + COALESCE(quantidade_2, 0)
      + COALESCE(quantidade_3, 0)
      + COALESCE(quantidade_4, 0)
      + COALESCE(quantidade_5, 0)
      + COALESCE(quantidade_6, 0)
      + COALESCE(quantidade_7, 0)
      + COALESCE(quantidade_8, 0)
      + COALESCE(quantidade_9, 0)
      + COALESCE(quantidade_10, 0)
      + COALESCE(quantidade_11, 0)
      + COALESCE(quantidade_12, 0)
    ) * COALESCE(peso, 0),
  p_horas_final = CASE
    WHEN horas IS NULL OR horas <= 0 THEN NULL
    ELSE (
        COALESCE(quantidade_1, 0)
      + COALESCE(quantidade_2, 0)
      + COALESCE(quantidade_3, 0)
      + COALESCE(quantidade_4, 0)
      + COALESCE(quantidade_5, 0)
      + COALESCE(quantidade_6, 0)
      + COALESCE(quantidade_7, 0)
      + COALESCE(quantidade_8, 0)
      + COALESCE(quantidade_9, 0)
      + COALESCE(quantidade_10, 0)
      + COALESCE(quantidade_11, 0)
      + COALESCE(quantidade_12, 0)
    ) / horas
  END,
  eficiencia = CASE
    WHEN meta IS NULL OR meta <= 0 THEN NULL
    ELSE (
      (
          COALESCE(quantidade_1, 0)
        + COALESCE(quantidade_2, 0)
        + COALESCE(quantidade_3, 0)
        + COALESCE(quantidade_4, 0)
        + COALESCE(quantidade_5, 0)
        + COALESCE(quantidade_6, 0)
        + COALESCE(quantidade_7, 0)
        + COALESCE(quantidade_8, 0)
        + COALESCE(quantidade_9, 0)
        + COALESCE(quantidade_10, 0)
        + COALESCE(quantidade_11, 0)
        + COALESCE(quantidade_12, 0)
      ) / meta
    ) * 100
  END,
  meta_kg = CASE
    WHEN meta IS NULL OR meta <= 0 THEN NULL
    ELSE meta * COALESCE(peso, 0)
  END;

