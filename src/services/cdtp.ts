/**
 * Cadastro de tipo de produtos — tabela CDTP no Supabase.
 * Rode CDTP_TABLE.sql e CDTP_RLS_PERMITIR_LEITURA.sql (ou RLS_TODAS_TABELAS_FRONTEND.sql).
 */

import { supabase } from "@/lib/supabase";

const TABLE = "CDTP";

const NOME_MAX = 255;
const FILIAL_MAX = 255;
const DESCR_MAX = 20000;

const SELECT_LIST =
  "id, filial_nome, codigo_documento, tempo_max_congelamento_minutos, nome, descricao_produto";

function fmtErr(e: { message?: string; details?: string; hint?: string; code?: string }): string {
  const parts = [e.message, e.details, e.hint, e.code ? `[${e.code}]` : ""].filter(Boolean);
  return parts.join(" — ") || "Erro na tabela CDTP.";
}

function hintUniqueCodigoPorFilial(e: { message?: string; code?: string }): string {
  const msg = String(e.message || "").toLowerCase();
  const code = String(e.code || "");
  if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
    return " Código duplicado para esta filial (índice único filial_nome + codigo_documento).";
  }
  return "";
}

function assertFin(label: string, n: number) {
  if (!Number.isFinite(n)) throw new Error(`${label} inválido.`);
}

export interface CDTPRow {
  id: number;
  code: string;
  filial: string;
  nome: string;
  descricaoProduto: string;
  tempoMaxCongelamentoMinutos: number;
}

function mapRow(r: Record<string, unknown>): CDTPRow {
  return {
    id: Number(r.id),
    code: String(r.codigo_documento ?? ""),
    filial: String(r.filial_nome ?? ""),
    nome: String(r.nome ?? ""),
    descricaoProduto: String(r.descricao_produto ?? ""),
    tempoMaxCongelamentoMinutos: Number(r.tempo_max_congelamento_minutos ?? 0),
  };
}

export async function getTiposProduto(): Promise<CDTPRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_LIST)
    .order("codigo_documento", { ascending: true });
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
  return (data || []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createTipoProduto(payload: {
  codigo_documento: number;
  filial_nome: string;
  nome: string;
  descricao_produto: string;
  tempo_max_congelamento_minutos: number;
}) {
  const codigo = Number(payload.codigo_documento);
  const mins = Math.max(0, Math.trunc(Number(payload.tempo_max_congelamento_minutos ?? 0)));
  assertFin("Código do documento", codigo);
  if (!Number.isInteger(codigo) || codigo < 1) throw new Error("Código do documento inválido.");

  const nome = String(payload.nome ?? "").trim().slice(0, NOME_MAX);
  const filial = String(payload.filial_nome ?? "").trim().slice(0, FILIAL_MAX);
  const desc = String(payload.descricao_produto ?? "").trim().slice(0, DESCR_MAX);
  if (!nome) throw new Error("Nome obrigatório.");
  if (!filial) throw new Error("Filial obrigatória.");

  const row = {
    codigo_documento: codigo,
    filial_nome: filial,
    nome,
    descricao_produto: desc || null,
    tempo_max_congelamento_minutos: mins,
  };

  const { error } = await supabase.from(TABLE).insert(row);
  if (error) {
    const u = hintUniqueCodigoPorFilial(error as { message?: string; code?: string });
    throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }) + u);
  }
}

export async function updateTipoProduto(
  id: number,
  payload: {
    codigo_documento?: number;
    filial_nome?: string;
    nome?: string;
    descricao_produto?: string;
    tempo_max_congelamento_minutos?: number;
  }
) {
  const body: Record<string, unknown> = {};
  if (payload.codigo_documento !== undefined) {
    const n = Number(payload.codigo_documento);
    assertFin("Código do documento", n);
    body.codigo_documento = n;
  }
  if (payload.filial_nome !== undefined) body.filial_nome = String(payload.filial_nome ?? "").trim().slice(0, FILIAL_MAX);
  if (payload.nome !== undefined) body.nome = String(payload.nome ?? "").trim().slice(0, NOME_MAX);
  if (payload.descricao_produto !== undefined) {
    const d = String(payload.descricao_produto ?? "").trim().slice(0, DESCR_MAX);
    body.descricao_produto = d || null;
  }
  if (payload.tempo_max_congelamento_minutos !== undefined) {
    body.tempo_max_congelamento_minutos = Math.max(0, Math.trunc(Number(payload.tempo_max_congelamento_minutos ?? 0)));
  }
  if (Object.keys(body).length === 0) return;

  const { error } = await supabase.from(TABLE).update(body).eq("id", Number(id));
  if (error) {
    const u = hintUniqueCodigoPorFilial(error as { message?: string; code?: string });
    throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }) + u);
  }
}

export async function deleteTipoProduto(id: number) {
  const { error } = await supabase.from(TABLE).delete().eq("id", Number(id));
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
}
