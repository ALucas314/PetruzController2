-- ============================================================================
-- Tabela de Produção para Supabase
-- ============================================================================
-- Esta tabela armazena os dados de análise de produção
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================================

CREATE TABLE IF NOT EXISTS producao (
  -- ID único e auto-incremento
  id BIGSERIAL PRIMARY KEY,
  
  -- Data do registro (campo separado)
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Hora do registro (campo separado - apenas hora)
  hora TIME NOT NULL DEFAULT CURRENT_TIME,
  
  -- Data e hora completa (timestamp)
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Número da linha/item
  numero INTEGER NOT NULL,
  
  -- Ordem de Produção
  op VARCHAR(50),
  
  -- Código do item
  codigo VARCHAR(100),
  
  -- Descrição do item
  descricao TEXT,
  
  -- Linha de produção
  linha VARCHAR(100),
  
  -- Quantidade Planejada
  qtd_planejada DECIMAL(15, 2) DEFAULT 0,
  
  -- Quantidade Realizada
  qtd_realizada DECIMAL(15, 2) DEFAULT 0,
  
  -- Diferença (Planejada - Realizada)
  diferenca DECIMAL(15, 2) DEFAULT 0,
  
  -- Cálculo 1 Horas (horas trabalhadas)
  calculo_1_horas DECIMAL(10, 2),
  
  -- Restante de Horas (formato: "Xh Ym" ou "Tempo esgotado")
  restante_horas VARCHAR(50),
  
  -- Hora Atual (timestamp do registro)
  hora_atual TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Hora Final Previsão
  hora_final_previsao TIMESTAMP WITH TIME ZONE,
  
  -- Observações adicionais
  observacao TEXT,
  
  -- Timestamps de controle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Índices para melhor performance
-- ============================================================================

-- Índice para busca por data
CREATE INDEX IF NOT EXISTS idx_producao_data ON producao(data);

-- Índice para busca por código
CREATE INDEX IF NOT EXISTS idx_producao_codigo ON producao(codigo);

-- Índice para busca por OP
CREATE INDEX IF NOT EXISTS idx_producao_op ON producao(op);

-- Índice para busca por linha
CREATE INDEX IF NOT EXISTS idx_producao_linha ON producao(linha);

-- Índice composto para busca por data e número
CREATE INDEX IF NOT EXISTS idx_producao_data_numero ON producao(data, numero);

-- ============================================================================
-- Função para atualizar updated_at automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_producao_updated_at ON producao;
CREATE TRIGGER update_producao_updated_at
    BEFORE UPDATE ON producao
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comentários nas colunas para documentação
-- ============================================================================

COMMENT ON TABLE producao IS 'Tabela para armazenar dados de análise de produção';
COMMENT ON COLUMN producao.data IS 'Data do registro de produção';
COMMENT ON COLUMN producao.hora IS 'Hora do registro de produção';
COMMENT ON COLUMN producao.data_hora IS 'Data e hora completa do registro (timestamp)';
COMMENT ON COLUMN producao.numero IS 'Número sequencial da linha/item';
COMMENT ON COLUMN producao.op IS 'Ordem de Produção';
COMMENT ON COLUMN producao.codigo IS 'Código do item';
COMMENT ON COLUMN producao.descricao IS 'Descrição do item';
COMMENT ON COLUMN producao.linha IS 'Linha de produção';
COMMENT ON COLUMN producao.qtd_planejada IS 'Quantidade planejada';
COMMENT ON COLUMN producao.qtd_realizada IS 'Quantidade realizada';
COMMENT ON COLUMN producao.diferenca IS 'Diferença entre planejado e realizado (planejada - realizada)';
COMMENT ON COLUMN producao.calculo_1_horas IS 'Horas trabalhadas (Cálculo 1 Horas)';
COMMENT ON COLUMN producao.restante_horas IS 'Horas restantes (formato: "Xh Ym" ou "Tempo esgotado")';
COMMENT ON COLUMN producao.hora_atual IS 'Hora atual do registro';
COMMENT ON COLUMN producao.hora_final_previsao IS 'Hora final prevista para conclusão';

-- ============================================================================
-- Exemplo de inserção de dados
-- ============================================================================

/*
INSERT INTO producao (
  data,
  hora,
  data_hora,
  numero,
  op,
  codigo,
  descricao,
  linha,
  qtd_planejada,
  qtd_realizada,
  diferenca,
  calculo_1_horas,
  restante_horas,
  hora_final_previsao
) VALUES (
  CURRENT_DATE,
  CURRENT_TIME,
  NOW(),
  1,
  'OP001',
  '00007',
  'ACAI PETRUZ GUA27 SR CPCA 5KG CX',
  'Linha 1',
  100.00,
  95.00,
  5.00,
  8.5,
  '2h 30m',
  NOW() + INTERVAL '2 hours 30 minutes'
);
*/
