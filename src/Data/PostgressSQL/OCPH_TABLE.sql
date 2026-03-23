-- ============================================================================
-- Tabela OCPH — Histórico / registro por item de produção (snapshot ou auditoria)
--
-- Campos principais:
--   • Data (data do dia)
--   • Código e descrição do item
--   • Quantidades planejada e realizada
--   • Bi-horária (texto, ex.: "10:00 às 12:00")
--   • Observações
--
-- Colunas opcionais para rastrear origem (preencher pelo app ou trigger):
--   filial_nome, doc_id, ocpd_id (linha OCPD de origem, se houver)
--
-- Execute no Supabase: SQL Editor → New query → Run
-- Depois execute OCPH_RLS_PERMITIR_LEITURA.sql (ou RLS_TODAS_TABELAS_FRONTEND.sql atualizado)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCPH" (
  id                  BIGSERIAL PRIMARY KEY,

  data_dia            DATE NOT NULL,

  codigo_item         VARCHAR(100),
  descricao_item      TEXT,

  qtd_planejada       NUMERIC(15, 2) DEFAULT 0,
  qtd_realizada       NUMERIC(15, 2) DEFAULT 0,

  bi_horaria          TEXT,

  observacoes         TEXT,

  -- Opcional: vínculo com produção / documento (preencher quando gravar histórico)
  filial_nome         VARCHAR(255),
  doc_id              UUID,
  ocpd_id             BIGINT,

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocph_data_dia ON "OCPH"(data_dia);
CREATE INDEX IF NOT EXISTS idx_ocph_codigo_item ON "OCPH"(codigo_item);
CREATE INDEX IF NOT EXISTS idx_ocph_doc_id ON "OCPH"(doc_id);
CREATE INDEX IF NOT EXISTS idx_ocph_ocpd_id ON "OCPH"(ocpd_id);

COMMENT ON TABLE "OCPH" IS 'Histórico ou snapshots por item: data, código, descrição, qtds, bi-horária e observações';
COMMENT ON COLUMN "OCPH".data_dia         IS 'Data do registro';
COMMENT ON COLUMN "OCPH".codigo_item     IS 'Código do item';
COMMENT ON COLUMN "OCPH".descricao_item  IS 'Descrição do item';
COMMENT ON COLUMN "OCPH".qtd_planejada   IS 'Quantidade planejada';
COMMENT ON COLUMN "OCPH".qtd_realizada   IS 'Quantidade realizada';
COMMENT ON COLUMN "OCPH".bi_horaria       IS 'Bi-horária (ex.: 10:00 às 12:00)';
COMMENT ON COLUMN "OCPH".observacoes       IS 'Observações';
COMMENT ON COLUMN "OCPH".filial_nome      IS 'Filial (opcional)';
COMMENT ON COLUMN "OCPH".doc_id           IS 'ID do documento de produção (opcional)';
COMMENT ON COLUMN "OCPH".ocpd_id          IS 'ID da linha OCPD de origem (opcional)';
