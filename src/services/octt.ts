/**
 * Cadastro de túneis (tabela OCTT no Supabase).
 * INSERT/UPDATE usam RPC para evitar 400 do PostgREST com a coluna reservada "data".
 * Rode OCTT_RPC_MUTATIONS.sql no Supabase antes de usar salvar/editar.
 */

import { supabase } from "@/lib/supabase";

const TABLE = "OCTT";

const NOME_MAX = 255;
const FILIAL_MAX = 255;
const STATUS_MAX = 60;

const SELECT_LIST =
  'id, codigo_documento, filial_nome, "data", nome, capacidade_maxima_tunel, status_operacional';

function fmtErr(e: { message?: string; details?: string; hint?: string; code?: string }): string {
  const parts = [e.message, e.details, e.hint, e.code ? `[${e.code}]` : ""].filter(Boolean);
  return parts.join(" — ") || "Erro na tabela OCTT.";
}

function hintUniqueCodigoPorFilial(e: { message?: string; code?: string }): string {
  const msg = String(e.message || "").toLowerCase();
  const code = String(e.code || "");
  if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
    return (
      " Código duplicado no banco: rode no Supabase o script OCTT_UNIQUE_FILIAL_CODIGO.sql " +
      "(UNIQUE em filial_nome + codigo_documento, não só no código)."
    );
  }
  return "";
}

function assertFin(label: string, n: number) {
  if (!Number.isFinite(n)) throw new Error(`${label} inválido.`);
}

export interface OCTTRow {
  id: number;
  code: string;
  name: string;
  filial: string;
  data: string;
  capacidadeMaximaTunel: number;
  statusOperacional: string;
}

function mapRow(r: Record<string, unknown>): OCTTRow {
  return {
    id: Number(r.id),
    code: String(r.codigo_documento ?? ""),
    name: String(r.nome ?? ""),
    filial: String(r.filial_nome ?? ""),
    data: String(r.data ?? "").split("T")[0],
    capacidadeMaximaTunel: Number(r.capacidade_maxima_tunel ?? 0),
    statusOperacional: String(r.status_operacional ?? ""),
  };
}

export async function getTuneis(): Promise<OCTTRow[]> {
  const { data, error } = await supabase.from(TABLE).select(SELECT_LIST).order("codigo_documento", { ascending: true });
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
  return (data || []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createTunel(payload: {
  codigo_documento: number;
  nome: string;
  filial_nome: string;
  data: string;
  capacidade_maxima_tunel: number;
  status_operacional: string;
}) {
  const codigo = Number(payload.codigo_documento);
  const cap = Number(payload.capacidade_maxima_tunel ?? 0);
  assertFin("Código do documento", codigo);
  assertFin("Capacidade máxima do túnel", cap);
  const day = String(payload.data ?? "").split("T")[0];
  if (!day) throw new Error("Data obrigatória.");

  const nome = String(payload.nome ?? "").trim().slice(0, NOME_MAX);
  const filial = String(payload.filial_nome ?? "").trim().slice(0, FILIAL_MAX);
  const status = String(payload.status_operacional ?? "").trim().slice(0, STATUS_MAX);

  const { error: rpcErr } = await supabase.rpc("octt_insert_row", {
    p_codigo_documento: codigo,
    p_filial_nome: filial,
    p_dia: day,
    p_nome: nome,
    p_capacidade_maxima_tunel: cap,
    p_status_operacional: status,
  });

  if (!rpcErr) return;

  const row = {
    codigo_documento: codigo,
    nome,
    filial_nome: filial,
    data: day,
    capacidade_maxima_tunel: cap,
    status_operacional: status,
  };
  const { error: restErr } = await supabase.from(TABLE).insert(row);
  if (!restErr) return;

  const fnMissing =
    String((rpcErr as { message?: string }).message || "").toLowerCase().includes("octt_insert_row") ||
    (rpcErr as { code?: string }).code === "42883";
  const hint = fnMissing ? " Rode no Supabase: OCTT_RPC_MUTATIONS.sql." : "";
  const u1 = hintUniqueCodigoPorFilial(rpcErr as { message?: string; code?: string });
  const u2 = hintUniqueCodigoPorFilial(restErr as { message?: string; code?: string });
  throw new Error(
    [fmtErr(rpcErr as never), fmtErr(restErr as never), hint, u1 || u2].filter(Boolean).join(" ")
  );
}

export async function updateTunel(
  id: number,
  payload: {
    codigo_documento?: number;
    nome?: string;
    filial_nome?: string;
    data?: string;
    capacidade_maxima_tunel?: number;
    status_operacional?: string;
  }
) {
  const body: Record<string, unknown> = {};
  if (payload.codigo_documento !== undefined) {
    const n = Number(payload.codigo_documento);
    assertFin("Código do documento", n);
    body.codigo_documento = n;
  }
  if (payload.nome !== undefined) body.nome = String(payload.nome ?? "").trim().slice(0, NOME_MAX);
  if (payload.filial_nome !== undefined) body.filial_nome = String(payload.filial_nome ?? "").trim().slice(0, FILIAL_MAX);
  if (payload.data !== undefined) body.data = String(payload.data ?? "").split("T")[0];
  if (payload.capacidade_maxima_tunel !== undefined) {
    const n = Number(payload.capacidade_maxima_tunel ?? 0);
    assertFin("Capacidade máxima do túnel", n);
    body.capacidade_maxima_tunel = n;
  }
  if (payload.status_operacional !== undefined)
    body.status_operacional = String(payload.status_operacional ?? "").trim().slice(0, STATUS_MAX);
  if (Object.keys(body).length === 0) return;

  const pid = Number(id);
  const full =
    body.codigo_documento !== undefined &&
    body.filial_nome !== undefined &&
    body.data !== undefined &&
    body.nome !== undefined &&
    body.capacidade_maxima_tunel !== undefined &&
    body.status_operacional !== undefined;

  if (full) {
    const { error: rpcErr } = await supabase.rpc("octt_update_row", {
      p_id: pid,
      p_codigo_documento: body.codigo_documento as number,
      p_filial_nome: body.filial_nome as string,
      p_dia: body.data as string,
      p_nome: body.nome as string,
      p_capacidade_maxima_tunel: body.capacidade_maxima_tunel as number,
      p_status_operacional: body.status_operacional as string,
    });
    if (!rpcErr) return;
    const { error: restErr } = await supabase.from(TABLE).update(body).eq("id", pid);
    if (!restErr) return;
    const fnm =
      String((rpcErr as { message?: string }).message || "").toLowerCase().includes("octt_update_row") ||
      (rpcErr as { code?: string }).code === "42883";
    const hint = fnm ? " Rode: OCTT_RPC_MUTATIONS.sql." : "";
    throw new Error([fmtErr(rpcErr as never), fmtErr(restErr as never), hint].filter(Boolean).join(" "));
  }

  const { error } = await supabase.from(TABLE).update(body).eq("id", pid);
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
}

export async function deleteTunel(id: number) {
  const { error } = await supabase.from(TABLE).delete().eq("id", Number(id));
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
}

/** Realtime na OCTT: habilite a tabela em Database → Replication (Supabase) se os eventos não chegarem. */
export function subscribeOCTTRealtime(onChanges: () => void): () => void {
  const channel = supabase
    .channel("octt-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => {
      onChanges();
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
