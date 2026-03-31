import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Pencil, Plus, RefreshCw, Trash2, Package, Save, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getOCTEByDateRange,
  getNextOCTEDocumentCode,
  getFiliais,
  getOCTRFList,
  insertOCTE,
  updateOCTE,
  deleteOCTE,
  type OCTERow,
  type OCTEPayload,
  type OCTRFRow,
} from "@/services/supabaseData";
import { formatNumberPtBrFixed } from "@/lib/formatLocale";
import {
  committedToTwelve,
  QTY_SLOTS,
  formatRowQuantidadesColuna,
  parseTokenToNumber,
  payloadToCommitted,
  twelveToPayloadPatch,
} from "./octeQuantidadesHelpers";
import { newEmptyLine, OcteItemFieldsGrid, type OCTELineDraft } from "./EmpacotamentoLinhaBlock";
import { ColaboradorPickerField } from "./ColaboradorPickerField";
import { FuncaoPickerField } from "./FuncaoPickerField";
import { getOCTCList, type OCTCRow } from "@/services/octc";
import { useDocumentNav } from "@/contexts/DocumentNavContext";
import { FilialSelectField } from "@/components/FilialSelectField";

function fmtData(iso: string): string {
  const d = String(iso || "").split("T")[0];
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function formatDocListCell(codigo: string | null): string {
  if (!codigo) return "—";
  const t = codigo.trim();
  if (/^\d+$/.test(t) && t.length <= 12) return t;
  return t.length <= 12 ? t : `${t.slice(0, 8)}…`;
}

/** Um documento OCTE = mesma data + mesmo codigo_documento (linhas sem código ficam cada uma em grupo próprio). */
type OcteDocGroup = {
  data: string;
  codigoDocumento: string | null;
  rows: OCTERow[];
};

function groupOcteRowsByDocument(rows: OCTERow[]): OcteDocGroup[] {
  const map = new Map<string, OcteDocGroup>();
  for (const r of rows) {
    const data = r.data.split("T")[0];
    const codRaw = r.codigoDocumento != null ? String(r.codigoDocumento).trim() : "";
    const key = codRaw !== "" ? `${data}\0${codRaw}` : `${data}\0__row_${r.id}`;
    let g = map.get(key);
    if (!g) {
      g = { data, codigoDocumento: codRaw || null, rows: [] };
      map.set(key, g);
    }
    g.rows.push(r);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.data !== b.data) return b.data.localeCompare(a.data);
    const ca = a.codigoDocumento || "";
    const cb = b.codigoDocumento || "";
    if (ca !== cb) return ca.localeCompare(cb, undefined, { numeric: true });
    return Math.max(...b.rows.map((x) => x.id)) - Math.max(...a.rows.map((x) => x.id));
  });
}

function findOcteDocGroupIndex(
  groups: OcteDocGroup[],
  dataDocumento: string,
  codigoDocumento: string,
  formLines: OCTELineDraft[],
): number {
  const d = dataDocumento.split("T")[0];
  const c = codigoDocumento.trim();
  const formIds = formLines.map((l) => l.dbId).filter((x): x is number => x != null);
  if (formIds.length > 0) {
    const set = new Set(formIds);
    const idx = groups.findIndex((g) => g.rows.length === set.size && g.rows.every((r) => set.has(r.id)));
    if (idx >= 0) return idx;
  }
  return groups.findIndex((g) => g.data === d && (g.codigoDocumento || "").trim() === c);
}

function rowToPayload(r: OCTERow): OCTEPayload {
  return {
    data: r.data,
    codigoDocumento: r.codigoDocumento,
    filialNome: r.filialNome ?? "",
    codigoItem: r.codigoItem,
    descricaoItem: r.descricaoItem,
    unidadeItem: r.unidadeItem,
    peso: r.peso,
    colaborador: r.colaborador,
    quantidade1: r.quantidade1,
    quantidade2: r.quantidade2,
    quantidade3: r.quantidade3,
    quantidade4: r.quantidade4,
    quantidade5: r.quantidade5,
    quantidade6: r.quantidade6,
    quantidade7: r.quantidade7,
    quantidade8: r.quantidade8,
    quantidade9: r.quantidade9,
    quantidade10: r.quantidade10,
    quantidade11: r.quantidade11,
    quantidade12: r.quantidade12,
    funcaoColaborador: r.funcaoColaborador,
    meta: r.meta,
    horas: r.horas,
    observacoes: r.observacoes,
  };
}

