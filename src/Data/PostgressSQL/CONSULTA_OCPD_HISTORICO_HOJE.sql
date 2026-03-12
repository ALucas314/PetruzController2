-- ============================================================================
-- Consulta: Histórico de Produção (OCPD) somente da data de HOJE
-- Execute no SQL Editor do Supabase para ver todos os registros de hoje
-- ============================================================================

SELECT
  id,
  data_dia,
  filial_nome,
  doc_id,
  line_id,
  hora_cabecalho,
  data_cabecalho,
  op,
  codigo_item,
  descricao_item,
  linha,
  qtd_planejada,
  qtd_realizada,
  diferenca,
  calculo_1_horas,
  restante_horas,
  hora_atual,
  hora_final,
  observacao,
  total_qtd_planejada,
  total_qtd_realizada,
  total_diferenca,
  total_reprocesso_usado,
  estim_latas_previstas,
  estim_latas_realizadas,
  latas_ja_batidas,
  total_ja_cortado,
  percentual_meta,
  reprocesso_numero,
  reprocesso_tipo,
  reprocesso_codigo,
  reprocesso_descricao,
  reprocesso_quantidade,
  created_at,
  updated_at
FROM "OCPD"
WHERE data_dia = CURRENT_DATE
ORDER BY filial_nome, created_at;

-- Versão resumida (só colunas principais, agrupando por documento):
-- SELECT data_dia, filial_nome, doc_id, COUNT(*) AS linhas, SUM(qtd_planejada) AS total_planejado, SUM(qtd_realizada) AS total_realizado
-- FROM "OCPD"
-- WHERE data_dia = CURRENT_DATE
-- GROUP BY data_dia, filial_nome, doc_id
-- ORDER BY filial_nome;
