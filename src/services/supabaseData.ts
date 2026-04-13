/**
 * Acesso direto ao Supabase a partir do frontend (sem backend Node).
 * Requer RLS habilitado e políticas para usuários autenticados.
 */

import { supabase } from "@/lib/supabase";

/** Coalesce vários `postgres_changes` seguidos; outros usuários costumam ver em ~este atraso. */
export const REALTIME_COLLAPSE_MS = 80;
/** Só no cliente que acabou de gravar: ignorar eco do Realtime (evita piscar a tela). */
export const REALTIME_SUPPRESS_OWN_WRITE_MS = 700;

const DRAFT_TABLE = "OCTU_DRAFT_AUTH"; // tabela para rascunho por auth.uid() (UUID)

// --- Filiais (OCTF) ---
export async function getFiliais() {
  const { data, error } = await supabase
    .from("OCTF")
    .select('id, line_id, "Code", "Name", "Address"')
    .order("Code");
  if (error) throw error;
  return (data || []).map((f: Record<string, unknown>) => ({
    id: Number(f.id),
    codigo: String(f.Code ?? f.code ?? ""),
    nome: String(f.Name ?? f.name ?? ""),
    endereco: String(f.Address ?? f.address ?? ""),
  }));
}

// --- Linhas (OCLP) ---
export async function getLines() {
  const { data, error } = await supabase
    .from("OCLP")
    .select('id, line_id, "Code", "Name"')
    .order("Code");
  if (error) throw error;
  return (data || []).map((l: Record<string, unknown>) => ({
    id: Number(l.id),
    line_id: l.line_id != null ? Number(l.line_id) : null,
    code: String(l.Code ?? l.code ?? ""),
    name: String(l.Name ?? l.name ?? ""),
  }));
}

// OCLP: Code até 20; Name até 255 (execute OCLP_ALTER_NAME_CODE_LENGTH.sql no Supabase para Name aceitar 255)
const OCLP_CODE_MAX = 20;
const OCLP_NAME_MAX = 255;

export async function createLine(payload: { Code: string; Name: string }) {
  const row = {
    Code: String(payload.Code ?? "").trim().slice(0, OCLP_CODE_MAX),
    Name: String(payload.Name ?? "").trim().slice(0, OCLP_NAME_MAX),
  };
  const { data, error } = await supabase.from("OCLP").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateLine(id: number, payload: { Code?: string; Name?: string }) {
  const body: { Code?: string; Name?: string } = {};
  if (payload.Code !== undefined) body.Code = String(payload.Code).trim().slice(0, OCLP_CODE_MAX);
  if (payload.Name !== undefined) body.Name = String(payload.Name).trim().slice(0, OCLP_NAME_MAX);
  if (Object.keys(body).length === 0) return null;
  const { data, error } = await supabase.from("OCLP").update(body).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLine(id: number) {
  const { error } = await supabase.from("OCLP").delete().eq("id", id);
  if (error) throw error;
}

export type { OCTTRow } from "./octt";
export { getTuneis, createTunel, updateTunel, deleteTunel, subscribeOCTTRealtime } from "./octt";

export type { CDTPRow } from "./cdtp";
export { getTiposProduto, createTipoProduto, updateTipoProduto, deleteTipoProduto } from "./cdtp";

export type { OCMTRow } from "./ocmt";
export {
  getMovimentacoesTuneis,
  createMovimentacaoTunel,
  updateMovimentacaoTunel,
  deleteMovimentacaoTunel,
  subscribeOCMTRealtime,
} from "./ocmt";

export type { OCCERow } from "./occe";
export {
  getControleEstoque,
  getNextFreeOcceDocEntry,
  createControleEstoque,
  updateControleEstoque,
  deleteControleEstoque,
  subscribeOCCERealtime,
} from "./occe";

// --- OCPP (Planejamento de Produção) ---
// select('*') evita 400 quando o banco tem code vs "Code" ou previsao_latas vs "Previsão_Latas" (mapOcppRow normaliza).
const OCPP_SELECT_ALL = "*";

type OcppDbCols = { code: "Code" | "code"; previsao: "previsao_latas" | "Previsão_Latas" };
let ocppDbColumns: OcppDbCols | null = null;

/** Deduz nomes reais das colunas a partir da primeira linha retornada pelo PostgREST. */
function syncOcppDbColumnsFromRow(r: Record<string, unknown>) {
  if (ocppDbColumns !== null) return;
  const hasQuotedCode = Object.prototype.hasOwnProperty.call(r, "Code");
  const hasLowerCode = Object.prototype.hasOwnProperty.call(r, "code");
  const code: "Code" | "code" =
    hasQuotedCode ? "Code" : hasLowerCode ? "code" : "Code";
  const hasPrevAccent = Object.prototype.hasOwnProperty.call(r, "Previsão_Latas");
  const hasPrevSnake = Object.prototype.hasOwnProperty.call(r, "previsao_latas");
  const previsao: "previsao_latas" | "Previsão_Latas" =
    hasPrevAccent ? "Previsão_Latas" : hasPrevSnake ? "previsao_latas" : "previsao_latas";
  ocppDbColumns = { code, previsao };
}

export interface OCPPRow {
  id: number;
  data: string;
  op: string | null;
  filial_nome: string | null;
  doc_ordem_global: number | null;
  doc_numero: number | null;
  Code: number | string | null;
  descricao: string | null;
  unidade: string | null;
  grupo: string | null;
  quantidade: number;
  quantidade_latas: number;
  previsao_latas: number;
  quantidade_kg: number;
  tipo_fruto: string | null;
  tipo_linha: string | null;
  unidade_base: string | null;
  unidade_chapa: string | null;
  solidos: number | null;
  solid: number | null;
  quantidade_kg_tuneo: number;
  quantidade_liquida_prevista: number;
  cort_solid: string | null;
  t_cort: string | null;
  quantidade_basqueta: number;
  quantidade_chapa: number;
  latas: number;
  estrutura: string | null;
  basqueta: string | null;
  chapa: string | null;
  tuneo: string | null;
  qual_maquina: string | null;
  mao_de_obra: string | null;
  utilidade: string | null;
  estoque: string | null;
  timbragem: string | null;
  corte_reprocesso: string | null;
  observacao: string | null;
}

/** Lê valor numérico de r com fallback para nomes alternativos (ex.: Previsão_Latas) */
function num(r: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = r[k];
    if (v != null && v !== "") return Number(v) || 0;
  }
  return 0;
}
/** Lê string de r com fallback para nomes alternativos */
function str(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (v != null && v !== "") return String(v);
  }
  return null;
}

