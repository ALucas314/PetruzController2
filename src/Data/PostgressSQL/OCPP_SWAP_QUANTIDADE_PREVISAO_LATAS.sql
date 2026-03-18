-- ============================================================================
-- OCPP: Trocar os valores entre quantidade_latas e Previsão_Latas
-- O que hoje está em Previsão_Latas (valores preenchidos) deve ficar em quantidade_latas.
-- O que hoje está em quantidade_latas (zeros/vazios) deve ficar em Previsão_Latas.
-- Execute no SQL Editor do Supabase (PostgreSQL).
-- ============================================================================

-- Troca os dados entre as duas colunas em uma única instrução
-- (o PostgreSQL usa os valores antigos da linha para calcular o SET)
UPDATE "OCPP"
SET
  quantidade_latas = "Previsão_Latas",
  "Previsão_Latas" = quantidade_latas;

-- Se a coluna no seu banco for previsao_latas (sem acento), use em vez do script acima:
-- UPDATE "OCPP"
-- SET
--   quantidade_latas = previsao_latas,
--   previsao_latas = quantidade_latas;
