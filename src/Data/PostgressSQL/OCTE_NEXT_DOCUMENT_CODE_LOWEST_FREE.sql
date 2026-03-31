-- ============================================================================
-- OCTE: próximo código de documento pelo menor número livre (0001, 0002, ...)
--
-- Regra:
--   - Considera apenas codigo_documento numérico (ignora UUID/texto legado)
--   - Retorna o menor inteiro positivo não utilizado
--   - Formata com 4 dígitos (ex.: 0001)
--
-- Uso no Supabase (SQL Editor):
--   SELECT public.octe_next_document_code_lowest_free();
-- ============================================================================

CREATE OR REPLACE FUNCTION public.octe_next_document_code_lowest_free()
RETURNS VARCHAR(20)
LANGUAGE plpgsql
AS $$
DECLARE
  v_next INTEGER := 1;
BEGIN
  WITH used AS (
    SELECT DISTINCT CAST(codigo_documento AS INTEGER) AS n
    FROM public."OCTE"
    WHERE codigo_documento ~ '^[0-9]+$'
      AND CAST(codigo_documento AS INTEGER) > 0
  )
  SELECT gs.n
  INTO v_next
  FROM generate_series(1, COALESCE((SELECT MAX(n) FROM used), 0) + 1) AS gs(n)
  LEFT JOIN used u ON u.n = gs.n
  WHERE u.n IS NULL
  ORDER BY gs.n
  LIMIT 1;

  RETURN LPAD(v_next::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.octe_next_document_code_lowest_free() IS
'Retorna o menor codigo_documento livre da OCTE no formato 0001.';

