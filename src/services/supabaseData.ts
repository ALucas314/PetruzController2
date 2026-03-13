/**
 * Acesso direto ao Supabase a partir do frontend (sem backend Node).
 * Requer RLS habilitado e políticas para usuários autenticados.
 */

import { supabase } from "@/lib/supabase";

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

export async function getItemByCode(code: string) {
  const rawCode = (code || "").trim();
  if (!rawCode) return null;
  const normalized = rawCode.replace(/^0+/, "") || rawCode;
  const codes = Array.from(new Set([rawCode, normalized]));
  const { data, error } = await supabase
    .from("OCTI")
    .select('id, line_id, "Code", "Name", "U_Uom", "U_ItemGroup"')
    .in("Code", codes)
    .order("Code")
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return octiRowToItem(data[0] as Record<string, unknown>);
}

// --- Dashboard ---
export async function getDashboardStats(params: { dataInicio: string; dataFim: string; filialNome?: string }) {
  let query = supabase
    .from("OCPD")
    .select("qtd_planejada, qtd_realizada, diferenca, percentual_meta, data_dia")
    .gte("data_dia", params.dataInicio)
    .lte("data_dia", params.dataFim);
  if (params.filialNome) query = query.eq("filial_nome", params.filialNome);
  const { data, error } = await query;
  if (error) throw error;
  const totalPlanejado = (data || []).reduce((s, i) => s + parseFloat(String(i.qtd_planejada || 0)), 0);
  const totalRealizado = (data || []).reduce((s, i) => s + parseFloat(String(i.qtd_realizada || 0)), 0);
  const diferenca = totalPlanejado - totalRealizado;
  const percentuais = (data || []).map((i) => parseFloat(String(i.percentual_meta || 0))).filter((p) => p > 0);
  const percentualMeta = percentuais.length > 0 ? percentuais.reduce((a, b) => a + b, 0) / percentuais.length : 0;
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

// --- Produção (OCPD) load ---
/** docId: quando informado, carrega só as linhas desse documento. Quando null/undefined, carrega documento "legado" (doc_id IS NULL) para a data+filial. */
export async function loadProducao(params: { data?: string; filialNome?: string; docId?: string | null }) {
  const hoje = new Date().toISOString().split("T")[0];
  const dataDia = params.data || hoje;
  let query = supabase.from("OCPD").select("*").order("id", { ascending: true }).eq("data_dia", dataDia);
  if (params.filialNome) query = query.eq("filial_nome", params.filialNome);
  if (params.docId != null && params.docId !== "") {
    query = query.eq("doc_id", params.docId);
  } else {
    query = query.is("doc_id", null);
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
  return { data: rows, count: rows.length, reprocessos };
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
  const totalReprocesso = (reprocessos || []).reduce((s, r) => s + parseFloat(String(r.quantidade ?? 0)), 0);
  const pct = items.length ? (items.reduce((s, i) => s + parseFloat(String(i.quantidadeRealizada ?? i.qtd_realizada ?? 0)), 0) / (items.reduce((s, i) => s + parseFloat(String(i.quantidadePlanejada ?? i.qtd_planejada ?? 0)), 0) || 1)) * 100 : parseFloat(String(pctMeta));
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
    const horaFinalTimestamp = toTimestamp(dataDiaItem, horaFinalRaw);
    const row: Record<string, unknown> = {
    data_dia: dataDiaItem,
    filial_nome: filialNome || null,
    doc_id: docId && docId.trim() !== "" ? docId.trim() : null,
    line_id: lineId,
    op: item.op ?? null,
    codigo_item: item.codigoItem ?? item.codigo ?? null,
    descricao_item: item.descricaoItem ?? item.descricao ?? null,
    linha: item.linha ?? null,
    qtd_planejada: parseFloat(String(item.quantidadePlanejada ?? item.qtd_planejada ?? 0)),
    qtd_realizada: parseFloat(String(item.quantidadeRealizada ?? item.qtd_realizada ?? 0)),
    diferenca: parseFloat(String(item.diferenca ?? 0)),
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
      const { data: insertedData, error: inErr } = await supabase.from("OCPD").insert(row).select("id").single();
      if (inErr) throw inErr;
      inserted++;
      if (insertedData?.id) insertedRows.push({ id: insertedData.id as number });
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

// --- Histórico produção ---
export async function getProducaoHistory(params: {
  limit?: number;
  dataInicio?: string;
  dataFim?: string;
  linha?: string;
  filialNome?: string;
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
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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

/** Insere itens na OCTI (Code, Name, U_Uom, U_ItemGroup). Retorna inserted e total. */
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
  const rows = toInsert.map((i) => ({
    Code: i.codigo_item,
    Name: i.nome_item,
    U_Uom: i.unidade_medida || null,
    U_ItemGroup: i.grupo_itens || null,
  }));
  const { data, error } = await supabase.from("OCTI").insert(rows).select();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { success: true, inserted: 0, total: valid.length, skipped: valid.length };
    }
    throw error;
  }
  const inserted = data?.length ?? 0;
  return {
    success: true,
    inserted,
    total: valid.length,
    skipped: valid.length - inserted,
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

/** Busca registros OCTP vinculados a um documento específico (data + filial) e à data de início. */
export async function getOCTPByInicio(
  inicio: string,
  dataDia?: string,
  filialNome?: string
): Promise<OCTPRow[]> {
  // select("*") para funcionar mesmo se as colunas hora_inicio/hora_final ainda não existirem (antes da migration)
  let query = supabase
    .from("OCTP")
    .select("*")
    .eq("inicio", inicio);

  if (dataDia) {
    query = query.eq("data_dia", dataDia);
  }
  if (filialNome) {
    query = query.eq("filial_nome", filialNome);
  }

  const { data, error } = await query.order("numero", { ascending: true });
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
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
  }));
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
  const r = data as Record<string, unknown>;
  return {
    id: Number(r.id),
    numero: Number(r.numero ?? 0),
    problema: r.problema != null ? String(r.problema) : null,
    acao: r.acao != null ? String(r.acao) : null,
    responsavel: r.responsavel != null ? String(r.responsavel) : null,
    hora: r.hora != null ? String(r.hora) : null,
    inicio: r.inicio != null ? String(r.inicio) : null,
    hora_inicio: (r.hora_inicio != null ? String(r.hora_inicio).slice(0, 8) : null) as string | null,
    hora_final: (r.hora_fim != null ? String(r.hora_fim).slice(0, 8) : null) as string | null,
    duracao_minutos: r.duracao_minutos != null ? Number(r.duracao_minutos) : null,
    descricao_status: r.descricao_status != null ? String(r.descricao_status) : null,
    created_at: r.created_at != null ? String(r.created_at) : undefined,
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
  };
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