/** Soma dias em uma data YYYY-MM-DD (calendário, sem depender de timezone do horário). */
export function addCalendarDays(isoDate: string, delta: number): string {
  const base = isoDate.split("T")[0];
  const [y, m, d] = base.split("-").map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return base;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function mapOcppRow(r: Record<string, unknown>): OCPPRow {
  syncOcppDbColumnsFromRow(r);
  return {
    id: Number(r.id),
    data: r.data ? String(r.data).split("T")[0] : "",
    op: str(r, "op") ?? null,
    filial_nome: str(r, "filial_nome") ?? null,
    doc_ordem_global: r.doc_ordem_global != null ? Number(r.doc_ordem_global) : null,
    doc_numero: r.doc_numero != null ? Number(r.doc_numero) : null,
    Code: (r.Code ?? r.code ?? null) as number | string | null,
    descricao: str(r, "descricao") ?? null,
    unidade: str(r, "unidade") ?? null,
    grupo: str(r, "grupo") ?? null,
    quantidade: num(r, "quantidade"),
    quantidade_latas: num(r, "quantidade_latas", "Quantidade_Latas"),
    previsao_latas: num(r, "previsao_latas", "Previsão_Latas", "Previsao_Latas"),
    quantidade_kg: num(r, "quantidade_kg", "Quantidade_Kg"),
    tipo_fruto: str(r, "tipo_fruto", "Tipo_Fruto") ?? null,
    tipo_linha: str(r, "tipo_linha", "Tipo_Linha") ?? null,
    unidade_base: str(r, "unidade_base", "Unidade_Base") ?? null,
    unidade_chapa: str(r, "unidade_chapa", "Unidade_Chapa") ?? null,
    solidos: r.solidos != null ? Number(r.solidos) : null,
    solid: r.solid != null ? Number(r.solid) : null,
    quantidade_kg_tuneo: num(r, "quantidade_kg_tuneo", "Quantidade_Kg_Tuneo"),
    quantidade_liquida_prevista: num(r, "quantidade_liquida_prevista", "Quantidade_Liquida_Prevista"),
    cort_solid: str(r, "cort_solid", "Cort_Solid") ?? null,
    t_cort: str(r, "t_cort", "T_Cort") ?? null,
    quantidade_basqueta: num(r, "quantidade_basqueta", "Quantidade_Basqueta"),
    quantidade_chapa: num(r, "quantidade_chapa", "Quantidade_Chapa"),
    latas: num(r, "latas"),
    estrutura: str(r, "estrutura") ?? null,
    basqueta: str(r, "basqueta") ?? null,
    chapa: str(r, "chapa") ?? null,
    tuneo: str(r, "tuneo") ?? null,
    qual_maquina: str(r, "qual_maquina", "Qual_Maquina") ?? null,
    mao_de_obra: str(r, "mao_de_obra", "Mao_De_Obra") ?? null,
    utilidade: str(r, "utilidade") ?? null,
    estoque: str(r, "estoque") ?? null,
    timbragem: str(r, "timbragem") ?? null,
    corte_reprocesso: str(r, "corte_reprocesso", "Corte_Reprocesso") ?? null,
    observacao: str(r, "observacao", "Observacao") ?? null,
  };
}

/**
 * Busca OCPP pelo intervalo de data de lançamento (dia em que o documento foi cadastrado / dia anterior à coluna `data`).
 * No banco, `data` é a data do documento de produção; convertemos: data_documento = data_lançamento + 1 dia.
 */
export async function getOcppByDateRange(
  dataInicio: string,
  dataFim: string,
  filialNome?: string | null
): Promise<OCPPRow[]> {
  const de = dataInicio.split("T")[0];
  const ate = dataFim.split("T")[0];
  const dataDocInicio = addCalendarDays(de, 1);
  const dataDocFim = addCalendarDays(ate, 1);
  const filialTrim = filialNome != null && String(filialNome).trim() !== "" ? String(filialNome).trim() : null;

  let query = supabase
    .from("OCPP")
    .select(OCPP_SELECT_ALL)
    .gte("data", dataDocInicio)
    .lte("data", dataDocFim)
    .order("data", { ascending: true })
    .order("id", { ascending: true });
  if (filialTrim) query = query.eq("filial_nome", filialTrim);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as Record<string, unknown>[];
  if (rows.length === 0 && ocppDbColumns === null) {
    const probe = await supabase.from("OCPP").select(OCPP_SELECT_ALL).limit(1).maybeSingle();
    if (!probe.error && probe.data) syncOcppDbColumnsFromRow(probe.data as Record<string, unknown>);
  }
  return rows.map((r) => mapOcppRow(r));
}

/** Retorna menor e maior data de lançamento (coluna `data` do documento menos um dia). */
export async function getOcppDateBounds(
  filialNome?: string | null
): Promise<{ minDate: string | null; maxDate: string | null }> {
  const filialTrim = filialNome != null && String(filialNome).trim() !== "" ? String(filialNome).trim() : null;

  let minQ = supabase.from("OCPP").select("data").not("data", "is", null).order("data", { ascending: true }).limit(1);
  let maxQ = supabase.from("OCPP").select("data").not("data", "is", null).order("data", { ascending: false }).limit(1);
  if (filialTrim) {
    minQ = minQ.eq("filial_nome", filialTrim);
    maxQ = maxQ.eq("filial_nome", filialTrim);
  }

  const [{ data: minData, error: minErr }, { data: maxData, error: maxErr }] = await Promise.all([minQ, maxQ]);
  if (minErr) throw minErr;
  if (maxErr) throw maxErr;

  const minDoc = minData?.[0]?.data ? String(minData[0].data).split("T")[0] : null;
  const maxDoc = maxData?.[0]?.data ? String(maxData[0].data).split("T")[0] : null;
  const minDate = minDoc ? addCalendarDays(minDoc, -1) : null;
  const maxDate = maxDoc ? addCalendarDays(maxDoc, -1) : null;
  return { minDate, maxDate };
}

export type OCPPInsertPayload = {
  data: string;
  op?: string | null;
  filial_nome?: string | null;
  doc_numero?: number | null;
  doc_ordem_global?: number | null;
  Code?: number | string | null;
  descricao?: string | null;
  unidade?: string | null;
  grupo?: string | null;
  quantidade?: number;
  quantidade_latas?: number;
  previsao_latas?: number;
  quantidade_kg?: number;
  tipo_fruto?: string | null;
  tipo_linha?: string | null;
  unidade_base?: string | null;
  unidade_chapa?: string | null;
  solidos?: number | null;
  solid?: number | null;
  quantidade_kg_tuneo?: number;
  quantidade_liquida_prevista?: number;
  cort_solid?: string | null;
  t_cort?: string | null;
  quantidade_basqueta?: number;
  quantidade_chapa?: number;
  latas?: number;
  estrutura?: string | null;
  basqueta?: string | null;
  chapa?: string | null;
  tuneo?: string | null;
  qual_maquina?: string | null;
  mao_de_obra?: string | null;
  utilidade?: string | null;
  estoque?: string | null;
  timbragem?: string | null;
  corte_reprocesso?: string | null;
  observacao?: string | null;
};

/** Row para insert; nomes code / previsão alinhados ao banco após primeira leitura (fallback OCPP_TABLE.sql). */
function ocppPayloadToBaseRow(payload: OCPPInsertPayload): Record<string, unknown> {
  const cols = ocppDbColumns ?? { code: "Code" as const, previsao: "previsao_latas" as const };
  const rawCode = payload.Code != null && payload.Code !== "" ? payload.Code : null;
  const codeVal: number | string | null =
    rawCode == null
      ? null
      : cols.code === "Code"
        ? Number(rawCode)
        : String(rawCode);
  return {
    data: payload.data.split("T")[0],
    op: payload.op ?? null,
    filial_nome: payload.filial_nome ?? null,
    doc_numero: payload.doc_numero ?? null,
    doc_ordem_global: payload.doc_ordem_global ?? null,
    [cols.code]: codeVal,
    descricao: payload.descricao ?? null,
    unidade: payload.unidade ?? null,
    grupo: payload.grupo ?? null,
    quantidade: payload.quantidade ?? 0,
    quantidade_latas: payload.quantidade_latas ?? 0,
    [cols.previsao]: payload.previsao_latas ?? 0,
    quantidade_kg: payload.quantidade_kg ?? 0,
    tipo_fruto: payload.tipo_fruto ?? null,
    tipo_linha: payload.tipo_linha ?? null,
    unidade_base: payload.unidade_base ?? null,
    unidade_chapa: payload.unidade_chapa ?? null,
    solidos: payload.solidos ?? null,
    solid: payload.solid ?? null,
    quantidade_kg_tuneo: payload.quantidade_kg_tuneo ?? 0,
    quantidade_liquida_prevista: payload.quantidade_liquida_prevista ?? 0,
    cort_solid: payload.cort_solid ?? null,
    t_cort: payload.t_cort ?? null,
    quantidade_basqueta: payload.quantidade_basqueta ?? 0,
    quantidade_chapa: payload.quantidade_chapa ?? 0,
    latas: payload.latas ?? 0,
    estrutura: payload.estrutura ?? null,
    basqueta: payload.basqueta ?? null,
    chapa: payload.chapa ?? null,
    tuneo: payload.tuneo ?? null,
    qual_maquina: payload.qual_maquina ?? null,
    mao_de_obra: payload.mao_de_obra ?? null,
    utilidade: payload.utilidade ?? null,
    estoque: payload.estoque ?? null,
    timbragem: payload.timbragem ?? null,
    corte_reprocesso: payload.corte_reprocesso ?? null,
    observacao: payload.observacao ?? null,
  };
}

export async function createOcpp(payload: OCPPInsertPayload): Promise<OCPPRow> {
  const row = ocppPayloadToBaseRow(payload);
  const { data, error } = await supabase.from("OCPP").insert(row).select(OCPP_SELECT_ALL).single();
  if (error) throw error;
  return mapOcppRow(data as Record<string, unknown>);
}

/**
 * Próximo doc_numero e doc_ordem_global para uma data + filial, a partir dos máximos já gravados na OCPP.
 * Valores null no banco contam como 0, para novos documentos ganharem números explícitos e não colarem no bucket legado null|null.
 */
export async function getNextOcppDocIdentity(
  data: string,
  filialNome: string | null | undefined
): Promise<{ doc_numero: number; doc_ordem_global: number }> {
  const day = String(data).split("T")[0];
  if (!day) return { doc_numero: 1, doc_ordem_global: 1 };
  const f = filialNome != null ? String(filialNome).trim() : "";
  let query = supabase.from("OCPP").select("doc_numero, doc_ordem_global").eq("data", day);
  if (f) query = query.eq("filial_nome", f);
  else query = query.is("filial_nome", null);
  const { data: rows, error } = await query;
  if (error) throw error;
  let maxNum = 0;
  let maxOrd = 0;
  for (const r of rows || []) {
    const row = r as Record<string, unknown>;
    const n = row.doc_numero != null && row.doc_numero !== "" ? Number(row.doc_numero) : 0;
    const o = row.doc_ordem_global != null && row.doc_ordem_global !== "" ? Number(row.doc_ordem_global) : 0;
    if (Number.isFinite(n) && n > maxNum) maxNum = n;
    if (Number.isFinite(o) && o > maxOrd) maxOrd = o;
  }
  return { doc_numero: maxNum + 1, doc_ordem_global: maxOrd + 1 };
}

/** Converte campo do payload para nome da coluna real no Postgres. */
function ocppUpdateFieldToDb(key: keyof OCPPInsertPayload, value: unknown): [string, unknown] {
  const cols = ocppDbColumns ?? { code: "Code" as const, previsao: "previsao_latas" as const };
  if (key === "data") return ["data", value != null ? String(value).split("T")[0] : null];
  if (key === "Code") {
    if (value == null || value === "") return [cols.code, null];
    return [cols.code, cols.code === "Code" ? Number(value) : String(value)];
  }
  if (key === "previsao_latas") return [cols.previsao, value != null ? Number(value) : 0];
  return [key, value];
}

export async function updateOcpp(id: number, payload: Partial<OCPPInsertPayload>): Promise<OCPPRow> {
  const body: Record<string, unknown> = {};
  const keys: (keyof OCPPInsertPayload)[] = [
    "data", "op", "Code", "descricao", "unidade", "grupo", "quantidade", "quantidade_latas", "previsao_latas", "quantidade_kg",
    "tipo_fruto", "tipo_linha", "unidade_base", "unidade_chapa", "solidos", "solid", "quantidade_kg_tuneo", "quantidade_liquida_prevista",
    "cort_solid", "t_cort", "quantidade_basqueta", "quantidade_chapa", "latas", "estrutura", "basqueta", "chapa", "tuneo",
    "qual_maquina", "mao_de_obra", "utilidade", "estoque", "timbragem", "corte_reprocesso", "observacao",
  ];
  for (const k of keys) {
    const v = payload[k];
    if (v === undefined) continue;
    const [dbKey, dbVal] = ocppUpdateFieldToDb(k, v);
    body[dbKey] = dbVal;
  }
  if (Object.keys(body).length === 0) {
    const { data, error: err } = await supabase.from("OCPP").select(OCPP_SELECT_ALL).eq("id", id).single();
    if (err || !data) throw err || new Error("Registro não encontrado");
    return mapOcppRow(data as Record<string, unknown>);
  }
  const { data, error } = await supabase.from("OCPP").update(body).eq("id", id).select(OCPP_SELECT_ALL).single();
  if (error) throw error;
  return mapOcppRow(data as Record<string, unknown>);
}

export async function deleteOcpp(id: number): Promise<void> {
  const { error } = await supabase.from("OCPP").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Inscreve em alterações em tempo real da tabela OCPP (Planejamento de Produção).
 * Quando qualquer usuário inserir, atualizar ou excluir um registro, o callback é chamado
 * para que a lista possa ser recarregada e todos vejam os mesmos dados.
 * @param onChanges - chamado em INSERT, UPDATE ou DELETE na OCPP
 * @returns função para cancelar a inscrição (chamar no cleanup do useEffect)
 */
export function subscribeOCPPRealtime(onChanges: () => void): () => void {
  const channel = supabase
    .channel("ocpp-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "OCPP" },
      () => {
        onChanges();
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// --- Itens (OCTI) ---
function octiRowToItem(item: Record<string, unknown>) {
  const code = item.Code ?? item.code;
  const name = item.Name ?? item.name;
  return {
    id: item.id,
    line_id: item.line_id,
    codigo_item: code != null ? String(code) : "",
    nome_item: name != null ? String(name) : "",
    unidade_medida: item.U_Uom ?? item.u_uom ?? null,
    grupo_itens: item.U_ItemGroup ?? item.u_itemgroup ?? null,
  };
}

export async function getItems() {
  const { data, error } = await supabase
    .from("OCTI")
    .select('id, line_id, "Code", "Name", "U_Uom", "U_ItemGroup"')
    .range(0, 5999)
    .order("Code");
  if (error) throw error;
  return (data || []).map((item: Record<string, unknown>) => octiRowToItem(item));
}

/** Busca item na OCTI por código. Tenta "Code"/code (string e número) para compatibilidade com qualquer schema. */
export async function getItemByCode(code: string) {
  const rawCode = (code || "").trim();
  if (!rawCode) return null;

  const tryFetch = async (col: "Code" | "code", val: string | number) => {
    const r = await supabase.from("OCTI").select("*").eq(col, val).limit(1).maybeSingle();
    return r.error ? null : r.data;
  };

  // 1) Busca exata com "Code" (PascalCase)
  let row = await tryFetch("Code", rawCode);
  if (!row) row = await tryFetch("code", rawCode);
  // 2) Se código parece número, tentar como número (coluna pode ser numeric)
  if (!row && /^\d+$/.test(rawCode)) {
    const asNum = Number(rawCode);
    row = await tryFetch("Code", asNum) ?? await tryFetch("code", asNum);
  }
  // 3) Sem zeros à esquerda (ex.: "013787" -> "13787")
  if (!row) {
    const semZeros = rawCode.replace(/^0+/, "") || rawCode;
    if (semZeros !== rawCode) {
      row = await tryFetch("Code", semZeros) ?? await tryFetch("code", semZeros);
      if (!row && /^\d+$/.test(semZeros))
        row = await tryFetch("Code", Number(semZeros)) ?? await tryFetch("code", Number(semZeros));
    }
  }
  if (!row) return null;
  return octiRowToItem(row as Record<string, unknown>);
}

// --- Dashboard ---
export async function getDashboardStats(params: { dataInicio: string; dataFim: string; filialNome?: string }) {
  let query = supabase
    .from("OCPD")
    .select("qtd_planejada, qtd_realizada, diferenca, data_dia")
    .gte("data_dia", params.dataInicio)
    .lte("data_dia", params.dataFim);
  if (params.filialNome) query = query.eq("filial_nome", params.filialNome);
  const { data, error } = await query;
  if (error) throw error;
  const totalPlanejado = (data || []).reduce((s, i) => s + parseFloat(String(i.qtd_planejada || 0)), 0);
  const totalRealizado = (data || []).reduce((s, i) => s + parseFloat(String(i.qtd_realizada || 0)), 0);
  const diferenca = totalPlanejado - totalRealizado;
  // Mesmo critério do gráfico "Status de Produção" e da Produção: total realizado ÷ total planejado (não média por linha)
  const percentualMeta = totalPlanejado > 0 ? (totalRealizado / totalPlanejado) * 100 : 0;
  const variacaoPercentual = totalPlanejado > 0 ? ((totalRealizado - totalPlanejado) / totalPlanejado) * 100 : 0;
  return {
    totalPlanejado: totalPlanejado.toFixed(2),
    totalRealizado: totalRealizado.toFixed(2),
    diferenca: diferenca.toFixed(2),
    percentualMeta: percentualMeta.toFixed(2),
    variacaoPercentual: Number(variacaoPercentual.toFixed(2)),
    registros: data?.length || 0,
  };
}

export async function getProductionChart(params: { dataInicio: string; dataFim: string; filialNome?: string }) {
  let query = supabase
    .from("OCPD")
    .select("qtd_planejada, qtd_realizada, data_dia")
    .gte("data_dia", params.dataInicio)
    .lte("data_dia", params.dataFim)
    .order("data_dia", { ascending: true });
  if (params.filialNome) query = query.eq("filial_nome", params.filialNome);
  const { data, error } = await query;
  if (error) throw error;
  const grouped: Record<string, { data: string; planejado: number; realizado: number }> = {};
  for (const item of data || []) {
    const d = item.data_dia as string;
    if (!grouped[d]) grouped[d] = { data: d, planejado: 0, realizado: 0 };
    grouped[d].planejado += parseFloat(String(item.qtd_planejada || 0));
    grouped[d].realizado += parseFloat(String(item.qtd_realizada || 0));
  }
  return Object.values(grouped).map((item) => {
    const [y, m, day] = item.data.split("-").map(Number);
    const dateObj = new Date(y, m - 1, day);
    const mesAbrev = dateObj.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return {
      month: `${dateObj.getDate()} ${mesAbrev}`,
      receita: parseFloat(item.planejado.toFixed(2)),
      despesas: parseFloat(item.realizado.toFixed(2)),
    };
  });
}

export async function getProductionLines(params: { dataInicio: string; dataFim: string; filialNome?: string }) {
  let query = supabase
    .from("OCPD")
    .select("qtd_planejada, qtd_realizada, linha")
    .gte("data_dia", params.dataInicio)
    .lte("data_dia", params.dataFim);
  if (params.filialNome) query = query.eq("filial_nome", params.filialNome);
  const { data, error } = await query;
  if (error) throw error;
  const byLine: Record<string, { planejado: number; realizado: number }> = {};
  for (const item of data || []) {
    const line = (item.linha as string) || "Outros";
    if (!byLine[line]) byLine[line] = { planejado: 0, realizado: 0 };
    byLine[line].planejado += parseFloat(String(item.qtd_planejada || 0));
    byLine[line].realizado += parseFloat(String(item.qtd_realizada || 0));
  }
  const { data: oclpData } = await supabase.from("OCLP").select('id, "Code", "Name"');
  const nameMap: Record<string, string> = {};
  for (const l of oclpData || []) {
    const code = String((l as Record<string, unknown>).Code ?? "").trim();
    const name = String((l as Record<string, unknown>).Name ?? "").trim();
    if (code) nameMap[code] = name || code;
    if (name) nameMap[name] = name;
  }
  return Object.entries(byLine).map(([key, val]) => ({
    name: nameMap[key] || key,
    valor: val.realizado,
    meta: val.planejado,
  }));
}

/** Converte valor de quantidade no formato BR (ex.: "8.300" = 8300; "1.234,5") para número.
 * Evita parseFloat("8.300") === 8.3, que corrompia OCPD ao salvar strings formatadas do front. */
export function parseBrazilNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const s = String(value).trim();
  if (!s) return 0;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

// --- Produção (OCPD) load ---
/** docId: quando informado, carrega só as linhas desse documento. Quando null/undefined, carrega documento "legado" (doc_id IS NULL). docOrdemGlobal: quando docId é null, filtra por doc_ordem_global para identificar qual documento legado carregar. */
export async function loadProducao(params: { data?: string; filialNome?: string; docId?: string | null; docOrdemGlobal?: number | null }) {
  const hoje = new Date().toISOString().split("T")[0];
  const dataDia = params.data || hoje;
  let query = supabase.from("OCPD").select("*").order("id", { ascending: true }).eq("data_dia", dataDia);
  if (params.filialNome) query = query.eq("filial_nome", params.filialNome);
  if (params.docId != null && params.docId !== "") {
    query = query.eq("doc_id", params.docId);
  } else {
    query = query.is("doc_id", null);
    if (params.docOrdemGlobal != null && params.docOrdemGlobal !== undefined) {
      query = query.eq("doc_ordem_global", params.docOrdemGlobal);
    }
  }
  const { data: producaoData, error } = await query;
  if (error) throw error;
  const rows = producaoData || [];
  const reprocessos: Array<{ numero: number; tipo: string; linha: string; grupo: string | null; codigo: string | null; descricao: string | null; quantidade: number }> = [];
  const first = rows[0] as Record<string, unknown> | undefined;
  const defaultGrupo = "Reprocesso";
  const parseGrupo = (v: unknown): string | null =>
    v != null && ["Reprocesso", "Matéria Prima Açaí", "Matéria Prima Fruto"].includes(String(v)) ? String(v) : null;
  // Preferir array completo na coluna JSONB "reprocessos"; senão usar campos do primeiro registro (colunas reprocesso_*)
  if (first?.reprocessos && Array.isArray(first.reprocessos) && first.reprocessos.length > 0) {
    for (const r of first.reprocessos as Array<Record<string, unknown>>) {
      reprocessos.push({
        numero: Number(r.numero ?? 1),
        tipo: String(r.tipo ?? "Cortado"),
        linha: (r.linha != null && String(r.linha).trim() !== "" ? String(r.linha).trim() : "") as string,
        grupo: parseGrupo(r.grupo) ?? defaultGrupo,
        codigo: (r.codigo != null ? String(r.codigo) : null),
        descricao: (r.descricao != null ? String(r.descricao) : null),
        quantidade: parseFloat(String(r.quantidade ?? 0)),
      });
    }
  } else if (first && (first.reprocesso_numero != null || first.reprocesso_codigo != null || first.reprocesso_descricao != null)) {
    // Grupo só vem do JSONB "reprocessos"; coluna reprocesso_grupo não existe
    const legacyGrupo = first.reprocessos && Array.isArray(first.reprocessos) && (first.reprocessos as Record<string, unknown>[])[0]?.grupo;
    reprocessos.push({
      numero: Number(first.reprocesso_numero ?? 1),
      tipo: String(first.reprocesso_tipo ?? "Cortado"),
      linha: (first.reprocesso_linha != null ? String(first.reprocesso_linha).trim() : "") as string,
      grupo: parseGrupo(legacyGrupo) ?? defaultGrupo,
      codigo: (first.reprocesso_codigo as string) ?? null,
      descricao: (first.reprocesso_descricao as string) ?? null,
      quantidade: parseFloat(String(first.reprocesso_quantidade ?? 0)),
    });
  }

  /** Bi-horária fica só na OCPH (não na OCPD). */
  const biHorariaRegistros = await loadBiHorariaFromOcph({
    dataDia,
    filialNome: params.filialNome,
    docId: params.docId,
    });

  return { data: rows, count: rows.length, reprocessos, biHorariaRegistros };
}

/**
 * Soma `qtd_planejada` na OCPD para o KPI "meta" na tela Bi-horária.
 * Com `doc_id`: tenta o mesmo UUID; se vier 0 (bi sem OCPD ligado), usa a meta agregada do dia na filial (todas as linhas OCPD daquele dia).
 * Sem `doc_id`: só documento legado (`doc_id` nulo).
 */
export async function getTotalPlanejadaOcpdParaBiHoraria(params: {
  dataDia: string;
  filialNome: string | null | undefined;
  docId: string | null | undefined;
}): Promise<number> {
  const day = String(params.dataDia ?? "").split("T")[0].trim();
  const filial = String(params.filialNome ?? "").trim();
  if (!day || !filial) return 0;

  const sumWithFilter = async (applyDocFilter: boolean, uuid: string | null): Promise<{ sum: number; rowCount: number }> => {
    const pageSize = 1000;
    let from = 0;
    let sum = 0;
    let rowCount = 0;
    for (;;) {
      let q = supabase.from("OCPD").select("qtd_planejada").eq("data_dia", day).eq("filial_nome", filial);
      if (applyDocFilter) {
        if (uuid) q = q.eq("doc_id", uuid);
        else q = q.is("doc_id", null);
      }
      const { data, error } = await q.order("id", { ascending: true }).range(from, from + pageSize - 1);
      if (error) throw error;
      const chunk = data ?? [];
      rowCount += chunk.length;
      for (const row of chunk as Array<{ qtd_planejada?: unknown }>) {
        sum += parseBrazilNumber(row.qtd_planejada);
      }
      if (chunk.length < pageSize) break;
      from += pageSize;
    }
    return { sum, rowCount };
  };

  const docId =
    params.docId != null && String(params.docId).trim() !== "" ? String(params.docId).trim() : null;

  if (docId) {
    const { sum: bySameDoc, rowCount } = await sumWithFilter(true, docId);
    if (rowCount > 0) return bySameDoc;
    const { sum: agregado } = await sumWithFilter(false, null);
    return agregado;
  }

  const { sum } = await sumWithFilter(true, null);
  return sum;
}

/** Linha do reprocesso: mesma regra do filtro da tela de produção (valor salvo vs código/id/nome da OCLP). */
function reprocessoLinhaMatchesFilter(
  linhaStored: unknown,
  linhaFiltroRaw: string,
  productionLines: Array<{ id: number; code?: string; name?: string }>
): boolean {
  const filtroVal = String(linhaFiltroRaw ?? "").trim();
  if (!filtroVal) return true;
  const linhaVal = String(linhaStored ?? "").trim();
  if (linhaVal === filtroVal) return true;
  const selectedLine = productionLines.find((l) => (l.code ? String(l.code) : `line-${l.id}`) === filtroVal);
  if (selectedLine) {
    const codeOrId = selectedLine.code ? String(selectedLine.code) : `line-${selectedLine.id}`;
    return linhaVal === codeOrId || linhaVal === String(selectedLine.name ?? "").trim();
  }
  return false;
}

function normalizeGrupoReprocessoJson(v: unknown): string {
  const s = String(v ?? "").trim();
  if (s === "Reprocesso" || s === "Matéria Prima Açaí" || s === "Matéria Prima Fruto") return s;
  return "Reprocesso";
}

/** Cortado vs Usado independente de maiúsculas no JSON/colunas legado. */
function normalizeTipoReprocessoParaFiltro(tipo: unknown): "Cortado" | "Usado" {
  return String(tipo ?? "Cortado").trim().toLowerCase() === "usado" ? "Usado" : "Cortado";
}

/**
 * Soma quantidades de reprocesso (Cortado / Usado) no intervalo de data do documento (`data_dia`),
 * para a filial informada. Cada filtro é opcional e independente: código (contém, case-insensitive),
 * tipo, grupo, linha — iguais ao card de reprocesso na tela.
 * Usa JSONB `reprocessos` e, quando não há array, colunas legado `reprocesso_*` da mesma linha OCPD.
 */
export async function aggregateReprocessosByCodigoInDateRange(params: {
  dataInicio: string;
  dataFim: string;
  filialNome: string;
  /** Vazio = não restringe por código (soma todos os reprocessos que passam nos outros filtros). */
  codigoFiltro?: string;
  tipoFiltro?: "" | "Cortado" | "Usado";
  grupoFiltro?: "" | "Reprocesso" | "Matéria Prima Açaí" | "Matéria Prima Fruto";
  linhaFiltro?: string;
  productionLines?: Array<{ id: number; code?: string; name?: string }>;
}): Promise<{ totalCortado: number; totalUsado: number; documentosComItem: number }> {
  const de = params.dataInicio.split("T")[0];
  const ate = params.dataFim.split("T")[0];
  const filial = String(params.filialNome ?? "").trim();
  if (!filial) {
    return { totalCortado: 0, totalUsado: 0, documentosComItem: 0 };
  }

  const filtroCodigo = String(params.codigoFiltro ?? "").trim().toLowerCase();
  const tipoFiltro = String(params.tipoFiltro ?? "").trim() as "" | "Cortado" | "Usado";
  const grupoFiltro = String(params.grupoFiltro ?? "").trim();
  const linhaFiltroRaw = String(params.linhaFiltro ?? "").trim();
  const productionLines = params.productionLines ?? [];

  const pageSize = 1000;
  let from = 0;
  const rows: Record<string, unknown>[] = [];

  for (;;) {
    let q = supabase
      .from("OCPD")
      .select(
        "id, data_dia, doc_id, doc_ordem_global, reprocessos, reprocesso_codigo, reprocesso_tipo, reprocesso_quantidade, reprocesso_linha"
      )
      .gte("data_dia", de)
      .lte("data_dia", ate)
      .eq("filial_nome", filial)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  const docKeysComMatch = new Set<string>();
  let totalCortado = 0;
  let totalUsado = 0;

  const docKey = (row: Record<string, unknown>) => {
    const d = String(row.data_dia ?? "").split("T")[0];
    const did = row.doc_id != null && String(row.doc_id).trim() !== "" ? String(row.doc_id).trim() : "legacy";
    const og =
      row.doc_ordem_global != null && row.doc_ordem_global !== ""
        ? String(row.doc_ordem_global)
        : "";
    return `${d}|${did}|${og}`;
  };

  const codigoMatch = (codigo: unknown) => {
    if (!filtroCodigo) return true;
    return String(codigo ?? "")
      .trim()
      .toLowerCase()
      .includes(filtroCodigo);
  };

  const grupoMatch = (grupo: unknown) => {
    if (!grupoFiltro) return true;
    return normalizeGrupoReprocessoJson(grupo) === grupoFiltro;
  };

  const linhaMatch = (linha: unknown) => reprocessoLinhaMatchesFilter(linha, linhaFiltroRaw, productionLines);

  const itemMatchesFilters = (tipo: string, grupo: unknown, linha: unknown, codigo: unknown) => {
    if (tipoFiltro && normalizeTipoReprocessoParaFiltro(tipo) !== tipoFiltro) return false;
    if (!grupoMatch(grupo)) return false;
    if (!linhaMatch(linha)) return false;
    if (!codigoMatch(codigo)) return false;
    return true;
  };

  const addFromItem = (row: Record<string, unknown>, tipo: string, qtdRaw: unknown, matched: boolean) => {
    if (!matched) return;
    const q = parseBrazilNumber(qtdRaw);
    if (normalizeTipoReprocessoParaFiltro(tipo) === "Usado") totalUsado += q;
    else totalCortado += q;
    docKeysComMatch.add(docKey(row));
  };

  for (const row of rows) {
    const rep = row.reprocessos;
    if (rep != null && Array.isArray(rep) && rep.length > 0) {
      for (const elem of rep as Record<string, unknown>[]) {
        const matched = itemMatchesFilters(
          String(elem.tipo ?? "Cortado"),
          elem.grupo,
          elem.linha,
          elem.codigo
        );
        addFromItem(row, String(elem.tipo ?? "Cortado"), elem.quantidade, matched);
      }
      continue;
    }
    const legCod = row.reprocesso_codigo;
    if (legCod != null && String(legCod).trim() !== "") {
      const legacyGrupo =
        rep != null && Array.isArray(rep) && (rep as Record<string, unknown>[])[0]?.grupo != null
          ? (rep as Record<string, unknown>[])[0].grupo
          : undefined;
      const matched = itemMatchesFilters(
        String(row.reprocesso_tipo ?? "Cortado"),
        legacyGrupo,
        row.reprocesso_linha,
        legCod
      );
      addFromItem(row, String(row.reprocesso_tipo ?? "Cortado"), row.reprocesso_quantidade, matched);
    }
  }

  return {
    totalCortado,
    totalUsado,
    documentosComItem: docKeysComMatch.size,
  };
}

type BiHorariaPayloadRow = { numero: number; data: string; hora: string; qtd_realizada: number };

/** Mesma ordem das 5 linhas fixas no front: turno 1,2,1,2,3 na coluna OCPH.turno */
const BI_HORARIA_TURNO_OCPH = [1, 2, 1, 2, 3] as const;

/** Registros bi-horária gravados apenas em OCPH (sem vínculo com OCPD). */
export async function loadBiHorariaFromOcph(params: {
  dataDia: string;
  filialNome?: string | null;
  docId?: string | null;
}): Promise<
  Array<{
    numero: number;
    data: string;
    hora: string;
    qtd_realizada: number;
  }>
> {
  const filial = params.filialNome && String(params.filialNome).trim() !== "" ? String(params.filialNome).trim() : null;
  const day = params.dataDia.split("T")[0];

  let q = supabase.from("OCPH").select("*").like("observacoes", "Bi-horária nº%").order("id", { ascending: true });
  if (filial) q = q.eq("filial_nome", filial);
  /** Sempre o dia do cabeçalho: com doc_id, evita mostrar bi-horária de outro data_dia do mesmo documento. */
  q = q.eq("data_dia", day);

  if (params.docId != null && params.docId !== "") {
    q = q.eq("doc_id", String(params.docId).trim());
  } else {
    q = q.is("doc_id", null);
  }

  const { data, error } = await q;
  if (error) throw error;
  const rows = data || [];
  return rows.map((row: Record<string, unknown>, idx: number) => {
    const obs = String(row.observacoes ?? "");
    const m = obs.match(/(\d+)/);
    const num = m ? parseInt(m[1], 10) : idx + 1;
    return {
      numero: Number.isFinite(num) ? num : idx + 1,
      data: String(row.data_dia ?? day).split("T")[0],
      hora: row.bi_horaria != null ? String(row.bi_horaria) : "",
      qtd_realizada: parseBrazilNumber(row.qtd_realizada ?? 0),
    };
  });
}

/**
 * Bi-horária: só OCPH. Remove linhas deste documento (doc_id + filial + prefixo observações) e reinsere. ocpd_id não é usado.
 */
async function syncBiHorariaToOcph(params: {
  filialNome: string | null;
  docId: string | null;
  dataDay: string;
  biHorariaPayload: BiHorariaPayloadRow[] | null;
}) {
  const { filialNome, docId, dataDay, biHorariaPayload } = params;
  const filial = filialNome && String(filialNome).trim() !== "" ? String(filialNome).trim() : null;
  const day = dataDay.split("T")[0];

  let delQ = supabase.from("OCPH").delete().like("observacoes", "Bi-horária nº%");
  if (filial) delQ = delQ.eq("filial_nome", filial);
  /** Com doc_id, apagar só o dia salvo — não remover bi-horária do mesmo doc em outras datas. */
  if (docId != null && String(docId).trim() !== "") {
    delQ = delQ.eq("doc_id", String(docId).trim()).eq("data_dia", day);
  } else {
    delQ = delQ.is("doc_id", null).eq("data_dia", day);
  }
  const { error: delErr } = await delQ;
  if (delErr) throw delErr;

  if (!biHorariaPayload || biHorariaPayload.length === 0) return;

  const docUuid = docId != null && String(docId).trim() !== "" ? String(docId).trim() : null;
  const rows = biHorariaPayload.map((r, idx) => {
    const dday = String(r.data ?? "").split("T")[0];
    const hora = r.hora != null && String(r.hora).trim() !== "" ? String(r.hora).trim() : null;
    const turno =
      idx >= 0 && idx < BI_HORARIA_TURNO_OCPH.length ? BI_HORARIA_TURNO_OCPH[idx] : 1;
    return {
      data_dia: dday,
      codigo_item: null,
      descricao_item: null,
      qtd_planejada: 0,
      qtd_realizada: r.qtd_realizada,
      bi_horaria: hora,
      observacoes: `Bi-horária nº ${r.numero}`,
      filial_nome: filial,
      doc_id: docUuid,
      ocpd_id: null,
      turno,
    };
  });
  const { error: insErr } = await supabase.from("OCPH").insert(rows);
  if (insErr) throw insErr;
}

/** Salva somente a Bi-horária (tabela OCPH), sem gravar linhas na OCPD. */
export async function saveBiHorariaDocumento(params: {
  dataDia: string;
  filialNome?: string | null;
  docId?: string | null;
  biHorariaRegistros?: Array<Record<string, unknown>>;
}) {
  const day = String(params.dataDia || "").split("T")[0];
  if (!day) throw new Error("Data da bi-horária inválida.");

  const payload = (params.biHorariaRegistros ?? []).map((r, idx) => ({
    numero: Number(r.numero ?? idx + 1),
    /** Cabeçalho da tela é a fonte da verdade (evita linhas com data do dia anterior após trocar a data). */
    data: day,
    hora: String(r.hora ?? ""),
    qtd_realizada: parseBrazilNumber(r.quantidadeRealizada ?? r.qtd_realizada ?? 0),
  }));

  await syncBiHorariaToOcph({
    filialNome: params.filialNome ?? null,
    docId: params.docId ?? null,
    dataDay: day,
    biHorariaPayload: payload,
  });

  /** Mesma data no OCPD: a lista e o grid usam `getProducaoHistory` (OCPD); sem isso o doc fica na data antiga na navegação. */
  const docUuid = params.docId != null && String(params.docId).trim() !== "" ? String(params.docId).trim() : null;
  if (docUuid) {
    const { error: ocpdErr } = await supabase.from("OCPD").update({ data_dia: day }).eq("doc_id", docUuid);
    if (ocpdErr) throw ocpdErr;
  }

  return { success: true };
}

/** doc_ids que possuem ao menos um registro bi-horária na OCPH (navegação / filtro). */
export async function getOcphDocIdsComBiHoraria(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("OCPH")
    .select("doc_id")
    .not("doc_id", "is", null)
    .like("observacoes", "Bi-horária nº%");
  if (error) throw error;
  return new Set((data ?? []).map((r: { doc_id: string | null }) => String(r.doc_id ?? "")).filter(Boolean));
}

/** Um documento bi-horária na OCPH (pode não existir linha na OCPD). `id` = menor id OCPH do grupo (para navegação). */
export interface BiHorariaOcphCabecalho {
  id: number;
  doc_id: string;
  filial_nome: string;
  data_dia: string;
}

/**
 * Cabeçalhos distintos (data + filial + doc_id) vindos só da OCPH.
 * Sem período: até 8000 linhas OCPH (deduplicadas); com período: filtra por data_dia.
 */
export async function getBiHorariaDocumentosCabecalho(params?: {
  dataInicio?: string;
  dataFim?: string;
}): Promise<BiHorariaOcphCabecalho[]> {
  let q = supabase
    .from("OCPH")
    .select("id, doc_id, filial_nome, data_dia")
    .like("observacoes", "Bi-horária nº%")
    .not("doc_id", "is", null)
    .order("id", { ascending: true })
    .limit(8000);

  const di = params?.dataInicio?.split("T")[0];
  const df = params?.dataFim?.split("T")[0];
  if (di) q = q.gte("data_dia", di);
  if (df) q = q.lte("data_dia", df);

  const { data, error } = await q;
  if (error) throw error;

  const map = new Map<string, BiHorariaOcphCabecalho>();
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const docId = String(r.doc_id ?? "").trim();
    if (!docId) continue;
    const filial = String(r.filial_nome ?? "").trim();
    const raw = r.data_dia;
    let day = "";
    if (raw != null && raw !== "") {
      if (typeof raw === "string") {
        day = raw.split("T")[0];
      } else {
        const d = new Date(String(raw));
        day = Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
      }
    }
    if (!day) continue;
    const k = `${day}_${filial}_${docId}`;
    const id = Number(r.id);
    if (!Number.isFinite(id)) continue;
    const prev = map.get(k);
    if (prev == null || id < prev.id) {
      map.set(k, { id, doc_id: docId, filial_nome: filial, data_dia: day });
    }
  }
  return Array.from(map.values());
}

export async function getBiHorariaResumoPorPeriodo(params: {
  dataInicio: string;
  dataFim: string;
  filialNome?: string | null;
  tipoTurno?: "todos" | "1" | "2" | "3";
}): Promise<Array<{ name: string; valor: number; percentual: number }>> {
  const de = String(params.dataInicio || "").split("T")[0];
  const ate = String(params.dataFim || "").split("T")[0];
  if (!de || !ate) {
    return [
      { name: "1° turno", valor: 0, percentual: 0 },
      { name: "2° turno", valor: 0, percentual: 0 },
      { name: "3° turno", valor: 0, percentual: 0 },
    ];
  }

  let q = supabase
    .from("OCPH")
    .select("turno, qtd_realizada")
    .like("observacoes", "Bi-horária nº%")
    .gte("data_dia", de)
    .lte("data_dia", ate);

  const filial = params.filialNome != null && String(params.filialNome).trim() !== "" ? String(params.filialNome).trim() : null;
  if (filial) q = q.eq("filial_nome", filial);

  const tipo = params.tipoTurno ?? "todos";
  if (tipo !== "todos") q = q.eq("turno", Number(tipo));

  const { data, error } = await q;
  if (error) throw error;

  const acc = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const turno = Number(r.turno ?? 0);
    if (turno < 1 || turno > 3) continue;
    const qtd = parseBrazilNumber(r.qtd_realizada ?? 0);
    acc.set(turno, (acc.get(turno) ?? 0) + qtd);
  }

  const rows = ([1, 2, 3] as const)
    .map((turno) => ({
      name: `${turno}° turno`,
      valor: acc.get(turno) ?? 0,
    }))
    .sort((a, b) => b.valor - a.valor);
  const total = rows.reduce((s, r) => s + r.valor, 0);
  return rows.map((r) => ({ ...r, percentual: total > 0 ? (r.valor / total) * 100 : 0 }));
}

// --- Produção save (payload no formato do frontend: quantidadePlanejada, codigoItem, etc.) ---
export async function saveProducao(payload: {
  dataDia: string;
  filialNome?: string | null;
  docId?: string | null;
  items: Array<Record<string, unknown>>;
  existingIds: (number | string | null)[];
  reprocessos?: Array<Record<string, unknown>>;
  latasPrevista?: number | string;
  latasRealizadas?: number | string;
  latasBatidas?: number | string;
  totalCortado?: number | string;
  percentualMeta?: number | string;
  totalReprocesso?: number | string;
}) {
  const { dataDia, filialNome, docId, items, existingIds, reprocessos, latasPrevista = 0, latasRealizadas = 0, latasBatidas = 0, totalCortado = 0, percentualMeta: pctMeta = 0, totalReprocesso: totalRep = 0 } = payload;
  const totalReprocesso = (reprocessos || []).reduce((s, r) => s + parseBrazilNumber(r.quantidade ?? 0), 0);
  const pct = items.length
    ? (items.reduce((s, i) => s + parseBrazilNumber(i.quantidadeRealizada ?? i.qtd_realizada ?? 0), 0) /
        (items.reduce((s, i) => s + parseBrazilNumber(i.quantidadePlanejada ?? i.qtd_planejada ?? 0), 0) || 1)) *
      100
    : parseBrazilNumber(pctMeta);
  const firstRep = reprocessos && reprocessos.length > 0 ? reprocessos[0] : null;

  // OCPD exige line_id (BIGINT NOT NULL): mapear código da linha (linha) para id da OCLP
  const lines = await getLines();
  const lineIdByCode: Record<string, number> = {};
  for (const l of lines) {
    const code = String(l.code ?? "").trim();
    if (code) lineIdByCode[code] = Number(l.id);
    const name = String(l.name ?? "").trim();
    if (name && !lineIdByCode[name]) lineIdByCode[name] = Number(l.id);
  }

  // hora_final na OCPD é TIMESTAMPTZ; o frontend envia "HH:MM:SS" ou "HH:MM" — converter para ISO
  const toTimestamp = (dateStr: string, timeStr: string | null | undefined): string | null => {
    const t = timeStr != null ? String(timeStr).trim() : "";
    if (!t) return null;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
      const day = (dateStr || dataDia || "").split("T")[0];
      if (!day) return null;
      const combined = t.length === 5 ? `${day}T${t}:00` : `${day}T${t}`;
      try {
        const d = new Date(combined);
        return isNaN(d.getTime()) ? null : d.toISOString();
      } catch {
        return null;
      }
    }
    try {
      const d = new Date(t);
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
      return null;
    }
  };

  // Array completo para a coluna JSONB "reprocessos" (gravado só no primeiro registro OCPD)
  const reprocessosPayload =
    (reprocessos?.length ?? 0) > 0
      ? (reprocessos || []).map((r: Record<string, unknown>) => ({
          numero: Number(r.numero ?? 0),
          tipo: String(r.tipo ?? "Cortado"),
          linha: r.linha != null && String(r.linha).trim() !== "" ? String(r.linha).trim() : null,
          grupo: r.grupo != null && ["Reprocesso", "Matéria Prima Açaí", "Matéria Prima Fruto"].includes(String(r.grupo)) ? String(r.grupo) : "Reprocesso",
          codigo: r.codigo != null ? String(r.codigo) : null,
          descricao: r.descricao != null ? String(r.descricao) : null,
          quantidade: parseFloat(String(r.quantidade ?? 0).replace(",", ".")) || 0,
        }))
      : null;

  const buildRow = (item: Record<string, unknown>, index: number) => {
    const linhaCode = String(item.linha ?? "").trim();
    const lineId = lineIdByCode[linhaCode] ?? (item.line_id != null ? Number(item.line_id) : 0);
    const dataDiaItem = (item.dataDia as string) || dataDia;
    const horaFinalRaw = item.horaFinal ?? item.hora_final ?? null;
    const horaFinalTimestamp = toTimestamp(dataDiaItem, horaFinalRaw as string | null | undefined);
    const row: Record<string, unknown> = {
    data_dia: dataDiaItem,
    filial_nome: filialNome || null,
    doc_id: docId && docId.trim() !== "" ? docId.trim() : null,
    line_id: lineId,
    op: item.op ?? null,
    codigo_item: item.codigoItem ?? item.codigo ?? null,
    descricao_item: item.descricaoItem ?? item.descricao ?? null,
    linha: item.linha ?? null,
    qtd_planejada: parseBrazilNumber(item.quantidadePlanejada ?? item.qtd_planejada ?? 0),
    qtd_realizada: parseBrazilNumber(item.quantidadeRealizada ?? item.qtd_realizada ?? 0),
    diferenca:
      parseBrazilNumber(item.quantidadePlanejada ?? item.qtd_planejada ?? 0) -
      parseBrazilNumber(item.quantidadeRealizada ?? item.qtd_realizada ?? 0),
    calculo_1_horas: (() => {
      const v = item.horasTrabalhadas ?? item.calculo_1_horas ?? null;
      if (v == null || v === "") return null;
      const n = parseFloat(String(v).replace(",", "."));
      return Number.isNaN(n) ? null : n;
    })(),
    restante_horas: item.restanteHoras ?? item.restante ?? null,
    hora_final: horaFinalTimestamp,
    percentual_meta: parseFloat(String(item.percentualMeta ?? item.percentual_meta ?? pct)),
    observacao: item.observacao != null && String(item.observacao).trim() !== "" ? String(item.observacao).trim() : null,
    total_qtd_planejada: 0,
    total_qtd_realizada: 0,
    total_diferenca: 0,
    total_reprocesso_usado: index === 0 ? totalReprocesso : parseFloat(String(totalRep)),
    estim_latas_previstas: parseFloat(String(latasPrevista ?? 0)),
    estim_latas_realizadas: parseFloat(String(latasRealizadas ?? 0)),
    latas_ja_batidas: parseFloat(String(latasBatidas ?? 0)),
    total_ja_cortado: parseFloat(String(totalCortado ?? 0)),
    reprocesso_numero: index === 0 && firstRep ? Number(firstRep.numero) : null,
    reprocesso_tipo: index === 0 && firstRep ? String(firstRep.tipo ?? "") : null,
    reprocesso_linha: index === 0 && firstRep && firstRep.linha != null && String(firstRep.linha).trim() !== "" ? String(firstRep.linha).trim() : null,
    reprocesso_codigo: index === 0 && firstRep ? (firstRep.codigo != null ? String(firstRep.codigo) : null) : null,
    reprocesso_descricao: index === 0 && firstRep ? (firstRep.descricao != null ? String(firstRep.descricao) : null) : null,
    reprocesso_quantidade: index === 0 && firstRep ? parseFloat(String(firstRep.quantidade ?? 0).replace(",", ".")) : 0,
    reprocesso_total_cortado: 0,
    reprocesso_total_usado: index === 0 ? totalReprocesso : parseFloat(String(totalRep)),
  };
    if (index === 0 && reprocessosPayload && reprocessosPayload.length > 0) {
      row.reprocessos = reprocessosPayload;
    }
    return row;
  };

  // Só atualizar/excluir linhas que JÁ são desta filial no banco (evita juntar documentos de BELA e PETRUZ)
  const filialFilter = filialNome && String(filialNome).trim() !== "" ? String(filialNome).trim() : null;
  const dataDay = dataDia.split("T")[0];

  // Para documento com doc_id: em inserções, preencher doc_numero (novo doc = próximo número; doc existente = mesmo número)
  const hasInsert = items.some((_, idx) => {
    const id = existingIds[idx];
    return id == null || id === "" || !Number.isInteger(Number(id));
  });
  const hasUpdate = items.some((_, idx) => {
    const id = existingIds[idx];
    return id != null && id !== "" && Number.isInteger(Number(id));
  });
  let nextDocNumero: number | null = null;
  let nextDocOrdemGlobal: number | null = null;
  if (docId && docId.trim() !== "" && hasInsert) {
    const firstExistingId = existingIds.find((id) => id != null && id !== "" && Number.isInteger(Number(id)));
    if (hasUpdate && firstExistingId != null) {
      const { data: existingRow } = await supabase.from("OCPD").select("doc_numero, doc_ordem_global").eq("id", Number(firstExistingId)).single();
      const er = existingRow as { doc_numero?: number; doc_ordem_global?: number } | null;
      nextDocNumero = er?.doc_numero ?? null;
      nextDocOrdemGlobal = er?.doc_ordem_global ?? null;
    }
    if (nextDocNumero == null) {
      let maxQuery = supabase
        .from("OCPD")
        .select("doc_numero")
        .not("doc_numero", "is", null)
        .order("doc_numero", { ascending: false })
        .limit(1);
      if (filialFilter) maxQuery = maxQuery.eq("filial_nome", filialFilter);
      else maxQuery = maxQuery.is("filial_nome", null);
      const { data: maxRow } = await maxQuery.maybeSingle();
      nextDocNumero = ((maxRow as { doc_numero?: number } | null)?.doc_numero ?? 0) + 1;
    }
    if (nextDocOrdemGlobal == null) {
      const { data: maxOrd } = await supabase
        .from("OCPD")
        .select("doc_ordem_global")
        .not("doc_ordem_global", "is", null)
        .order("doc_ordem_global", { ascending: false })
        .limit(1)
        .maybeSingle();
      nextDocOrdemGlobal = ((maxOrd as { doc_ordem_global?: number } | null)?.doc_ordem_global ?? 0) + 1;
    }
  }

  let updated = 0;
  let inserted = 0;
  const insertedRows: { id: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const id = existingIds[i];
    const row = buildRow(items[i], i);
    if (id != null && Number.isInteger(Number(id))) {
      let updateQuery = supabase.from("OCPD").update(row).eq("id", Number(id));
      if (filialFilter) updateQuery = updateQuery.eq("filial_nome", filialFilter);
      const { error: upErr } = await updateQuery;
      if (upErr) throw upErr;
      updated++;
    } else {
      if (nextDocNumero != null) (row as Record<string, unknown>).doc_numero = nextDocNumero;
      if (nextDocOrdemGlobal != null) (row as Record<string, unknown>).doc_ordem_global = nextDocOrdemGlobal;
      const { data: insertedData, error: inErr } = await supabase.from("OCPD").insert(row).select("id").single();
      if (inErr) throw inErr;
      inserted++;
      if (insertedData?.id) {
        insertedRows.push({ id: insertedData.id as number });
      }
    }
  }
  const toDelete = existingIds.slice(items.length).filter((id) => id != null && Number.isInteger(Number(id)));
  for (const id of toDelete) {
    let deleteQuery = supabase.from("OCPD").delete().eq("id", Number(id));
    if (filialFilter) deleteQuery = deleteQuery.eq("filial_nome", filialFilter);
    const { error: delErr } = await deleteQuery;
    if (delErr) throw delErr;
  }
  if (items.length > 0 && inserted === 0 && updated === 0) {
    throw new Error(
      "Nenhum registro foi gravado. Execute no Supabase o script RLS_TODAS_TABELAS_FRONTEND.sql (políticas de segurança da tabela OCPD)."
    );
  }

  return { success: true, inserted, updated, total: items.length, data: insertedRows };
}

/** Remove um registro da tabela OCPD pelo id. Use ao excluir uma linha do card de produção que já foi salva no banco. */
export async function deleteProducaoRecord(id: number) {
  const { error } = await supabase.from("OCPD").delete().eq("id", Number(id));
  if (error) throw error;
}

/**
 * Atualiza somente qtd_hs (em lote) para um conjunto de linhas OCPD por id.
 * O cálculo de p_hora_final deve ser feito no banco (trigger).
 */
export async function updateOcpdQtdHsByIds(ids: number[], qtdHs: number): Promise<void> {
  const safeIds = (ids || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  if (safeIds.length === 0) return;
  if (!Number.isFinite(qtdHs)) throw new Error("Qtd. Hs inválida.");
  const { error } = await supabase.from("OCPD").update({ qtd_hs: qtdHs }).in("id", safeIds);
  if (error) {
    const msg = String((error as { message?: string }).message || "").toLowerCase();
    if (msg.includes("qtd_hs") && msg.includes("does not exist")) {
      throw new Error("A coluna qtd_hs não existe na OCPD. Execute o SQL de criação da coluna no Supabase.");
    }
    throw error;
  }
}

/** Exclui um documento inteiro da Produção (linhas OCPD + bi-horária OCPH). */
export async function deleteProducaoDocumento(params: {
  docId?: string | null;
  dataDia?: string | null;
  filialNome?: string | null;
  ocpdIds?: Array<number | null | undefined>;
}) {
  const docId = params.docId != null && String(params.docId).trim() !== "" ? String(params.docId).trim() : null;
  const dataDia = params.dataDia != null && String(params.dataDia).trim() !== "" ? String(params.dataDia).trim() : null;
  const filialNome = params.filialNome != null && String(params.filialNome).trim() !== "" ? String(params.filialNome).trim() : null;
  const ocpdIds = (params.ocpdIds ?? [])
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);

  // OCPD (linhas do documento)
  if (ocpdIds.length > 0) {
    let delOcpd = supabase.from("OCPD").delete().in("id", ocpdIds);
    if (filialNome) delOcpd = delOcpd.eq("filial_nome", filialNome);
    const { error } = await delOcpd;
    if (error) throw error;
  } else if (docId) {
    let delOcpd = supabase.from("OCPD").delete().eq("doc_id", docId);
    if (filialNome) delOcpd = delOcpd.eq("filial_nome", filialNome);
    if (dataDia) delOcpd = delOcpd.eq("data_dia", dataDia);
    const { error } = await delOcpd;
    if (error) throw error;
  } else if (dataDia && filialNome) {
    // Fallback para documento legado sem doc_id.
    const { error } = await supabase
      .from("OCPD")
      .delete()
      .is("doc_id", null)
      .eq("data_dia", dataDia)
      .eq("filial_nome", filialNome);
    if (error) throw error;
  } else {
    throw new Error("Não foi possível identificar o documento para exclusão.");
  }

  // OCPH (bi-horária desse documento)
  let delOcph = supabase.from("OCPH").delete().like("observacoes", "Bi-horária nº%");
  if (docId) {
    delOcph = delOcph.eq("doc_id", docId);
  } else {
    delOcph = delOcph.is("doc_id", null);
    if (dataDia) delOcph = delOcph.eq("data_dia", dataDia);
    if (filialNome) delOcph = delOcph.eq("filial_nome", filialNome);
  }
  const { error: delOcphError } = await delOcph;
  if (delOcphError) throw delOcphError;

  return { success: true };
}

/** Exclui somente os registros da Bi-horária (OCPH) de um documento. */
export async function deleteBiHorariaDocumento(params: {
  docId?: string | null;
  dataDia?: string | null;
  filialNome?: string | null;
}) {
  const docId = params.docId != null && String(params.docId).trim() !== "" ? String(params.docId).trim() : null;
  const dataDia = params.dataDia != null && String(params.dataDia).trim() !== "" ? String(params.dataDia).trim() : null;
  const filialNome = params.filialNome != null && String(params.filialNome).trim() !== "" ? String(params.filialNome).trim() : null;

  let delOcph = supabase.from("OCPH").delete().like("observacoes", "Bi-horária nº%");
  if (docId) {
    delOcph = delOcph.eq("doc_id", docId);
  } else {
    delOcph = delOcph.is("doc_id", null);
    if (dataDia) delOcph = delOcph.eq("data_dia", dataDia);
    if (filialNome) delOcph = delOcph.eq("filial_nome", filialNome);
  }
  const { error } = await delOcph;
  if (error) throw error;

  return { success: true };
}

// --- Histórico produção ---
export async function getProducaoHistory(params: {
  limit?: number;
  dataInicio?: string;
  dataFim?: string;
  linha?: string;
  filialNome?: string;
  codigoItem?: string;
}) {
  let query = supabase
    .from("OCPD")
    .select("*")
    .order("data_dia", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 500);
  if (params.dataInicio) query = query.gte("data_dia", params.dataInicio);
  if (params.dataFim) query = query.lte("data_dia", params.dataFim);
  if (params.linha) query = query.eq("linha", params.linha);
  if (params.filialNome) query = query.eq("filial_nome", params.filialNome);
  if (params.codigoItem != null && String(params.codigoItem).trim() !== "")
    query = query.eq("code", String(params.codigoItem).trim());
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Inscreve em alterações em tempo real da tabela OCPD (Acompanhamento diário da produção).
 * Quando qualquer usuário alterar um registro, o callback é chamado para todos verem os mesmos dados.
 * @param onChanges - chamado em INSERT, UPDATE ou DELETE na OCPD
 * @returns função para cancelar a inscrição
 */
export function subscribeOCPDRealtime(onChanges: () => void): () => void {
  const channel = supabase
    .channel("ocpd-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "OCPD" },
      () => {
        onChanges();
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Inscreve em alterações na tabela OCPH (bi-horária e histórico por item).
 * Ative a publicação da tabela OCPH em Database → Replication no Supabase, se os eventos não chegarem.
 */
export function subscribeOCPHRealtime(onChanges: () => void): () => void {
  const channel = supabase
    .channel("ocph-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "OCPH" },
      () => {
        onChanges();
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// --- Draft (OCTU_DRAFT_AUTH: auth_user_id uuid, screen, data jsonb) ---
export async function getDraft(authUserId: string, screen: string) {
  const { data, error } = await supabase
    .from(DRAFT_TABLE)
    .select("data, updated_at")
    .eq("auth_user_id", authUserId)
    .eq("screen", screen)
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "42P01") return { data: null, updated_at: null };
    throw error;
  }
  return { data: data?.data ?? null, updated_at: data?.updated_at ?? null };
}

export async function saveDraft(authUserId: string, screen: string, payload: object) {
  const { error } = await supabase.from(DRAFT_TABLE).upsert(
    { auth_user_id: authUserId, screen, data: payload, updated_at: new Date().toISOString() },
    { onConflict: "auth_user_id,screen" }
  );
  if (error) throw error;
  return { success: true };
}

// --- Importar Excel: comparar e inserir itens (OCTI) sem backend ---
const OCTI_BATCH = 1000;

/** Retorna todos os pares Code, Name da OCTI (em lotes) para comparação no frontend. */
export async function getExistingOCTIPairs(): Promise<{ Code: string; Name: string }[]> {
  const out: { Code: string; Name: string }[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("OCTI")
      .select('"Code", "Name"')
      .range(from, from + OCTI_BATCH - 1)
      .order("id", { ascending: true });
    if (error) throw error;
    if (data && data.length > 0) {
      out.push(...(data as { Code: string; Name: string }[]));
      from += OCTI_BATCH;
      if (data.length < OCTI_BATCH) hasMore = false;
    } else {
      hasMore = false;
    }
    if (out.length >= 100_000) hasMore = false; // limite de segurança
  }
  return out;
}

export interface NewItemForInsert {
  codigo_item: string;
  nome_item: string;
  unidade_medida: string;
  grupo_itens: string;
}

const OCTI_INSERT_BATCH = 50;

/** Insere itens na OCTI (Code, Name, U_Uom, U_ItemGroup) em lotes. Retorna inserted e total. */
export async function insertOCTIItems(
  items: NewItemForInsert[]
): Promise<{ success: true; inserted: number; total: number; skipped: number }> {
  const valid = items.filter((i) => i.codigo_item?.trim() && i.nome_item?.trim());
  if (valid.length === 0) {
    return { success: true, inserted: 0, total: items.length, skipped: items.length };
  }
  const existing = await getExistingOCTIPairs();
  const existingSet = new Set(
    existing.map((i) => `${(i.Code ?? "").toString().trim().toLowerCase()}|${(i.Name ?? "").toString().trim().toLowerCase()}`)
  );
  const toInsert = valid.filter((i) => {
    const key = `${(i.codigo_item ?? "").toString().trim().toLowerCase()}|${(i.nome_item ?? "").toString().trim().toLowerCase()}`;
    return !existingSet.has(key);
  });
  if (toInsert.length === 0) {
    return { success: true, inserted: 0, total: valid.length, skipped: valid.length };
  }
  let totalInserted = 0;
  for (let i = 0; i < toInsert.length; i += OCTI_INSERT_BATCH) {
    const batch = toInsert.slice(i, i + OCTI_INSERT_BATCH);
    const rows = batch.map((it) => ({
      Code: it.codigo_item,
      Name: it.nome_item,
      U_Uom: it.unidade_medida || null,
      U_ItemGroup: it.grupo_itens || null,
    }));
    const { data, error } = await supabase.from("OCTI").insert(rows).select();
    if (error) {
      const err = error as { code?: string; message?: string; details?: string };
      if (err.code === "23505") {
        for (const row of rows) {
          const { error: singleError } = await supabase.from("OCTI").insert(row).select();
          if (!singleError) totalInserted += 1;
        }
      } else {
        const msg = err.message || err.details || `Erro Supabase (${err.code || "unknown"}). Verifique RLS e permissões na tabela OCTI.`;
        throw new Error(msg);
      }
    } else {
      totalInserted += data?.length ?? 0;
    }
  }
  return {
    success: true,
    inserted: totalInserted,
    total: valid.length,
    skipped: valid.length - totalInserted,
  };
}

// --- OCTP (Problemas / Ações / Status) ---
export interface OCTPRow {
  id: number;
  numero: number;
  problema: string | null;
  acao: string | null;
  responsavel: string | null;
  hora: string | null; // ISO timestamp from DB
  inicio: string | null; // YYYY-MM-DD
  hora_inicio: string | null; // HH:MM (editável; coluna hora_inicio na OCTP)
  hora_final: string | null;  // HH:MM (editável; coluna hora_fim na OCTP)
  duracao_minutos: number | null; // intervalo em minutos (coluna duracao_minutos na OCTP)
  descricao_status: string | null;
  data_dia?: string | null;
  filial_nome?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Converte HH:MM ou HH:MM:SS em minutos desde 00:00. Retorna null se inválido. */
function timeToMinutes(s: string | null | undefined): number | null {
  if (!s || !String(s).trim()) return null;
  const parts = String(s).trim().split(/[:\s]/).map(Number);
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return parts[0] * 60 + parts[1] + (parts[2] != null && !Number.isNaN(parts[2]) ? Math.round(parts[2] / 60) : 0);
  }
  return null;
}

/** Calcula duração em minutos entre hora inicial e hora final (HH:MM). Retorna null se algum inválido. */
export function computeDuracaoMinutos(horaInicio: string | null | undefined, horaFinal: string | null | undefined): number | null {
  const minIni = timeToMinutes(horaInicio);
  const minFim = timeToMinutes(horaFinal);
  if (minIni == null || minFim == null) return null;
  let diff = minFim - minIni;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function mapOCTPRecord(r: Record<string, unknown>): OCTPRow {
  return {
    id: Number(r.id),
    numero: Number(r.numero ?? 0),
    problema: r.problema != null ? String(r.problema) : null,
    acao: r.acao != null ? String(r.acao) : null,
    responsavel: r.responsavel != null ? String(r.responsavel) : null,
    hora: r.hora != null ? String(r.hora) : null,
    inicio: r.inicio != null ? String(r.inicio) : null,
    hora_inicio: (r.hora_inicio != null ? String(r.hora_inicio).slice(0, 8) : null) as string | null,
    hora_final: (r.hora_fim != null ? String(r.hora_fim).slice(0, 8) : r.hora_final != null ? String(r.hora_final).slice(0, 8) : null) as string | null,
    duracao_minutos: r.duracao_minutos != null ? Number(r.duracao_minutos) : null,
    descricao_status: r.descricao_status != null ? String(r.descricao_status) : null,
    data_dia: r.data_dia != null ? String(r.data_dia) : null,
    filial_nome: r.filial_nome != null ? String(r.filial_nome) : null,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

/**
 * Busca registros OCTP do documento (problemas/ações).
 * Quando `data_dia` existe no banco, filtra só por `data_dia` + `filial_nome` — a coluna `inicio` é a data
 * editável de cada linha, não o documento; filtrar por `inicio === "hoje"` fazia sumir tudo ao abrir dias antigos.
 */
export async function getOCTPByInicio(
  inicio: string,
  dataDia?: string,
  filialNome?: string
): Promise<OCTPRow[]> {
  let query = supabase.from("OCTP").select("*");

  if (dataDia) {
    query = query.eq("data_dia", dataDia);
  } else {
    query = query.eq("inicio", inicio);
  }
  if (filialNome) {
    query = query.eq("filial_nome", filialNome);
  }

  const { data, error } = await query.order("numero", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => mapOCTPRecord(row as Record<string, unknown>));
}

/**
 * Todos os OCTP da filial com `data_dia` no intervalo [dataInicio, dataFim] (inclusive).
 * Inclui legado sem `data_dia` quando `inicio` cai no mesmo intervalo.
 */
export async function getOCTPByDateRange(params: {
  dataInicio: string;
  dataFim: string;
  filialNome: string;
}): Promise<OCTPRow[]> {
  const de = params.dataInicio.split("T")[0];
  const ate = params.dataFim.split("T")[0];
  const filial = params.filialNome.trim();
  if (!filial) return [];

  const { data: comDia, error: err1 } = await supabase
    .from("OCTP")
    .select("*")
    .eq("filial_nome", filial)
    .gte("data_dia", de)
    .lte("data_dia", ate)
    .order("data_dia", { ascending: true })
    .order("id", { ascending: true });

  if (err1) throw err1;

  const { data: legado, error: err2 } = await supabase
    .from("OCTP")
    .select("*")
    .eq("filial_nome", filial)
    .is("data_dia", null)
    .gte("inicio", de)
    .lte("inicio", ate)
    .order("inicio", { ascending: true })
    .order("id", { ascending: true });

  if (err2) throw err2;

  const byId = new Map<number, OCTPRow>();
  for (const raw of [...(comDia || []), ...(legado || [])]) {
    const row = mapOCTPRecord(raw as Record<string, unknown>);
    byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const da = (a.data_dia || a.inicio || "").split("T")[0];
    const db = (b.data_dia || b.inicio || "").split("T")[0];
    if (da !== db) return da.localeCompare(db);
    return a.id - b.id;
  });
}

export async function insertOCTP(payload: {
  numero: number;
  problema?: string | null;
  acao?: string | null;
  responsavel?: string | null;
  inicio?: string | null;
  hora_inicio?: string | null;
  hora_final?: string | null;
  descricao_status?: string | null;
  dataDia?: string | null;
  filialNome?: string | null;
}): Promise<OCTPRow> {
  const toTime = (v: string | null | undefined) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
  const row: Record<string, unknown> = {
    numero: payload.numero,
    problema: payload.problema ?? null,
    acao: payload.acao ?? null,
    responsavel: payload.responsavel ?? null,
    inicio: payload.inicio ?? new Date().toISOString().slice(0, 10),
    data_dia: payload.dataDia ?? null,
    filial_nome: payload.filialNome ?? null,
    descricao_status: payload.descricao_status ?? null,
  };
  if (payload.hora_inicio !== undefined) row.hora_inicio = toTime(payload.hora_inicio);
  if (payload.hora_final !== undefined) row.hora_fim = toTime(payload.hora_final);
  const duracao = computeDuracaoMinutos(payload.hora_inicio, payload.hora_final);
  if (duracao !== null) row.duracao_minutos = duracao;
  const { data, error } = await supabase.from("OCTP").insert(row).select("*").single();
  if (error) throw error;
  return mapOCTPRecord(data as Record<string, unknown>);
}

export async function updateOCTP(
  id: number,
  payload: {
    numero?: number;
    problema?: string | null;
    acao?: string | null;
    responsavel?: string | null;
    inicio?: string | null;
    hora_inicio?: string | null;
    hora_final?: string | null;
    duracao_minutos?: number | null;
    descricao_status?: string | null;
    dataDia?: string | null;
    filialNome?: string | null;
  }
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (payload.numero !== undefined) body.numero = payload.numero;
  if (payload.problema !== undefined) body.problema = payload.problema;
  if (payload.acao !== undefined) body.acao = payload.acao;
  if (payload.responsavel !== undefined) body.responsavel = payload.responsavel;
  if (payload.inicio !== undefined) body.inicio = payload.inicio;
  if (payload.hora_inicio !== undefined) body.hora_inicio = payload.hora_inicio != null && String(payload.hora_inicio).trim() !== "" ? payload.hora_inicio : null;
  if (payload.hora_final !== undefined) body.hora_fim = payload.hora_final != null && String(payload.hora_final).trim() !== "" ? payload.hora_final : null;
  if (payload.duracao_minutos !== undefined) body.duracao_minutos = payload.duracao_minutos;
  else {
    const duracao = computeDuracaoMinutos(payload.hora_inicio, payload.hora_final);
    if (duracao !== null) body.duracao_minutos = duracao;
  }
  if (payload.descricao_status !== undefined) body.descricao_status = payload.descricao_status;
  if (payload.dataDia !== undefined) body.data_dia = payload.dataDia;
  if (payload.filialNome !== undefined) body.filial_nome = payload.filialNome;
  if (Object.keys(body).length === 0) return;
  const { error } = await supabase.from("OCTP").update(body).eq("id", id);
  if (error) throw error;
}

export async function deleteOCTP(id: number): Promise<void> {
  const { error } = await supabase.from("OCTP").delete().eq("id", id);
  if (error) throw error;
}

export type { OCTERow, OCTEPayload } from "./octe";
export { getOCTEByDateRange, getNextOCTEDocumentCode, insertOCTE, updateOCTE, deleteOCTE } from "./octe";

export type { OCTCRow, OCTCPayload } from "./octc";
export { getOCTCList, insertOCTC, updateOCTC, deleteOCTC } from "./octc";

export type { OCTRFRow, OCTRFPayload } from "./octrf";
export { getOCTRFList, insertOCTRF, updateOCTRF, deleteOCTRF } from "./octrf";
