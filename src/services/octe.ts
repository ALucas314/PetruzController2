import { supabase } from "@/lib/supabase";

const TABLE = "OCTE";

const SELECT_LIST =
  "id, data, codigo_documento, filial_nome, codigo_item, descricao_item, unidade_item, peso, colaborador, quantidade_1, quantidade_2, quantidade_3, quantidade_4, quantidade_5, quantidade_6, quantidade_7, quantidade_8, quantidade_9, quantidade_10, quantidade_11, quantidade_12, funcao_colaborador, meta, horas, observacoes, created_at, updated_at";

const FILIAL_NOME_MAX = 120;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function mapOCTERow(r: Record<string, unknown>): OCTERow {
  return {
    id: Number(r.id),
    data: r.data != null ? String(r.data).split("T")[0] : "",
    codigoDocumento: r.codigo_documento != null && String(r.codigo_documento).trim() !== "" ? String(r.codigo_documento) : null,
    filialNome: String(r.filial_nome ?? ""),
    codigoItem: String(r.codigo_item ?? ""),
    descricaoItem: r.descricao_item != null ? String(r.descricao_item) : "",
    unidadeItem: r.unidade_item != null ? String(r.unidade_item) : "",
    peso: num(r.peso),
    colaborador: r.colaborador != null ? String(r.colaborador) : "",
    quantidade1: num(r.quantidade_1),
    quantidade2: num(r.quantidade_2),
    quantidade3: num(r.quantidade_3),
    quantidade4: num(r.quantidade_4),
    quantidade5: num(r.quantidade_5),
    quantidade6: num(r.quantidade_6),
    quantidade7: num(r.quantidade_7),
    quantidade8: num(r.quantidade_8),
    quantidade9: num(r.quantidade_9),
    quantidade10: num(r.quantidade_10),
    quantidade11: num(r.quantidade_11),
    quantidade12: num(r.quantidade_12),
    funcaoColaborador: r.funcao_colaborador != null ? String(r.funcao_colaborador) : "",
    meta: r.meta != null ? num(r.meta) : null,
    horas: r.horas != null ? num(r.horas) : null,
    observacoes: r.observacoes != null ? String(r.observacoes) : "",
    createdAt: r.created_at != null ? String(r.created_at) : null,
    updatedAt: r.updated_at != null ? String(r.updated_at) : null,
  };
}

export interface OCTERow {
  id: number;
  data: string;
  codigoDocumento: string | null;
  filialNome: string;
  codigoItem: string;
  descricaoItem: string;
  unidadeItem: string;
  peso: number;
  colaborador: string;
  quantidade1: number;
  quantidade2: number;
  quantidade3: number;
  quantidade4: number;
  quantidade5: number;
  quantidade6: number;
  quantidade7: number;
  quantidade8: number;
  quantidade9: number;
  quantidade10: number;
  quantidade11: number;
  quantidade12: number;
  funcaoColaborador: string;
  meta: number | null;
  horas: number | null;
  observacoes: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Próximo código de documento (0001, 0002, …) com base em códigos já usados que são só dígitos (UUIDs e outros formatos são ignorados). */
export async function getNextOCTEDocumentCode(): Promise<string> {
  const codes = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  for (let p = 0; p < 100; p++) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("codigo_documento")
      .not("codigo_documento", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const r of rows) {
      const c = (r as { codigo_documento?: string | null }).codigo_documento;
      const t = c != null ? String(c).trim() : "";
      if (t) codes.add(t);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  let max = 0;
  for (const c of codes) {
    if (/^\d+$/.test(c)) {
      const n = Number(c);
      if (n > max) max = n;
    }
  }
  return String(max + 1).padStart(4, "0");
}

export async function getOCTEByDateRange(dataInicio: string, dataFim: string): Promise<OCTERow[]> {
  const de = dataInicio.split("T")[0];
  const ate = dataFim.split("T")[0];
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_LIST)
    .gte("data", de)
    .lte("data", ate)
    .order("data", { ascending: false })
    .order("id", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data || []).map((row) => mapOCTERow(row as Record<string, unknown>));
}

function bodyFromPayload(payload: OCTEPayload) {
  return {
    data: String(payload.data || "").split("T")[0],
    codigo_documento: payload.codigoDocumento != null && String(payload.codigoDocumento).trim() !== "" ? String(payload.codigoDocumento).trim() : null,
    filial_nome: String(payload.filialNome ?? "")
      .trim()
      .slice(0, FILIAL_NOME_MAX),
    codigo_item: String(payload.codigoItem || "").trim(),
    descricao_item: payload.descricaoItem?.trim() || null,
    unidade_item: payload.unidadeItem?.trim() || null,
    peso: payload.peso == null ? 0 : num(payload.peso),
    colaborador: payload.colaborador?.trim() || null,
    quantidade_1: num(payload.quantidade1),
    quantidade_2: num(payload.quantidade2),
    quantidade_3: num(payload.quantidade3),
    quantidade_4: num(payload.quantidade4),
    quantidade_5: num(payload.quantidade5),
    quantidade_6: num(payload.quantidade6),
    quantidade_7: num(payload.quantidade7),
    quantidade_8: num(payload.quantidade8),
    quantidade_9: num(payload.quantidade9),
    quantidade_10: num(payload.quantidade10),
    quantidade_11: num(payload.quantidade11),
    quantidade_12: num(payload.quantidade12),
    funcao_colaborador: payload.funcaoColaborador?.trim() || null,
    meta: payload.meta == null ? null : num(payload.meta),
    horas: payload.horas == null ? null : num(payload.horas),
    observacoes: payload.observacoes?.trim() || null,
  };
}

export type OCTEPayload = {
  data: string;
  codigoDocumento?: string | null;
  filialNome?: string;
  codigoItem: string;
  descricaoItem?: string;
  unidadeItem?: string;
  peso?: number | null;
  colaborador?: string;
  quantidade1?: number;
  quantidade2?: number;
  quantidade3?: number;
  quantidade4?: number;
  quantidade5?: number;
  quantidade6?: number;
  quantidade7?: number;
  quantidade8?: number;
  quantidade9?: number;
  quantidade10?: number;
  quantidade11?: number;
  quantidade12?: number;
  funcaoColaborador?: string;
  meta?: number | null;
  horas?: number | null;
  observacoes?: string;
};

export async function insertOCTE(payload: OCTEPayload): Promise<OCTERow> {
  const row = bodyFromPayload(payload);
  const { data, error } = await supabase.from(TABLE).insert(row).select(SELECT_LIST).single();
  if (error) throw error;
  return mapOCTERow(data as Record<string, unknown>);
}

export async function updateOCTE(id: number, payload: OCTEPayload): Promise<OCTERow> {
  const body = bodyFromPayload(payload);
  const { data, error } = await supabase.from(TABLE).update(body).eq("id", id).select(SELECT_LIST).single();
  if (error) throw error;
  return mapOCTERow(data as Record<string, unknown>);
}

export async function deleteOCTE(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
