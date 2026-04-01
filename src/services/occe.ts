import { supabase } from "@/lib/supabase";

const TABLE = "OCCE";

const SELECT_LIST =
  "id, doc_entry, numero_documento, data_movimento, codigo_produto, descricao_item, unidade_medida, grupo_itens, lote, data_fabricacao, data_vencimento, diferenca_dias_fab_venc, status_validade, processo, quantidade, custo_unitario, valor_total, filial_nome, codigo_tunel, created_at, updated_at";

function fmtErr(e: { message?: string; details?: string; hint?: string; code?: string }): string {
  if (e.code === "42501") {
    return "Sem permissão para acessar controle de estoque. Verifique as políticas RLS da tabela OCCE.";
  }
  const parts = [e.message, e.details, e.hint, e.code ? `[${e.code}]` : ""].filter(Boolean);
  return parts.join(" - ") || "Erro na tabela OCCE.";
}

function mapRow(r: Record<string, unknown>): OCCERow {
  return {
    id: Number(r.id),
    docEntry: Number(r.doc_entry ?? 0),
    numeroDocumento: Number(r.numero_documento ?? 0),
    dataMovimento: r.data_movimento != null ? String(r.data_movimento).split("T")[0] : "",
    codigoProduto: String(r.codigo_produto ?? ""),
    descricaoItem: String(r.descricao_item ?? ""),
    unidadeMedida: String(r.unidade_medida ?? ""),
    grupoItens: String(r.grupo_itens ?? ""),
    lote: r.lote != null ? String(r.lote) : null,
    dataFabricacao: r.data_fabricacao != null ? String(r.data_fabricacao).split("T")[0] : null,
    dataVencimento: r.data_vencimento != null ? String(r.data_vencimento).split("T")[0] : null,
    diferencaDiasFabVenc: Number(r.diferenca_dias_fab_venc ?? 0),
    statusValidade: (r.status_validade === "Vencido" ? "Vencido" : "No prazo") as "No prazo" | "Vencido",
    processo: (r.processo === "saida" ? "saida" : "entrada") as "entrada" | "saida",
    quantidade: Number(r.quantidade ?? 0),
    custoUnitario: Number(r.custo_unitario ?? 0),
    valorTotal: Number(r.valor_total ?? 0),
    filialNome: String(r.filial_nome ?? ""),
    codigoTunel: Number(r.codigo_tunel ?? 0),
    createdAt: r.created_at != null ? String(r.created_at) : null,
    updatedAt: r.updated_at != null ? String(r.updated_at) : null,
  };
}

