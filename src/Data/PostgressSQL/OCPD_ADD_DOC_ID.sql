-- ============================================================================
-- Adiciona coluna doc_id na OCPD para permitir vários "documentos" no mesmo dia/filial
-- Execute no SQL Editor do Supabase
-- ============================================================================

ALTER TABLE "OCPD"
  ADD COLUMN IF NOT EXISTS doc_id TEXT;

COMMENT ON COLUMN "OCPD".doc_id IS 'ID do documento (UUID). Null = documento legado (um único doc por data+filial).';

CREATE INDEX IF NOT EXISTS idx_ocpd_doc_id ON "OCPD"(doc_id);
CREATE INDEX IF NOT EXISTS idx_ocpd_data_filial_doc ON "OCPD"(data_dia, filial_nome, doc_id);
