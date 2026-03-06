-- Criação da tabela OCTF (Objeto de Cadastro da Tabela de Filiais)
-- PostgreSQL
-- IMPORTANTE: Use aspas duplas para garantir que o nome da tabela seja criado em MAIÚSCULAS

-- Se a tabela já existir em minúsculas (octf), renomeá-la para maiúsculas (OCTF)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'octf') THEN
        ALTER TABLE octf RENAME TO "OCTF";
        RAISE NOTICE 'Tabela octf renomeada para OCTF';
    END IF;
END $$;

-- Criar a tabela se não existir (em MAIÚSCULAS)
CREATE TABLE IF NOT EXISTS "OCTF" (
    id SERIAL PRIMARY KEY,
    line_id INTEGER,
    "Code" VARCHAR(50) UNIQUE NOT NULL,
    "Name" VARCHAR(255) NOT NULL,
    "Address" TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por código
CREATE INDEX IF NOT EXISTS idx_octf_code ON "OCTF"("Code");

-- Índice para busca rápida por nome
CREATE INDEX IF NOT EXISTS idx_octf_name ON "OCTF"("Name");

-- Comentários nas colunas
COMMENT ON TABLE "OCTF" IS 'Objeto de Cadastro da Tabela de Filiais';
COMMENT ON COLUMN "OCTF".id IS 'ID único do registro';
COMMENT ON COLUMN "OCTF".line_id IS 'ID da linha (para compatibilidade com modelo SAP)';
COMMENT ON COLUMN "OCTF"."Code" IS 'Código da filial (ex: 01)';
COMMENT ON COLUMN "OCTF"."Name" IS 'Nome da filial';
COMMENT ON COLUMN "OCTF"."Address" IS 'Endereço da filial';
COMMENT ON COLUMN "OCTF".created_at IS 'Data de criação do registro';
COMMENT ON COLUMN "OCTF".updated_at IS 'Data de última atualização do registro';
