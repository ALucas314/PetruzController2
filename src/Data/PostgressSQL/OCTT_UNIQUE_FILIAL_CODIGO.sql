-- ============================================================================
-- OCTT: permitir o mesmo codigo_documento em filiais diferentes (ex.: 0001 BELA
-- e 0001 PETRUZ). Remove UNIQUE apenas em codigo_documento e cria UNIQUE
-- composto (filial_nome, codigo_documento).
--
-- Erro típico no app sem isso: POST ... 409 Conflict / duplicate key / 23505
-- ============================================================================

-- Remove constraint UNIQUE que envolve somente a coluna codigo_documento
DO $$
DECLARE
  constr text;
BEGIN
  FOR constr IN
    SELECT c.conname::text
    FROM pg_constraint c
    WHERE c.conrelid = 'public."OCTT"'::regclass
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1
      AND (
        SELECT a.attname::text
        FROM pg_attribute a
        WHERE a.attrelid = c.conrelid
          AND a.attnum = c.conkey[1]
          AND NOT a.attisdropped
      ) = 'codigo_documento'
  LOOP
    EXECUTE format('ALTER TABLE public."OCTT" DROP CONSTRAINT %I', constr);
    RAISE NOTICE 'Removido: %', constr;
  END LOOP;
END $$;

-- Índice único por filial + código (ajuste se já existir outro com o mesmo papel)
DROP INDEX IF EXISTS public.octt_filial_codigo_documento_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS octt_filial_codigo_documento_uidx
  ON public."OCTT" (filial_nome, codigo_documento);
