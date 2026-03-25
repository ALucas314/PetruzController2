-- ============================================================================
-- OCTT: corrigir CHECK em status_operacional para aceitar A e M
--
-- Erro típico no app: new row violates check constraint "OCTT_status_operacional_check"
-- A constraint antiga costuma permitir só textos longos (ex.: Operacional).
--
-- Execute no Supabase: SQL Editor → Run (na ordem abaixo).
-- ============================================================================

-- 1) Dados já gravados: normalizar para só A ou M (ajuste o CASE se tiver outros textos)
UPDATE public."OCTT"
SET status_operacional = CASE
  WHEN TRIM(status_operacional) IN ('M', 'Manutenção', 'M - Manutenção', 'Inativo') THEN 'M'
  ELSE 'A'
END
WHERE TRIM(status_operacional) NOT IN ('A', 'M');

-- 2) Remover a constraint antiga (nome exato do erro do Postgres)
ALTER TABLE public."OCTT" DROP CONSTRAINT IF EXISTS "OCTT_status_operacional_check";

-- 3) Nova regra só A / M (opcional; comente se quiser qualquer texto no banco)
ALTER TABLE public."OCTT" ADD CONSTRAINT "OCTT_status_operacional_check"
  CHECK (status_operacional IN ('A', 'M'));
