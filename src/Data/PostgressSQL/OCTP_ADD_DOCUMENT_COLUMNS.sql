-- ============================================================================
-- Ajuste da tabela OCTP para vincular cada registro de Problema/Ação
-- a um "documento" específico (data + filial), evitando compartilhamento.
--
-- Execute no Supabase: SQL Editor → New query → cole e clique em Run.
-- ============================================================================

ALTER TABLE "OCTP"
ADD COLUMN IF NOT EXISTS "data_dia" date,
ADD COLUMN IF NOT EXISTS "filial_nome" text;

-- Índice auxiliar para buscas por documento (data + filial) e início
CREATE INDEX IF NOT EXISTS "octp_doc_idx"
  ON "OCTP" ("data_dia", "filial_nome", "inicio");

