import { supabase } from "@/lib/supabase";

const TABLE = "OCTRF";

const SELECT_LIST = "id, numero_do_documento, nome_da_funcao, created_at, updated_at";

const NUM_DOC_MAX = 60;
const NOME_FUNCAO_MAX = 120;

export interface OCTRFRow {
  id: number;
  numeroDoDocumento: string;
  nomeDaFuncao: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export type OCTRFPayload = {
  numeroDoDocumento: string;
  nomeDaFuncao: string;
};

function mapRow(r: Record<string, unknown>): OCTRFRow {
  return {
    id: Number(r.id),
    numeroDoDocumento: String(r.numero_do_documento ?? ""),
    nomeDaFuncao: String(r.nome_da_funcao ?? ""),
    createdAt: r.created_at != null ? String(r.created_at) : null,
    updatedAt: r.updated_at != null ? String(r.updated_at) : null,
  };
}

function bodyFromPayload(p: OCTRFPayload) {
  return {
    numero_do_documento: String(p.numeroDoDocumento ?? "").trim().slice(0, NUM_DOC_MAX),
    nome_da_funcao: String(p.nomeDaFuncao ?? "").trim().slice(0, NOME_FUNCAO_MAX),
  };
}

/** Ordem crescente pelo nº do documento (numeric: true → 2 antes de 10; 0001 antes de 0002). */
function sortOCTRFByNumeroDocumento(rows: OCTRFRow[]): OCTRFRow[] {
  return [...rows].sort((a, b) => {
    const cmp = a.numeroDoDocumento
      .trim()
      .localeCompare(b.numeroDoDocumento.trim(), "pt-BR", { numeric: true, sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return a.id - b.id;
  });
}

export async function getOCTRFList(): Promise<OCTRFRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_LIST)
    .order("id", { ascending: true })
    .limit(5000);
  if (error) throw error;
  const rows = (data || []).map((row) => mapRow(row as Record<string, unknown>));
  return sortOCTRFByNumeroDocumento(rows);
}

export async function insertOCTRF(payload: OCTRFPayload): Promise<OCTRFRow> {
  const row = bodyFromPayload(payload);
  const { data, error } = await supabase.from(TABLE).insert(row).select(SELECT_LIST).single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function updateOCTRF(id: number, payload: OCTRFPayload): Promise<OCTRFRow> {
  const body = bodyFromPayload(payload);
  const { data, error } = await supabase.from(TABLE).update(body).eq("id", id).select(SELECT_LIST).single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteOCTRF(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