function rowToLineDraft(r: OCTERow): OCTELineDraft {
  const payload = rowToPayload(r);
  return {
    localKey: crypto.randomUUID(),
    dbId: r.id,
    codigoItem: r.codigoItem,
    descricaoItem: r.descricaoItem ?? "",
    unidadeItem: r.unidadeItem ?? "",
    peso: r.peso,
    catalogResolved: false,
    colaborador: r.colaborador ?? "",
    committedQtys: payloadToCommitted(payload),
    draftQty: "",
    funcaoColaborador: r.funcaoColaborador ?? "",
    meta: r.meta,
    horas: r.horas,
    observacoes: r.observacoes ?? "",
  };
}

/** Controle de empacotamento (tabela OCTE) — sub-aba da Produção. */
export function ControleEmpacotamento() {
  const { toast } = useToast();
  const { setDocumentNav } = useDocumentNav();
  const hoje = new Date().toISOString().split("T")[0];
  /** Valores nos date pickers da listagem (ainda não aplicados até clicar em Atualizar). */
  const [filtroListaDe, setFiltroListaDe] = useState(hoje);
  const [filtroListaAte, setFiltroListaAte] = useState(hoje);
  const [filtroListaMesmaData, setFiltroListaMesmaData] = useState(false);
  /** Período efetivo da consulta na tabela. */
  const [listaDeAplicado, setListaDeAplicado] = useState(hoje);
  const [listaAteAplicado, setListaAteAplicado] = useState(hoje);
  const [filtroListaFilial, setFiltroListaFilial] = useState("");
  const [filtroListaFilialAplicado, setFiltroListaFilialAplicado] = useState("");
  const [rows, setRows] = useState<OCTERow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtrosListaOpen, setFiltrosListaOpen] = useState(false);

  const [codigoDocumento, setCodigoDocumento] = useState("0001");
  const [dataDocumento, setDataDocumento] = useState(hoje);
  /** Filial do documento (replicada em cada linha ao salvar). */
  const [filialNome, setFilialNome] = useState("");
  const [filiaisOctf, setFiliaisOctf] = useState<{ id: number; nome: string }[]>([]);
  const [filiaisOctfLoading, setFiliaisOctfLoading] = useState(true);
  const [lines, setLines] = useState<OCTELineDraft[]>(() => [newEmptyLine(crypto.randomUUID())]);
  const [qtyDraftByCell, setQtyDraftByCell] = useState<Record<string, string>>({});
  const [colaboradoresOctc, setColaboradoresOctc] = useState<OCTCRow[]>([]);
  const [colaboradoresOctcLoading, setColaboradoresOctcLoading] = useState(true);
  const [funcoesOctrf, setFuncoesOctrf] = useState<OCTRFRow[]>([]);
  const [funcoesOctrfLoading, setFuncoesOctrfLoading] = useState(true);

  const refreshCodigoNovoDocumento = useCallback(async () => {
    try {
      const next = await getNextOCTEDocumentCode();
      setCodigoDocumento(next);
    } catch {
      setCodigoDocumento("0001");
    }
  }, []);

  useEffect(() => {
    void refreshCodigoNovoDocumento();
  }, [refreshCodigoNovoDocumento]);

  useEffect(() => {
    let cancelled = false;
    setFiliaisOctfLoading(true);
    getFiliais()
      .then((list) => {
        if (!cancelled) setFiliaisOctf(list.map((f) => ({ id: f.id, nome: f.nome })));
      })
      .catch(() => {
        if (!cancelled) setFiliaisOctf([]);
      })
      .finally(() => {
        if (!cancelled) setFiliaisOctfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setColaboradoresOctcLoading(true);
    getOCTCList()
      .then((list) => {
        if (!cancelled) setColaboradoresOctc(list);
      })
      .catch(() => {
        if (!cancelled) setColaboradoresOctc([]);
      })
      .finally(() => {
        if (!cancelled) setColaboradoresOctcLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFuncoesOctrfLoading(true);
    getOCTRFList()
      .then((list) => {
        if (!cancelled) setFuncoesOctrf(list);
      })
      .catch(() => {
        if (!cancelled) setFuncoesOctrf([]);
      })
      .finally(() => {
        if (!cancelled) setFuncoesOctrfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchListaOCTE = useCallback(
    async (de: string, ate: string) => {
      const d0 = de.split("T")[0];
      const a0 = ate.split("T")[0];
      try {
        setLoading(true);
        const data = await getOCTEByDateRange(d0, a0);
        setRows(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Falha ao carregar OCTE.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void fetchListaOCTE(listaDeAplicado, listaAteAplicado);
  }, [listaDeAplicado, listaAteAplicado, fetchListaOCTE]);

  useEffect(() => {
    if (!filtrosListaOpen) return;
    setFiltroListaDe(listaDeAplicado.split("T")[0]);
    setFiltroListaAte(listaAteAplicado.split("T")[0]);
    setFiltroListaFilial(filtroListaFilialAplicado);
  }, [filtrosListaOpen, listaDeAplicado, listaAteAplicado, filtroListaFilialAplicado]);

  /** Recarrega a tabela com o período já aplicado (após salvar/excluir). */
  const refreshListaAplicada = useCallback(() => {
    return fetchListaOCTE(listaDeAplicado, listaAteAplicado);
  }, [fetchListaOCTE, listaDeAplicado, listaAteAplicado]);

  const aplicarPeriodoListagem = useCallback(() => {
    const d0 = filtroListaDe.split("T")[0];
    const a0 = filtroListaAte.split("T")[0];
    const filialPend = filtroListaFilial.trim();
    const aplicadoDe = listaDeAplicado.split("T")[0];
    const aplicadoAte = listaAteAplicado.split("T")[0];
    const mesmoPeriodoEFilial = d0 === aplicadoDe && a0 === aplicadoAte && filialPend === filtroListaFilialAplicado;
    if (mesmoPeriodoEFilial) {
      void fetchListaOCTE(d0, a0);
    } else {
      setListaDeAplicado(d0);
      setListaAteAplicado(a0);
      setFiltroListaFilialAplicado(filialPend);
    }
  }, [filtroListaDe, filtroListaAte, filtroListaFilial, filtroListaFilialAplicado, listaDeAplicado, listaAteAplicado, fetchListaOCTE]);

  const resetForm = useCallback(() => {
    setDataDocumento(new Date().toISOString().split("T")[0]);
    setFilialNome("");
    setLines([newEmptyLine(crypto.randomUUID())]);
    void refreshCodigoNovoDocumento();
  }, [refreshCodigoNovoDocumento]);

  const docGroups = useMemo(() => groupOcteRowsByDocument(rows), [rows]);
  const rowsFiltradasPorFilial = useMemo(() => {
    const filial = filtroListaFilialAplicado.trim().toLocaleLowerCase();
    if (!filial) return rows;
    return rows.filter((r) => (r.filialNome || "").trim().toLocaleLowerCase() === filial);
  }, [rows, filtroListaFilialAplicado]);
  const reportGroups = useMemo(() => {
    const map = new Map<string, { key: string; data: string; codigoDocumento: string | null; rows: OCTERow[] }>();
    for (const r of rowsFiltradasPorFilial) {
      const data = (r.data || "").split("T")[0];
      const cod = (r.codigoDocumento || "").trim() || null;
      const key = `${data}__${cod || "sem_doc"}`;
      const g = map.get(key);
      if (g) g.rows.push(r);
      else map.set(key, { key, data, codigoDocumento: cod, rows: [r] });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.data !== b.data) return b.data.localeCompare(a.data);
      return (a.codigoDocumento || "").localeCompare(b.codigoDocumento || "", undefined, { numeric: true });
    });
  }, [rowsFiltradasPorFilial]);
  const reportMaxQtySlot = useMemo(() => {
    let max = 1;
    for (const r of rowsFiltradasPorFilial) {
      const values = [
        r.quantidade1, r.quantidade2, r.quantidade3, r.quantidade4, r.quantidade5, r.quantidade6,
        r.quantidade7, r.quantidade8, r.quantidade9, r.quantidade10, r.quantidade11, r.quantidade12,
      ];
      for (let i = values.length - 1; i >= 0; i--) {
        if (Number(values[i] ?? 0) !== 0) {
          max = Math.max(max, i + 1);
          break;
        }
      }
    }
    return max;
  }, [rowsFiltradasPorFilial]);

  const loadOcteDocGroup = useCallback((g: OcteDocGroup) => {
    const sorted = [...g.rows].sort((a, b) => a.id - b.id);
    setCodigoDocumento((g.codigoDocumento ?? "").trim() || "");
    setDataDocumento(g.data);
    setFilialNome((sorted[0]?.filialNome ?? "").trim());
    const drafts = sorted.map(rowToLineDraft);
    const h = drafts[0];
    if (!h) {
      setLines([newEmptyLine(crypto.randomUUID())]);
      return;
    }
    const itemSync = {
      codigoItem: h.codigoItem,
      descricaoItem: h.descricaoItem,
      unidadeItem: h.unidadeItem,
      peso: h.peso,
      catalogResolved: h.catalogResolved,
    };
    setLines(drafts.map((l) => ({ ...l, ...itemSync })));
  }, []);

  const currentOcteDocIndex = useMemo(
    () => findOcteDocGroupIndex(docGroups, dataDocumento, codigoDocumento, lines),
    [docGroups, dataDocumento, codigoDocumento, lines],
  );

  useEffect(() => {
    const total = docGroups.length;
    const idx = currentOcteDocIndex;
    const showNav = total > 0;
    const isNew = idx < 0;
    setDocumentNav({
      showNav,
      // Em "Novo", permitir entrar na navegação existente (prev=último, next=primeiro).
      canGoPrev: showNav && (isNew || idx > 0),
      canGoNext: showNav && (isNew || idx < total - 1),
      onPrev: () => {
        if (isNew) {
          if (total > 0) loadOcteDocGroup(docGroups[total - 1]);
          return;
        }
        if (idx > 0) loadOcteDocGroup(docGroups[idx - 1]);
      },
      onNext: () => {
        if (isNew) {
          if (total > 0) loadOcteDocGroup(docGroups[0]);
          return;
        }
        if (idx >= 0 && idx < total - 1) loadOcteDocGroup(docGroups[idx + 1]);
      },
      onNewDocument: () => resetForm(),
      navLabel: showNav
        ? idx >= 0
          ? `${idx + 1} de ${total}`
          : total === 1
            ? "1 de 1"
            : `Novo · ${total} doc.`
        : undefined,
    });
    return () => setDocumentNav(null);
  }, [docGroups, currentOcteDocIndex, loadOcteDocGroup, resetForm, setDocumentNav]);

  const patchLine = (index: number, patch: Partial<OCTELineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const qtyCellKey = (lineIndex: number, slotIndex: number) => `${lineIndex}-${slotIndex}`;

  const patchLineQty = (lineIndex: number, slotIndex: number, raw: string) => {
    const token = String(raw).trim();
    const base = lines[lineIndex];
    if (!base) return;
    const next = Array.from({ length: QTY_SLOTS }, (_, i) => Number(base.committedQtys[i] ?? 0));
    if (token === "") {
      next[slotIndex] = 0;
    } else {
      const parsed = parseTokenToNumber(token);
      if (!Number.isFinite(parsed)) return;
      next[slotIndex] = parsed;
    }
    let end = QTY_SLOTS - 1;
    while (end >= 0 && next[end] === 0) end -= 1;
    patchLine(lineIndex, { committedQtys: end >= 0 ? next.slice(0, end + 1) : [] });
    const k = qtyCellKey(lineIndex, slotIndex);
    setQtyDraftByCell((prev) => {
      const out = { ...prev };
      if (token === "") {
        delete out[k];
      } else {
        out[k] = formatNumberPtBrFixed(next[slotIndex], 2);
      }
      return out;
    });
  };

  /** Item (código, descrição, unidade, peso) é único no cabeçalho e replica em todas as linhas. */
  const patchAllLinesItem = useCallback((patch: Partial<OCTELineDraft>) => {
    const keys = ["codigoItem", "descricaoItem", "unidadeItem", "peso", "catalogResolved"] as const;
    const p: Partial<OCTELineDraft> = {};
    for (const k of keys) {
      if (k in patch) (p as Record<string, unknown>)[k] = patch[k];
    }
    if (Object.keys(p).length === 0) return;
    setLines((prev) => prev.map((l) => ({ ...l, ...p })));
  }, []);

  const addLine = () => {
    setLines((prev) => {
      const ref = prev[0];
      const next = newEmptyLine(crypto.randomUUID());
      return [
        ...prev,
        {
          ...next,
          codigoItem: ref.codigoItem,
          descricaoItem: ref.descricaoItem,
          unidadeItem: ref.unidadeItem,
          peso: ref.peso,
          catalogResolved: ref.catalogResolved,
        },
      ];
    });
  };

  const removeLineAt = async (index: number) => {
    if (lines.length <= 1) {
      toast({ title: "Mínimo", description: "Mantenha ao menos um registro no formulário.", variant: "destructive" });
      return;
    }
    const line = lines[index];
    if (line.dbId != null) {
      if (!confirm("Este registro já está salvo. Excluir do banco de dados?")) return;
      try {
        await deleteOCTE(line.dbId);
        toast({ title: "Excluído", description: "Registro removido do banco." });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Falha ao excluir.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
        return;
      }
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
    await refreshListaAplicada();
  };

  const save = async () => {
    if (!filialNome.trim()) {
      toast({
        title: "Validação",
        description: "Selecione a filial antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    const filled = lines.filter((l) => l.codigoItem.trim());
    if (filled.length === 0) {
      toast({ title: "Validação", description: "Informe o código do item em ao menos uma linha.", variant: "destructive" });
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.codigoItem.trim()) continue;
      if (String(l.draftQty).trim() !== "") {
        toast({
          title: "Quantidade pendente",
          description: `Registro ${i + 1}: confirme a quantidade em aberto com "Adicionar quantidade" ou apague antes de salvar.`,
          variant: "destructive",
        });
        return;
      }
    }
    try {
      setSaving(true);
      const savedData = dataDocumento.split("T")[0];
      const savedCodigo = codigoDocumento.trim();
      for (const l of lines) {
        if (!l.codigoItem.trim()) continue;
        const twelve = committedToTwelve(l.committedQtys);
        const totalLinha = twelve.reduce((acc, n) => acc + Number(n || 0), 0);
        const qPatch = twelveToPayloadPatch(twelve);
        const payload: OCTEPayload = {
          data: dataDocumento.split("T")[0],
          codigoDocumento,
          filialNome: filialNome.trim(),
          codigoItem: l.codigoItem.trim(),
          descricaoItem: l.descricaoItem,
          unidadeItem: l.unidadeItem,
          peso: l.peso ?? 0,
          colaborador: l.colaborador,
          ...qPatch,
          total: totalLinha,
          funcaoColaborador: l.funcaoColaborador,
          meta: l.meta,
          horas: l.horas,
          observacoes: l.observacoes,
        };
        if (l.dbId != null) await updateOCTE(l.dbId, payload);
        else await insertOCTE(payload);
      }
      toast({
        title: "Salvo",
        description: `${filled.length} registro(s) gravado(s) no documento.`,
      });
      await refreshListaAplicada();
      try {
        const latestRows = await getOCTEByDateRange(listaDeAplicado, listaAteAplicado);
        const groups = groupOcteRowsByDocument(latestRows);
        const target =
          groups.find((g) => g.data === savedData && (g.codigoDocumento || "") === savedCodigo) ??
          groups.find((g) => g.data === savedData) ??
          null;
        if (target) {
          loadOcteDocGroup(target);
        }
      } catch {
        // Se falhar o reload direcionado, mantém dados atuais e apenas lista atualizada.
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao salvar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (id: number) => {
    if (!confirm("Excluir este registro de empacotamento?")) return;
    try {
      await deleteOCTE(id);
      toast({ title: "Excluído", description: "Registro removido." });
      const stillEditing = lines.some((l) => l.dbId === id);
      if (stillEditing) resetForm();
      await refreshListaAplicada();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao excluir.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const isEditMode = lines.some((l) => l.dbId != null);

  const aplicarFiltrosListaEfechar = () => {
    aplicarPeriodoListagem();
    setFiltrosListaOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card
        className={`relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${
          isEditMode ? "ring-1 ring-primary/20" : ""
        }`}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />
        <div className="relative z-10">
          <CardHeader className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30">
                  <Package className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-xl sm:text-2xl font-bold">Controle de Empacotamento</CardTitle>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:items-center">
                <Dialog open={filtrosListaOpen} onOpenChange={setFiltrosListaOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-2.5 text-xs sm:text-sm font-medium border border-input bg-background hover:bg-muted/50 w-full sm:w-auto"
                      aria-label="Abrir filtros da listagem"
                      aria-haspopup="dialog"
                      aria-expanded={filtrosListaOpen}
                    >
                      <Filter className="h-4 w-4 shrink-0" />
                      <span>Filtros</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="w-[340px] sm:w-[420px] max-w-[95vw] p-4 rounded-lg">
                    <DialogHeader>
                      <DialogTitle className="text-base">Filtros — Relatório do Empacotamento</DialogTitle>
                      <DialogDescription className="text-sm text-muted-foreground">
                        Defina período e filial para filtrar o relatório do empacotamento abaixo.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                      <div className="space-y-1.5">
                        <Label>Data inicial</Label>
                        <DatePicker
                          value={filtroListaDe}
                          onChange={(v) => {
                            if (!v) return;
                            setFiltroListaDe(v);
                            if (filtroListaMesmaData) setFiltroListaAte(v);
                          }}
                          placeholder="Data inicial"
                          className="w-full"
                          triggerClassName="h-9 w-full rounded-md border border-input bg-background px-2 text-sm justify-start"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="empacotamento-filtro-mesma-data"
                          checked={filtroListaMesmaData}
                          onCheckedChange={(checked) => {
                            const value = Boolean(checked);
                            setFiltroListaMesmaData(value);
                            if (value && filtroListaDe) setFiltroListaAte(filtroListaDe);
                          }}
                        />
                        <Label htmlFor="empacotamento-filtro-mesma-data" className="text-xs text-muted-foreground cursor-pointer">
                          Mesma data
                        </Label>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Data final</Label>
                        <DatePicker
                          value={filtroListaAte}
                          onChange={(v) => {
                            if (!v) return;
                            setFiltroListaAte(v);
                            if (filtroListaMesmaData) setFiltroListaDe(v);
                          }}
                          placeholder="Data final"
                          className="w-full"
                          triggerClassName="h-9 w-full rounded-md border border-input bg-background px-2 text-sm justify-start"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Filial</Label>
                        <Select
                          value={filtroListaFilial || "__todas__"}
                          onValueChange={(v) => setFiltroListaFilial(v === "__todas__" ? "" : v)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Todas as filiais" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__todas__">Todas as filiais</SelectItem>
                            {filiaisOctf.map((f) => (
                              <SelectItem key={f.id} value={(f.nome || "").trim()}>
                                {(f.nome || "").trim()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-9"
                        onClick={() => {
                          const h = new Date().toISOString().split("T")[0];
                          setFiltroListaDe(h);
                          setFiltroListaAte(h);
                          setFiltroListaMesmaData(false);
                          setFiltroListaFilial("");
                          setFiltroListaFilialAplicado("");
                        }}
                      >
                        Limpar
                      </Button>
                      <Button
                        type="button"
                        className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                        onClick={() => void aplicarFiltrosListaEfechar()}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Filtrar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors w-full sm:w-auto"
                  title="Novo documento"
                  aria-label="Novo documento"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Novo documento</span>
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                  title="Salvar no banco de dados"
                  aria-label="Salvar no banco de dados"
                >
                  {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
                  <span>{saving ? "Salvando..." : "Salvar"}</span>
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-4 sm:p-6">
            <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{isEditMode ? "Editando empacotamento" : "Novo empacotamento"}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 justify-items-stretch max-w-5xl mx-auto lg:mx-0">
                <div className="space-y-1.5 w-full sm:max-w-[220px] sm:justify-self-center lg:justify-self-start">
                  <Label className="text-xs sm:text-sm">Código do documento</Label>
                  <Input
                    readOnly
                    value={codigoDocumento}
                    className="h-9 font-mono text-xs sm:text-sm bg-muted tabular-nums cursor-default"
                    title="Gerado automaticamente (0001, 0002, …). Todos os registros salvos juntos compartilham este código."
                    aria-readonly
                  />
                </div>
                <div className="space-y-1.5 w-full sm:max-w-[220px] sm:justify-self-center lg:justify-self-start">
                  <Label className="text-xs sm:text-sm">Data</Label>
                  <DatePicker
                    value={dataDocumento}
                    onChange={(v) => v && setDataDocumento(v.split("T")[0])}
                    triggerClassName="h-9 w-full"
                  />
                  <p className="text-[11px] text-muted-foreground pt-0.5">Válida para todos os registros deste documento.</p>
                </div>
                <div className="w-full sm:max-w-[220px] sm:justify-self-center lg:justify-self-start">
                  <FilialSelectField
                    id="octe-filial"
                    label="Filial"
                    value={filialNome}
                    onChange={setFilialNome}
                    filiais={filiaisOctf}
                    loading={filiaisOctfLoading}
                    hint="Válida para todos os registros deste documento. Lista da OCTF (mesmo padrão das outras telas)."
                  />
                </div>
                <div className="space-y-1.5 w-full sm:max-w-[220px] sm:justify-self-center lg:justify-self-start">
                  <Label className="text-xs sm:text-sm">Registros no formulário</Label>
                  <Input
                    readOnly
                    value={String(lines.length)}
                    className="h-9 bg-muted font-mono tabular-nums cursor-default"
                    title="Quantidade de registros no cadastro atual"
                  />
                </div>
              </div>
              <div className="border-t border-border/50 pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Item do documento</p>
                <OcteItemFieldsGrid line={lines[0]} onPatch={patchAllLinesItem} />
                <p className="text-[11px] text-muted-foreground">
                  Código, descrição, unidade e peso valem para <span className="font-medium text-foreground/80">todos</span> os registros abaixo.
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-card/40 overflow-x-auto">
                <div className="p-2 sm:p-3 border-b border-border/40 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="outline" size="sm" className="h-9 w-full sm:w-auto" onClick={() => resetForm()} disabled={saving}>
                    Limpar formulário
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
                    onClick={addLine}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar linha
                  </Button>
                </div>
                <div className="px-2 sm:px-3 pb-3 pt-2 space-y-2">
                  <div className="rounded-md border border-border/50 bg-background/40 overflow-x-auto overscroll-x-contain">
                    <Table className="min-w-[1700px]">
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-12 text-center">N°</TableHead>
                          <TableHead className="min-w-[180px]">Colaborador</TableHead>
                          <TableHead className="min-w-[180px]">Função</TableHead>
                          {Array.from({ length: QTY_SLOTS }, (_, i) => (
                            <TableHead key={`qh-${i}`} className="min-w-[82px] text-center">{`Q${i + 1}`}</TableHead>
                          ))}
                          <TableHead className="min-w-[88px] text-right">Total</TableHead>
                          <TableHead className="min-w-[118px]">Peso (kg)</TableHead>
                          <TableHead className="min-w-[120px]">Meta</TableHead>
                          <TableHead className="min-w-[120px]">Horas</TableHead>
                          <TableHead className="min-w-[180px]">Observações</TableHead>
                          <TableHead className="w-[66px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line, index) => {
                          const rowTotal = line.committedQtys.reduce((acc, n) => acc + Number(n || 0), 0);
                          return (
                            <TableRow key={line.localKey}>
                              <TableCell className="text-center font-medium">{index + 1}</TableCell>
                              <TableCell>
                                <ColaboradorPickerField
                                  label=""
                                  value={line.colaborador}
                                  onChange={(v) => patchLine(index, { colaborador: v })}
                                  colaboradores={colaboradoresOctc}
                                  loading={colaboradoresOctcLoading}
                                  className="w-[170px]"
                                  aria-label={`Colaborador linha ${index + 1}`}
                                />
                              </TableCell>
                              <TableCell>
                                <FuncaoPickerField
                                  label=""
                                  value={line.funcaoColaborador}
                                  onChange={(v) => patchLine(index, { funcaoColaborador: v })}
                                  funcoes={funcoesOctrf}
                                  loading={funcoesOctrfLoading}
                                  className="w-[170px]"
                                  aria-label={`Função linha ${index + 1}`}
                                />
                              </TableCell>
                              {Array.from({ length: QTY_SLOTS }, (_, slotIndex) => {
                                const k = qtyCellKey(index, slotIndex);
                                const live = qtyDraftByCell[k];
                                const committed = Number(line.committedQtys[slotIndex] ?? 0);
                                const value = live != null ? live : committed === 0 ? "" : formatNumberPtBrFixed(committed, 2);
                                return (
                                  <TableCell key={`qc-${slotIndex}`} className="p-2">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      className="h-8 w-[74px] text-xs px-2 text-center font-mono tabular-nums"
                                      value={value}
                                      placeholder="0,00"
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        setQtyDraftByCell((prev) => ({ ...prev, [k]: raw }));
                                      }}
                                      onBlur={(e) => patchLineQty(index, slotIndex, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          patchLineQty(index, slotIndex, (e.target as HTMLInputElement).value);
                                        }
                                      }}
                                      aria-label={`Q${slotIndex + 1} linha ${index + 1}`}
                                    />
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right font-semibold tabular-nums">{formatNumberPtBrFixed(rowTotal, 2)}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.0001"
                                  min={0}
                                  className="h-8 w-[104px] text-xs font-mono tabular-nums"
                                  value={line.peso ?? ""}
                                  onChange={(e) => patchLine(index, { peso: e.target.value === "" ? null : Number(e.target.value) })}
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-8 w-[110px] text-xs tabular-nums"
                                  value={line.meta ?? ""}
                                  onChange={(e) => patchLine(index, { meta: e.target.value === "" ? null : Number(e.target.value) })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-8 w-[110px] text-xs tabular-nums"
                                  value={line.horas ?? ""}
                                  onChange={(e) => patchLine(index, { horas: e.target.value === "" ? null : Number(e.target.value) })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="h-8 text-xs"
                                  value={line.observacoes}
                                  onChange={(e) => patchLine(index, { observacoes: e.target.value })}
                                  placeholder="Observações"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => void removeLineAt(index)}
                                  disabled={!lines.length || lines.length <= 1}
                                  aria-label={`Excluir linha ${index + 1}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold whitespace-nowrap">Relatório do Empacotamento</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Data: {fmtData(listaDeAplicado)} — {fmtData(listaAteAplicado)}
                    {filtroListaFilialAplicado.trim() ? ` • Filial: ${filtroListaFilialAplicado.trim()}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full sm:w-auto gap-2"
                  onClick={() => setFiltrosListaOpen(true)}
                >
                  <Filter className="h-4 w-4" />
                  Filtros
                </Button>
              </div>
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
              ) : reportGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum registro para o período selecionado.</p>
              ) : (
                <div className="space-y-4">
                  {reportGroups.map((group) => (
                    <div key={group.key} className="rounded-lg border border-border/50 bg-card/40 p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold whitespace-nowrap">Doc.: {group.codigoDocumento || "—"}</span>
                        <span className="text-muted-foreground whitespace-nowrap">Data: {fmtData(group.data)}</span>
                        <span className="text-muted-foreground whitespace-nowrap">Registros: {group.rows.length}</span>
                      </div>
                      <div className="overflow-x-auto rounded-md border border-border/50">
                        <Table className="min-w-[1500px]">
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="whitespace-nowrap">Data</TableHead>
                              <TableHead className="whitespace-nowrap">Código do Item</TableHead>
                              <TableHead className="min-w-[220px] whitespace-nowrap">Descrição do item</TableHead>
                              <TableHead className="whitespace-nowrap">Unidade</TableHead>
                              <TableHead className="whitespace-nowrap">Colaborador</TableHead>
                              {Array.from({ length: reportMaxQtySlot }, (_, i) => (
                                <TableHead key={`rq-${group.key}-${i}`} className="text-right">{`Q${i + 1}`}</TableHead>
                              ))}
                              <TableHead className="whitespace-nowrap">Função</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Peso (Kg)</TableHead>
                              <TableHead className="text-right whitespace-nowrap">T. KG</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Meta</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Meta Kg</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Horas</TableHead>
                              <TableHead className="text-right whitespace-nowrap">P. Horas. Final</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Eficiência</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.rows.map((r) => {
                              const qtyValues = [
                                r.quantidade1, r.quantidade2, r.quantidade3, r.quantidade4, r.quantidade5, r.quantidade6,
                                r.quantidade7, r.quantidade8, r.quantidade9, r.quantidade10, r.quantidade11, r.quantidade12,
                              ];
                              const metaKg = r.meta != null ? Number(r.meta) * Number(r.peso ?? 0) : null;
                              return (
                                <TableRow key={`rel-row-${r.id}`}>
                                  <TableCell className="whitespace-nowrap">{fmtData(r.data)}</TableCell>
                                  <TableCell className="font-mono whitespace-nowrap">{r.codigoItem || "—"}</TableCell>
                                  <TableCell className="max-w-[260px] truncate" title={r.descricaoItem || undefined}>{r.descricaoItem || "—"}</TableCell>
                                  <TableCell className="whitespace-nowrap">{r.unidadeItem || "—"}</TableCell>
                                  <TableCell className="max-w-[180px] truncate whitespace-nowrap" title={r.colaborador || undefined}>{r.colaborador || "—"}</TableCell>
                                  {Array.from({ length: reportMaxQtySlot }, (_, i) => (
                                    <TableCell key={`rqv-${r.id}-${i}`} className="text-right tabular-nums">
                                      {formatNumberPtBrFixed(Number(qtyValues[i] ?? 0), 2)}
                                    </TableCell>
                                  ))}
                                  <TableCell className="max-w-[160px] truncate whitespace-nowrap" title={r.funcaoColaborador || undefined}>{r.funcaoColaborador || "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{r.total != null ? formatNumberPtBrFixed(r.total, 2) : "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumberPtBrFixed(r.peso, 4)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{r.tKg != null ? formatNumberPtBrFixed(r.tKg, 2) : "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{r.meta != null ? formatNumberPtBrFixed(r.meta, 2) : "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{metaKg != null ? formatNumberPtBrFixed(metaKg, 2) : "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{r.horas != null ? formatNumberPtBrFixed(r.horas, 2) : "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{r.pHorasFinal != null ? formatNumberPtBrFixed(r.pHorasFinal, 4) : "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{r.eficiencia != null ? `${formatNumberPtBrFixed(r.eficiencia, 2)}%` : "—"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </CardContent>
        </div>
      </Card>
    </div>
  );
}
