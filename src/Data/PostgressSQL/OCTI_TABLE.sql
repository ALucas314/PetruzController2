-- ============================================================================
-- Tabela OCTI - Objeto de cadastro de tabela de itens
-- Campos: Código do item, Descrição do Item, Unidade de medida, Grupo de itens
-- Execute este SQL no SQL Editor do Supabase (PostgreSQL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OCTI" (
  id            BIGSERIAL PRIMARY KEY,          -- ID interno
  line_id       BIGINT,                         -- ID da linha de produção (OCLP.id), se aplicável
  "Code"        VARCHAR(50) UNIQUE NOT NULL,    -- Código do item
  "Name"        TEXT NOT NULL,                  -- Descrição do item
  "U_Uom"       VARCHAR(20),                    -- Unidade de medida
  "U_ItemGroup" VARCHAR(100),                   -- Grupo de itens

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_octi_code ON "OCTI"("Code");
CREATE INDEX IF NOT EXISTS idx_octi_group ON "OCTI"("U_ItemGroup");

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_octi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_octi_updated_at ON "OCTI";
CREATE TRIGGER trg_octi_updated_at
  BEFORE UPDATE ON "OCTI"
  FOR EACH ROW
  EXECUTE FUNCTION update_octi_updated_at();

-- Comentários (documentação)
COMMENT ON TABLE "OCTI" IS 'Objeto de cadastro de tabela de itens';
COMMENT ON COLUMN "OCTI".line_id IS 'ID da linha de produção (referência a OCLP.id, se usado como FK)';
COMMENT ON COLUMN "OCTI"."Code" IS 'Código do item';
COMMENT ON COLUMN "OCTI"."Name" IS 'Descrição do item';
COMMENT ON COLUMN "OCTI"."U_Uom" IS 'Unidade de medida';
COMMENT ON COLUMN "OCTI"."U_ItemGroup" IS 'Grupo de itens';

