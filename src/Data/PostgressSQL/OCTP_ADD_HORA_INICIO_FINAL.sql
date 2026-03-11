-- ============================================================================
-- Colunas OCTP para hora inicial, hora fim e duração (minutos)
-- Sua tabela já pode ter hora_fim e duracao_minutos; este script adiciona
-- hora_inicio se não existir. O app grava: hora_inicio, hora_fim, duracao_minutos.
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

-- Hora inicial editável (início do problema/ação)
ALTER TABLE "OCTP"
  ADD COLUMN IF NOT EXISTS hora_inicio TIME;
COMMENT ON COLUMN "OCTP".hora_inicio IS 'Hora inicial editável (início do problema/ação)';

-- Se a tabela usar hora_final em vez de hora_fim, descomente abaixo:
-- ALTER TABLE "OCTP" ADD COLUMN IF NOT EXISTS hora_final TIME;

-- Duração em minutos (intervalo entre hora_inicio e hora_fim); adicionar se não existir
ALTER TABLE "OCTP"
  ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER;
COMMENT ON COLUMN "OCTP".duracao_minutos IS 'Duração em minutos (intervalo entre hora inicial e hora fim)';
