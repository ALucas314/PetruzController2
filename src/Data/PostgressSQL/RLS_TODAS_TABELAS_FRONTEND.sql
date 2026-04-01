-- ============================================================================
-- RLS (Row Level Security) — mesmo padrão para todas as tabelas do frontend
--
-- O frontend usa Supabase com anon key + usuário autenticado. Sem estas
-- políticas, as consultas retornam 0 linhas (Filial, Linha, Itens, Produção,
-- Histórico de Análise de Produção).
--
-- Execute uma vez no Supabase: SQL Editor → New query → cole tudo → Run
-- ============================================================================

-- OCPD (produção diária + histórico de análise de produção)
ALTER TABLE "OCPD" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ocpd_authenticated_all" ON "OCPD";
CREATE POLICY "ocpd_authenticated_all" ON "OCPD"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTF (filiais)
ALTER TABLE "OCTF" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octf_authenticated_all" ON "OCTF";
CREATE POLICY "octf_authenticated_all" ON "OCTF"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCLP (linhas de produção)
ALTER TABLE "OCLP" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oclp_authenticated_all" ON "OCLP";
CREATE POLICY "oclp_authenticated_all" ON "OCLP"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTI (itens / catálogo — código → descrição ao digitar)
ALTER TABLE "OCTI" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octi_authenticated_all" ON "OCTI";
CREATE POLICY "octi_authenticated_all" ON "OCTI"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTT (cadastro de túneis)
ALTER TABLE "OCTT" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octt_authenticated_all" ON "OCTT";
CREATE POLICY "octt_authenticated_all" ON "OCTT"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CDTP (cadastro de tipo de produtos — estoque)
ALTER TABLE "CDTP" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cdtp_authenticated_all" ON "CDTP";
CREATE POLICY "cdtp_authenticated_all" ON "CDTP"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCMT (movimentação de túneis)
ALTER TABLE "OCMT" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ocmt_authenticated_all" ON "OCMT";
CREATE POLICY "ocmt_authenticated_all" ON "OCMT"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCCE (controle de estoque)
ALTER TABLE "OCCE" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "occe_authenticated_all" ON "OCCE";
CREATE POLICY "occe_authenticated_all" ON "OCCE"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTP (problemas e ações / status)
ALTER TABLE "OCTP" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octp_authenticated_all" ON "OCTP";
CREATE POLICY "octp_authenticated_all" ON "OCTP"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCPP (planejamento de produção / PCP)
ALTER TABLE "OCPP" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ocpp_authenticated_all" ON "OCPP";
CREATE POLICY "ocpp_authenticated_all" ON "OCPP"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTC (cadastro de colaboradores — documento / nome / setor / filial_nome)
ALTER TABLE "OCTC" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octc_authenticated_all" ON "OCTC";
CREATE POLICY "octc_authenticated_all" ON "OCTC"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTE (tabela de empacotamento)
ALTER TABLE "OCTE" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octe_authenticated_all" ON "OCTE";
CREATE POLICY "octe_authenticated_all" ON "OCTE"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTRF (cadastro de funções — número do documento / nome da função)
ALTER TABLE "OCTRF" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octrf_authenticated_all" ON "OCTRF";
CREATE POLICY "octrf_authenticated_all" ON "OCTRF"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCPH (histórico / registro por item: data, código, qtds, bi-horária, observações)
ALTER TABLE "OCPH" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ocph_authenticated_all" ON "OCPH";
CREATE POLICY "ocph_authenticated_all" ON "OCPH"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- OCTU_DRAFT_AUTH (rascunho por usuário logado)
ALTER TABLE "OCTU_DRAFT_AUTH" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "octu_draft_auth_own" ON "OCTU_DRAFT_AUTH";
CREATE POLICY "octu_draft_auth_own" ON "OCTU_DRAFT_AUTH"
  FOR ALL TO authenticated USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
