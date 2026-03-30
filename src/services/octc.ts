import { supabase } from "@/lib/supabase";

const TABLE = "OCTC";

const SELECT_LIST =
  "id, codigo_do_documento, nome_do_colaborador, setor, filial_nome, created_at, updated_at";

const COD_DOC_MAX = 60;
const NOME_MAX = 50;
const SETOR_MAX = 30;
const FILIAL_NOME_MAX = 120;

export interface OCTCRow {
  id: number;
  codigoDoDocumento: string;
  nomeDoColaborador: string;
  setor: string;
  filialNome: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export type OCTCPayload = {
  codigoDoDocumento: string;
  nomeDoColaborador: string;
  setor: string;
  filialNome: string;
};

function mapRow(r: Record<string, unknown>): OCTCRow {
  return {
    id: Number(r.id),
    codigoDoDocumento: String(r.codigo_do_documento ?? ""),
    nomeDoColaborador: String(r.nome_do_colaborador ?? ""),
    setor: String(r.setor ?? ""),
    filialNome: String(r.filial_nome ?? ""),
    createdAt: r.created_at != null ? String(r.created_at) : null,
    updatedAt: r.updated_at != null ? String(r.updated_at) : null,
  };
}

function bodyFromPayload(p: OCTCPayload) {
  return {
    codigo_do_documento: String(p.codigoDoDocumento ?? "").trim().slice(0, COD_DOC_MAX),
    nome_do_colaborador: String(p.nomeDoColaborador ?? "").trim().slice(0, NOME_MAX),
    setor: String(p.setor ?? "").trim().slice(0, SETOR_MAX),
    filial_nome: String(p.filialNome ?? "").trim().slice(0, FILIAL_NOME_MAX),
  };
}

export async function getOCTCList(): Promise<OCTCRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_LIST)
    .order("nome_do_colaborador", { ascending: true })
    .order("id", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data || []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function insertOCTC(payload: OCTCPayload): Promise<OCTCRow> {
  const row = bodyFromPayload(payload);
  const { data, error } = await supabase.from(TABLE).insert(row).select(SELECT_LIST).single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function updateOCTC(id: number, payload: OCTCPayload): Promise<OCTCRow> {
  const body = bodyFromPayload(payload);
  const { data, error } = await supabase.from(TABLE).update(body).eq("id", id).select(SELECT_LIST).single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteOCTC(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
