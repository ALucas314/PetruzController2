import { supabase } from "@/lib/supabase";

const TABLE = "OCMT";

const SELECT_LIST =
  "id, doc_entry, numero_documento, filial_nome, codigo_tunel, codigo_tipo_produto, qtd_inserida, data_fechamento, hora_fechamento, data_abertura, hora_abertura, observacao, created_at, updated_at";

function fmtErr(e: { message?: string; details?: string; hint?: string; code?: string }): string {
  if (e.code === "42501") {
    return "Sem permissão para acessar movimentações de túneis. Verifique as políticas RLS da tabela.";
  }
  const parts = [e.message, e.details, e.hint, e.code ? `[${e.code}]` : ""].filter(Boolean);
  return parts.join(" - ") || "Erro na tabela OCMT.";
}

function mapRow(r: Record<string, unknown>): OCMTRow {
  return {
    id: Number(r.id),
    docEntry: Number(r.doc_entry ?? 0),
    numeroDocumento: Number(r.numero_documento ?? 0),
    filialNome: String(r.filial_nome ?? ""),
    codigoTunel: Number(r.codigo_tunel ?? 0),
    codigoTipoProduto: Number(r.codigo_tipo_produto ?? 0),
    qtdInserida: Number(r.qtd_inserida ?? 0),
    dataFechamento: r.data_fechamento != null ? String(r.data_fechamento).split("T")[0] : null,
    horaFechamento: r.hora_fechamento != null ? String(r.hora_fechamento).slice(0, 8) : null,
    dataAbertura: r.data_abertura != null ? String(r.data_abertura).split("T")[0] : null,
    horaAbertura: r.hora_abertura != null ? String(r.hora_abertura).slice(0, 8) : null,
    observacao: r.observacao != null ? String(r.observacao) : null,
    createdAt: r.created_at != null ? String(r.created_at) : null,
    updatedAt: r.updated_at != null ? String(r.updated_at) : null,
  };
}

export interface OCMTRow {
  id: number;
  docEntry: number;
  numeroDocumento: number;
  filialNome: string;
  codigoTunel: number;
  codigoTipoProduto: number;
  qtdInserida: number;
  dataFechamento: string | null;
  horaFechamento: string | null;
  dataAbertura: string | null;
  horaAbertura: string | null;
  observacao: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function getMovimentacoesTuneis(params?: {
  filialNome?: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<OCMTRow[]> {
  let query = supabase.from(TABLE).select(SELECT_LIST).order("doc_entry", { ascending: false }).limit(1000);
  if (params?.filialNome) query = query.eq("filial_nome", params.filialNome);
  if (params?.dataInicio) query = query.gte("data_fechamento", params.dataInicio);
  if (params?.dataFim) query = query.lte("data_fechamento", params.dataFim);
  const { data, error } = await query;
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
  return (data || []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createMovimentacaoTunel(payload: {
  filial_nome: string;
  codigo_tunel: number;
  codigo_tipo_produto: number;
  qtd_inserida: number;
  data_abertura?: string | null;
  hora_abertura?: string | null;
  data_fechamento?: string | null;
  hora_fechamento?: string | null;
  observacao?: string | null;
}): Promise<OCMTRow> {
  const row = {
    filial_nome: String(payload.filial_nome ?? "").trim(),
    codigo_tunel: Number(payload.codigo_tunel ?? 0),
    codigo_tipo_produto: Number(payload.codigo_tipo_produto ?? 0),
    qtd_inserida: Number(payload.qtd_inserida ?? 0),
    data_abertura: payload.data_abertura ? String(payload.data_abertura).split("T")[0] : null,
    hora_abertura: payload.hora_abertura ? String(payload.hora_abertura).slice(0, 8) : null,
    data_fechamento: payload.data_fechamento ? String(payload.data_fechamento).split("T")[0] : null,
    hora_fechamento: payload.hora_fechamento ? String(payload.hora_fechamento).slice(0, 8) : null,
    observacao: payload.observacao?.trim() ? payload.observacao.trim() : null,
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select(SELECT_LIST).single();
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
  return mapRow(data as Record<string, unknown>);
}

export async function updateMovimentacaoTunel(
  id: number,
  payload: Partial<{
    filial_nome: string;
    codigo_tunel: number;
    codigo_tipo_produto: number;
    qtd_inserida: number;
    data_abertura: string | null;
    hora_abertura: string | null;
    data_fechamento: string | null;
    hora_fechamento: string | null;
    observacao: string | null;
  }>
): Promise<OCMTRow> {
  const body: Record<string, unknown> = {};
  if (payload.filial_nome !== undefined) body.filial_nome = String(payload.filial_nome ?? "").trim();
  if (payload.codigo_tunel !== undefined) body.codigo_tunel = Number(payload.codigo_tunel ?? 0);
  if (payload.codigo_tipo_produto !== undefined) body.codigo_tipo_produto = Number(payload.codigo_tipo_produto ?? 0);
  if (payload.qtd_inserida !== undefined) body.qtd_inserida = Number(payload.qtd_inserida ?? 0);
  if (payload.data_abertura !== undefined)
    body.data_abertura = payload.data_abertura ? String(payload.data_abertura).split("T")[0] : null;
  if (payload.hora_abertura !== undefined)
    body.hora_abertura = payload.hora_abertura ? String(payload.hora_abertura).slice(0, 8) : null;
  if (payload.data_fechamento !== undefined)
    body.data_fechamento = payload.data_fechamento ? String(payload.data_fechamento).split("T")[0] : null;
  if (payload.hora_fechamento !== undefined)
    body.hora_fechamento = payload.hora_fechamento ? String(payload.hora_fechamento).slice(0, 8) : null;
  if (payload.observacao !== undefined) body.observacao = payload.observacao?.trim() ? payload.observacao.trim() : null;
  const { data, error } = await supabase.from(TABLE).update(body).eq("id", Number(id)).select(SELECT_LIST).single();
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
  return mapRow(data as Record<string, unknown>);
}

export async function deleteMovimentacaoTunel(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", Number(id));
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
}

/** Realtime na OCMT: habilite a tabela em Database → Replication (Supabase) se os eventos não chegarem. */
export function subscribeOCMTRealtime(onChanges: () => void): () => void {
  const channel = supabase
    .channel("ocmt-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => {
      onChanges();
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