export interface OCCERow {
  id: number;
  docEntry: number;
  numeroDocumento: number;
  dataMovimento: string;
  codigoProduto: string;
  descricaoItem: string;
  unidadeMedida: string;
  grupoItens: string;
  lote: string | null;
  dataFabricacao: string | null;
  dataVencimento: string | null;
  diferencaDiasFabVenc: number;
  statusValidade: "No prazo" | "Vencido";
  processo: "entrada" | "saida";
  quantidade: number;
  custoUnitario: number;
  valorTotal: number;
  filialNome: string;
  codigoTunel: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function getControleEstoque(params?: {
  filialNome?: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<OCCERow[]> {
  let query = supabase.from(TABLE).select(SELECT_LIST).order("doc_entry", { ascending: false }).limit(2000);
  if (params?.filialNome) query = query.eq("filial_nome", params.filialNome);
  if (params?.dataInicio) query = query.gte("data_movimento", params.dataInicio);
  if (params?.dataFim) query = query.lte("data_movimento", params.dataFim);
  const { data, error } = await query;
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
  return (data || []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createControleEstoque(payload: {
  data_movimento: string;
  codigo_produto: string;
  descricao_item: string;
  unidade_medida: string;
  grupo_itens: string;
  lote?: string | null;
  data_fabricacao?: string | null;
  data_vencimento?: string | null;
  diferenca_dias_fab_venc: number;
  status_validade: "No prazo" | "Vencido";
  processo: "entrada" | "saida";
  quantidade: number;
  custo_unitario: number;
  valor_total: number;
  filial_nome: string;
  codigo_tunel: number;
}): Promise<OCCERow> {
  const row = {
    data_movimento: String(payload.data_movimento ?? "").split("T")[0],
    codigo_produto: String(payload.codigo_produto ?? "").trim(),
    descricao_item: String(payload.descricao_item ?? "").trim(),
    unidade_medida: String(payload.unidade_medida ?? "").trim(),
    grupo_itens: String(payload.grupo_itens ?? "").trim(),
    lote: payload.lote?.trim() ? payload.lote.trim() : null,
    data_fabricacao: payload.data_fabricacao ? String(payload.data_fabricacao).split("T")[0] : null,
    data_vencimento: payload.data_vencimento ? String(payload.data_vencimento).split("T")[0] : null,
    diferenca_dias_fab_venc: Math.trunc(Number(payload.diferenca_dias_fab_venc) || 0),
    status_validade: payload.status_validade,
    processo: payload.processo,
    quantidade: Number(payload.quantidade),
    custo_unitario: Number(payload.custo_unitario),
    valor_total: Number(payload.valor_total),
    filial_nome: String(payload.filial_nome ?? "").trim(),
    codigo_tunel: Math.trunc(Number(payload.codigo_tunel)),
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select(SELECT_LIST).single();
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
  return mapRow(data as Record<string, unknown>);
}

export async function updateControleEstoque(
  id: number,
  payload: {
    data_movimento: string;
    codigo_produto: string;
    descricao_item: string;
    unidade_medida: string;
    grupo_itens: string;
    lote?: string | null;
    data_fabricacao?: string | null;
    data_vencimento?: string | null;
    diferenca_dias_fab_venc: number;
    status_validade: "No prazo" | "Vencido";
    processo: "entrada" | "saida";
    quantidade: number;
    custo_unitario: number;
    valor_total: number;
    filial_nome: string;
    codigo_tunel: number;
  }
): Promise<OCCERow> {
  const row = {
    data_movimento: String(payload.data_movimento ?? "").split("T")[0],
    codigo_produto: String(payload.codigo_produto ?? "").trim(),
    descricao_item: String(payload.descricao_item ?? "").trim(),
    unidade_medida: String(payload.unidade_medida ?? "").trim(),
    grupo_itens: String(payload.grupo_itens ?? "").trim(),
    lote: payload.lote?.trim() ? payload.lote.trim() : null,
    data_fabricacao: payload.data_fabricacao ? String(payload.data_fabricacao).split("T")[0] : null,
    data_vencimento: payload.data_vencimento ? String(payload.data_vencimento).split("T")[0] : null,
    diferenca_dias_fab_venc: Math.trunc(Number(payload.diferenca_dias_fab_venc) || 0),
    status_validade: payload.status_validade,
    processo: payload.processo,
    quantidade: Number(payload.quantidade),
    custo_unitario: Number(payload.custo_unitario),
    valor_total: Number(payload.valor_total),
    filial_nome: String(payload.filial_nome ?? "").trim(),
    codigo_tunel: Math.trunc(Number(payload.codigo_tunel)),
  };
  const { data, error } = await supabase.from(TABLE).update(row).eq("id", Number(id)).select(SELECT_LIST).single();
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
  return mapRow(data as Record<string, unknown>);
}

export async function deleteControleEstoque(id: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", Number(id));
  if (error) throw new Error(fmtErr(error as { message?: string; details?: string; hint?: string; code?: string }));
}

/** Realtime na OCCE: habilite a tabela em Database → Replication (Supabase) se os eventos não chegarem. */
export function subscribeOCCERealtime(onChanges: () => void): () => void {
  const channel = supabase
    .channel("occe-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => {
      onChanges();
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
