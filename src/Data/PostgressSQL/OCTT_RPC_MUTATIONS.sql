-- ============================================================================
-- OCTT: INSERT/UPDATE via RPC (evita 400 do PostgREST com coluna reservada "data")
--
-- Execute no Supabase SQL Editor (uma vez). Exige RLS já permitindo INSERT/UPDATE
-- (octt_authenticated_all em OCTT_RLS_PERMITIR_LEITURA.sql).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.octt_insert_row(
  p_codigo_documento bigint,
  p_filial_nome text,
  p_dia date,
  p_nome text,
  p_capacidade_maxima_tunel numeric,
  p_status_operacional text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_id bigint;
BEGIN
  INSERT INTO public."OCTT" (
    codigo_documento,
    filial_nome,
    "data",
    nome,
    capacidade_maxima_tunel,
    status_operacional
  )
  VALUES (
    p_codigo_documento,
    p_filial_nome,
    p_dia,
    p_nome,
    p_capacidade_maxima_tunel,
    p_status_operacional
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.octt_update_row(
  p_id bigint,
  p_codigo_documento bigint,
  p_filial_nome text,
  p_dia date,
  p_nome text,
  p_capacidade_maxima_tunel numeric,
  p_status_operacional text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public."OCTT"
  SET
    codigo_documento = p_codigo_documento,
    filial_nome = p_filial_nome,
    "data" = p_dia,
    nome = p_nome,
    capacidade_maxima_tunel = p_capacidade_maxima_tunel,
    status_operacional = p_status_operacional
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.octt_insert_row(bigint, text, date, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.octt_update_row(bigint, bigint, text, date, text, numeric, text) TO authenticated;
