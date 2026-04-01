import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, ArrowDownToLine, ArrowUpFromLine, ChartPie, Loader2, Package, Plus, Scale, Trash2 } from "lucide-react";
import { EntradaSaidaPieChart } from "@/components/controle-estoque/EntradaSaidaPieChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ExportToPng } from "@/components/ExportToPng";
import { useToast } from "@/hooks/use-toast";
import { useDocumentNav } from "@/contexts/DocumentNavContext";
import { formatNumberPtBrFixed } from "@/lib/formatLocale";
import { cn } from "@/lib/utils";
import {
  createControleEstoque,
  updateControleEstoque,
  deleteControleEstoque,
  getControleEstoque,
  getFiliais,
  getItemByCode,
  getTuneis,
  parseBrazilNumber,
  REALTIME_COLLAPSE_MS,
  REALTIME_SUPPRESS_OWN_WRITE_MS,
  subscribeOCCERealtime,
  type OCTTRow,
  type OCCERow,
} from "@/services/supabaseData";

type ProcessoTipo = "entrada" | "saida";
type FilialOption = { id: number; codigo: string; nome: string; endereco: string };

type RowComSaldo = OCCERow & { saldo: number };

type FormState = {
  data: string;
  codigoProduto: string;
  descricaoItem: string;
  unidadeMedida: string;
  grupoItens: string;
  lote: string;
  dataFabricacao: string;
  dataVencimento: string;
  processo: ProcessoTipo;
  quantidade: string;
  filial: string;
  codigoTunel: string;
  custo: string;
  /** Saída: saldo disponível do lote no endereço (filial+túnel+código) — só exibição. */
  saldoLote: string;
};

function daysBetween(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const a = new Date(`${startIso}T00:00:00`);
  const b = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0] || "";
}

const CODE_LOOKUP_DEBOUNCE_MS = 450;

/** Permite digitar números no padrão BR: vírgula decimal e, antes dela, pontos de milhar. */
function sanitizeBrDecimalInput(raw: string): string {
  const s = raw.replace(/[^\d.,]/g, "");
  const firstComma = s.indexOf(",");
  if (firstComma === -1) return s;
  const head = s.slice(0, firstComma).replace(/,/g, "");
  const tail = s.slice(firstComma + 1).replace(/[.,]/g, "");
  return head + "," + tail;
}

function formatOcceDecimalTwoPlaces(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return formatNumberPtBrFixed(parseBrazilNumber(t), 2);
}

function emptyForm(): FormState {
  return {
    data: todayIso(),
    codigoProduto: "",
    descricaoItem: "",
    unidadeMedida: "",
    grupoItens: "",
    lote: "",
    dataFabricacao: "",
    dataVencimento: "",
    processo: "entrada",
    quantidade: "",
    filial: "",
    codigoTunel: "",
    custo: "",
    saldoLote: "",
  };
}

/** Saldo acumulado por código de produto na ordem cronológica de doc_entry. */
function rowsComSaldo(rows: OCCERow[]): RowComSaldo[] {
  const chronological = [...rows].sort((a, b) => a.docEntry - b.docEntry);
  const acc = new Map<string, number>();
  const out: RowComSaldo[] = [];
  for (const r of chronological) {
    const key = r.codigoProduto;
    const prev = acc.get(key) ?? 0;
    const delta = r.processo === "entrada" ? r.quantidade : -r.quantidade;
    const saldo = prev + delta;
    acc.set(key, saldo);
    out.push({ ...r, saldo });
  }
  return out.sort((a, b) => b.docEntry - a.docEntry);
}

type LoteSaidaOption = {
  lote: string;
  saldo: number;
  dataFabricacao: string;
  dataVencimento: string;
  filialNome: string;
  codigoTunel: number;
  /** Custo unitário da entrada que cadastrou o lote neste endereço. */
  custoUnitarioEntrada: number;
};

function binKey(filialNome: string, tun: number, lote: string): string {
  return JSON.stringify([filialNome, tun, lote]);
}

function loteSaidaOptionKey(o: LoteSaidaOption): string {
  return JSON.stringify({ f: o.filialNome, t: o.codigoTunel, l: o.lote });
}

/** Saldo por produto + filial + túnel + lote (apenas movimentos com lote informado). */
function saldoPorLoteMap(rows: OCCERow[], omitRowId?: number | null): Map<string, number> {
  const chronological = [...rows]
    .filter((r) => omitRowId == null || r.id !== omitRowId)
    .sort((a, b) => a.docEntry - b.docEntry);
  const acc = new Map<string, number>();
  for (const r of chronological) {
    const lot = (r.lote || "").trim();
    if (!lot) continue;
    const key = `${r.codigoProduto.trim()}\t${r.filialNome.trim()}\t${r.codigoTunel}\t${lot}`;
    const prev = acc.get(key) ?? 0;
    const delta = r.processo === "entrada" ? r.quantidade : -r.quantidade;
    acc.set(key, prev + delta);
  }
  return acc;
}

/**
 * Lotes com saldo > 0 na saída. Só exige código do produto; filial/túnel filtram se já preenchidos.
 * Assim o usuário pode escolher o lote antes do túnel — ao selecionar, filial e túnel são preenchidos.
 */
function lotesSaidaDisponiveis(
  rows: OCCERow[],
  codigo: string,
  filial: string,
  codigoTunel: string,
  omitRowId?: number | null
): LoteSaidaOption[] {
  const cod = codigo.trim();
  if (!cod) return [];

  const fil = filial.trim();
  const tunStr = codigoTunel.trim();
  const tunNum = tunStr ? Math.trunc(Number(tunStr)) : NaN;
  const hasFil = !!fil;
  const hasTun = tunStr !== "" && Number.isFinite(tunNum);

  const saldos = saldoPorLoteMap(rows, omitRowId);
  const entradaRows = rows.filter(
    (m) => m.processo === "entrada" && (m.lote || "").trim() && m.codigoProduto.trim() === cod
  );

  const byBin = new Map<string, OCCERow>();
  for (const m of [...entradaRows].sort((a, b) => a.docEntry - b.docEntry)) {
    const lot = (m.lote || "").trim();
    const fk = binKey(m.filialNome.trim(), m.codigoTunel, lot);
    byBin.set(fk, m);
  }

  const out: LoteSaidaOption[] = [];
  for (const [fk, row] of byBin) {
    let fn: string;
    let tNum: number;
    let lote: string;
    try {
      const parsed = JSON.parse(fk) as unknown;
      if (!Array.isArray(parsed) || parsed.length !== 3) continue;
      fn = String(parsed[0] ?? "").trim();
      tNum = Math.trunc(Number(parsed[1]));
      lote = String(parsed[2] ?? "").trim();
    } catch {
      continue;
    }
    if (!lote || !Number.isFinite(tNum)) continue;

    if (hasFil && fn !== fil) continue;
    if (hasTun && tNum !== tunNum) continue;

    const mapKey = `${cod}\t${fn}\t${tNum}\t${lote}`;
    const saldo = saldos.get(mapKey) ?? 0;
    if (saldo <= 0) continue;

    out.push({
      lote,
      saldo,
      dataFabricacao: row.dataFabricacao || "",
      dataVencimento: row.dataVencimento || "",
      filialNome: fn.trim(),
      codigoTunel: tNum,
      custoUnitarioEntrada: Number(row.custoUnitario) || 0,
    });
  }

  out.sort((a, b) => {
    const c = a.filialNome.localeCompare(b.filialNome, "pt-BR");
    if (c !== 0) return c;
    if (a.codigoTunel !== b.codigoTunel) return a.codigoTunel - b.codigoTunel;
    return a.lote.localeCompare(b.lote, "pt-BR");
  });
  return out;
}

function rowToFormState(r: OCCERow, movsForSaldo: OCCERow[]): FormState {
  let saldoLote = "";
  if (r.processo === "saida" && (r.lote || "").trim()) {
    const sm = saldoPorLoteMap(movsForSaldo, r.id);
    const k = `${r.codigoProduto.trim()}\t${r.filialNome.trim()}\t${r.codigoTunel}\t${(r.lote || "").trim()}`;
    saldoLote = formatNumberPtBrFixed(sm.get(k) ?? 0, 2);
  }
  return {
    data: r.dataMovimento || "",
    codigoProduto: r.codigoProduto,
    descricaoItem: r.descricaoItem,
    unidadeMedida: r.unidadeMedida,
    grupoItens: r.grupoItens,
    lote: r.lote || "",
    dataFabricacao: r.dataFabricacao || "",
    dataVencimento: r.dataVencimento || "",
    processo: r.processo,
    quantidade: formatNumberPtBrFixed(r.quantidade, 2),
    custo: formatNumberPtBrFixed(r.custoUnitario, 2),
    filial: r.filialNome,
    codigoTunel: String(r.codigoTunel),
    saldoLote,
  };
}

export default function ControleEstoque() {
  const { toast } = useToast();
  const { setDocumentNav } = useDocumentNav();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [tuneis, setTuneis] = useState<OCTTRow[]>([]);
  const [movs, setMovs] = useState<OCCERow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  /** null = nova movimentação; número = visualizando registro existente (somente leitura). */
  const [selectedMovId, setSelectedMovId] = useState<number | null>(null);

  const occeLocalMutationAtRef = useRef(0);
  const occeRtDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMovsRef = useRef<() => Promise<void>>(async () => {});
  const codeLookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeLookupSeqRef = useRef(0);
  const chartOccePizzaRef = useRef<HTMLDivElement>(null);

  const loadMovs = useCallback(async () => {
    const list = await getControleEstoque();
    setMovs(list);
  }, []);

  loadMovsRef.current = loadMovs;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [filiaisData, tuneisData, movsData] = await Promise.all([
          getFiliais(),
          getTuneis(),
          getControleEstoque(),
        ]);

        if (!mounted) return;
        setFiliais(filiaisData as FilialOption[]);
        setTuneis(tuneisData);
        setMovs(movsData);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Falha ao carregar dados.";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  useEffect(() => {
    const schedule = () => {
      if (Date.now() - occeLocalMutationAtRef.current < REALTIME_SUPPRESS_OWN_WRITE_MS) return;
      if (occeRtDebounceRef.current) clearTimeout(occeRtDebounceRef.current);
      occeRtDebounceRef.current = setTimeout(() => {
        occeRtDebounceRef.current = null;
        void loadMovsRef.current();
      }, REALTIME_COLLAPSE_MS);
    };
    const unsub = subscribeOCCERealtime(schedule);
    return () => {
      if (occeRtDebounceRef.current) clearTimeout(occeRtDebounceRef.current);
      unsub();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (codeLookupTimeoutRef.current) clearTimeout(codeLookupTimeoutRef.current);
    };
  }, []);

  const fetchOctiAndFill = useCallback(
    async (codeRaw: string) => {
      const codeVal = codeRaw.trim();
      const seq = ++codeLookupSeqRef.current;

      if (!codeVal) {
        setForm((p) => ({
          ...p,
          descricaoItem: "",
          unidadeMedida: "",
          grupoItens: "",
          ...(p.processo === "saida" ? { lote: "", dataFabricacao: "", dataVencimento: "", saldoLote: "" } : {}),
        }));
        return;
      }

      try {
        const item = await getItemByCode(codeVal);
        if (seq !== codeLookupSeqRef.current) return;

        if (item) {
          setForm((p) => ({
            ...p,
            codigoProduto: item.codigo_item || codeVal,
            descricaoItem: item.nome_item || "",
            unidadeMedida: item.unidade_medida != null ? String(item.unidade_medida) : "",
            grupoItens: item.grupo_itens != null ? String(item.grupo_itens) : "",
            ...(p.processo === "saida" ? { lote: "", dataFabricacao: "", dataVencimento: "", saldoLote: "" } : {}),
          }));
        } else {
          setForm((p) => ({
            ...p,
            descricaoItem: "",
            unidadeMedida: "",
            grupoItens: "",
            ...(p.processo === "saida" ? { lote: "", dataFabricacao: "", dataVencimento: "", saldoLote: "" } : {}),
          }));
        }
      } catch (e) {
        if (seq !== codeLookupSeqRef.current) return;
        console.error("ControleEstoque getItemByCode:", e);
        toast({
          title: "Catálogo OCTI",
          description:
            e instanceof Error
              ? e.message
              : "Não foi possível buscar o item. Verifique RLS/leitura na tabela OCTI.",
          variant: "destructive",
        });
        setForm((p) => ({
          ...p,
          descricaoItem: "",
          unidadeMedida: "",
          grupoItens: "",
          ...(p.processo === "saida" ? { lote: "", dataFabricacao: "", dataVencimento: "", saldoLote: "" } : {}),
        }));
      }
    },
    [toast]
  );

  const movsComSaldo = useMemo(() => rowsComSaldo(movs), [movs]);

  /** Ordem de navegação no header: menor doc_entry = posição 1. */
  const movsNavOrder = useMemo(
    () => [...movs].sort((a, b) => a.docEntry - b.docEntry),
    [movs]
  );

  useEffect(() => {
    if (selectedMovId == null) return;
    if (codeLookupTimeoutRef.current) {
      clearTimeout(codeLookupTimeoutRef.current);
      codeLookupTimeoutRef.current = null;
    }
  }, [selectedMovId]);

  const selectedRow = useMemo(
    () => (selectedMovId != null ? movs.find((m) => m.id === selectedMovId) ?? null : null),
    [movs, selectedMovId]
  );

  useEffect(() => {
    if (selectedMovId == null) return;
    const row = movs.find((m) => m.id === selectedMovId);
    if (!row) {
      setSelectedMovId(null);
      setForm((p) => ({ ...emptyForm(), filial: p.filial }));
      return;
    }
    setForm(rowToFormState(row, movs));
  }, [selectedMovId, movs]);

  const onNovoDocumento = useCallback(() => {
    setSelectedMovId(null);
    setForm((p) => ({ ...emptyForm(), filial: p.filial }));
  }, []);

  const movsNavRef = useRef(movsNavOrder);
  movsNavRef.current = movsNavOrder;
  const selectedMovIdRef = useRef(selectedMovId);
  selectedMovIdRef.current = selectedMovId;
  const onNovoDocumentoNavRef = useRef(onNovoDocumento);
  onNovoDocumentoNavRef.current = onNovoDocumento;

  useEffect(() => {
    const total = movsNavOrder.length;
    const currentIndex = selectedMovId != null ? movsNavOrder.findIndex((r) => r.id === selectedMovId) : -1;
    const hasCurrent = currentIndex >= 0;

    setDocumentNav({
      showNav: true,
      showNewInHeader: true,
      canGoPrev: total > 0 && (hasCurrent ? currentIndex > 0 : true),
      canGoNext: total > 0 && (hasCurrent ? currentIndex < total - 1 : true),
      onPrev: () => {
        const rows = movsNavRef.current;
        const sid = selectedMovIdRef.current;
        const t = rows.length;
        const ci = sid != null ? rows.findIndex((x) => x.id === sid) : -1;
        const hc = ci >= 0;
        if (t === 0) return;
        if (!hc) setSelectedMovId(rows[t - 1]!.id);
        else if (ci > 0) setSelectedMovId(rows[ci - 1]!.id);
      },
      onNext: () => {
        const rows = movsNavRef.current;
        const sid = selectedMovIdRef.current;
        const t = rows.length;
        const ci = sid != null ? rows.findIndex((x) => x.id === sid) : -1;
        const hc = ci >= 0;
        if (t === 0) return;
        if (!hc) setSelectedMovId(rows[0]!.id);
        else if (ci < t - 1) setSelectedMovId(rows[ci + 1]!.id);
      },
      onNewDocument: () => onNovoDocumentoNavRef.current(),
      navLabel: total > 0 ? `${hasCurrent ? currentIndex + 1 : 1} de ${total}` : "0 de 0",
    });

    return () => setDocumentNav(null);
  }, [movsNavOrder, selectedMovId, setDocumentNav]);

  const tuneisDaFilial = useMemo(
    () =>
      tuneis
        .filter((t) => (t.filial || "").trim() === form.filial.trim())
        .sort((a, b) => Number(a.code || 0) - Number(b.code || 0)),
    [tuneis, form.filial]
  );

  const proximoDocumento = useMemo(() => {
    if (movs.length === 0) return 1;
    return Math.max(...movs.map((r) => r.docEntry)) + 1;
  }, [movs]);

  const documentoExibido = selectedRow ? selectedRow.docEntry : proximoDocumento;

  const totalEntrada = useMemo(
    () => movs.filter((m) => m.processo === "entrada").reduce((a, b) => a + b.quantidade, 0),
    [movs]
  );
  const totalSaida = useMemo(
    () => movs.filter((m) => m.processo === "saida").reduce((a, b) => a + b.quantidade, 0),
    [movs]
  );
  const saldoTotal = useMemo(() => totalEntrada - totalSaida, [totalEntrada, totalSaida]);

  const lotesDisponiveisSaida = useMemo(
    () =>
      form.processo === "saida"
        ? lotesSaidaDisponiveis(
            movs,
            form.codigoProduto,
            form.filial,
            form.codigoTunel,
            selectedRow?.processo === "saida" ? selectedRow.id : null
          )
        : [],
    [movs, form.processo, form.codigoProduto, form.filial, form.codigoTunel, selectedRow]
  );

  /** Valor do Select de lote na saída (chave única por filial+túnel+lote). */
  const loteSaidaSelectValue = useMemo(() => {
    if (form.processo !== "saida" || !form.lote.trim()) return "__none_lote__";
    const f = form.filial.trim();
    const t = form.codigoTunel.trim();
    if (!f || !t) return "__none_lote__";
    const key = loteSaidaOptionKey({
      lote: form.lote.trim(),
      saldo: 0,
      dataFabricacao: "",
      dataVencimento: "",
      filialNome: f,
      codigoTunel: Math.trunc(Number(t)),
      custoUnitarioEntrada: 0,
    });
    return lotesDisponiveisSaida.some((o) => loteSaidaOptionKey(o) === key) ? key : "__none_lote__";
  }, [form.processo, form.lote, form.filial, form.codigoTunel, lotesDisponiveisSaida]);

  useEffect(() => {
    if (form.processo !== "saida" || !form.lote.trim()) return;
    const f = form.filial.trim();
    const t = form.codigoTunel.trim();
    const ok = lotesDisponiveisSaida.some((o) => {
      if (o.lote !== form.lote.trim()) return false;
      if (!f || !t) return true;
      return o.filialNome.trim() === f && o.codigoTunel === Math.trunc(Number(t));
    });
    if (!ok) {
      setForm((p) => ({ ...p, lote: "", dataFabricacao: "", dataVencimento: "", saldoLote: "" }));
    }
  }, [form.processo, form.lote, form.filial, form.codigoTunel, lotesDisponiveisSaida]);

  /** Atualiza o saldo exibido se as movimentações mudarem (ex.: tempo real) mantendo o mesmo lote/endereço. */
  useEffect(() => {
    if (form.processo !== "saida") return;
    const f = form.filial.trim();
    const t = form.codigoTunel.trim();
    const l = form.lote.trim();
    if (!l || !f || !t) return;
    const opt = lotesDisponiveisSaida.find(
      (o) =>
        o.lote === l && o.filialNome.trim() === f && o.codigoTunel === Math.trunc(Number(t))
    );
    if (!opt) return;
    const next = formatNumberPtBrFixed(opt.saldo, 2);
    setForm((p) => (p.saldoLote === next ? p : { ...p, saldoLote: next }));
  }, [form.processo, form.lote, form.filial, form.codigoTunel, lotesDisponiveisSaida]);

  const onCodigoProdutoChange = (nextCode: string) => {
    setForm((p) => ({ ...p, codigoProduto: nextCode }));

    if (codeLookupTimeoutRef.current) {
      clearTimeout(codeLookupTimeoutRef.current);
      codeLookupTimeoutRef.current = null;
    }

    const codeVal = nextCode.trim();
    if (!codeVal) {
      void fetchOctiAndFill("");
      return;
    }

    codeLookupTimeoutRef.current = setTimeout(() => {
      codeLookupTimeoutRef.current = null;
      void fetchOctiAndFill(codeVal);
    }, CODE_LOOKUP_DEBOUNCE_MS);
  };

  const onCodigoProdutoBlur = () => {
    if (codeLookupTimeoutRef.current) {
      clearTimeout(codeLookupTimeoutRef.current);
      codeLookupTimeoutRef.current = null;
    }
    const codeVal = form.codigoProduto.trim();
    setForm((p) => ({ ...p, codigoProduto: codeVal }));
    void fetchOctiAndFill(codeVal);
  };

  const handleLoteSaidaChange = useCallback(
    (value: string) => {
      if (value === "__none_lote__") {
        setForm((p) => ({
          ...p,
          lote: "",
          dataFabricacao: "",
          dataVencimento: "",
          saldoLote: "",
          custo: "",
        }));
        return;
      }
      const opt = lotesDisponiveisSaida.find((o) => loteSaidaOptionKey(o) === value);
      if (!opt) return;
      setForm((p) => ({
        ...p,
        filial: opt.filialNome,
        codigoTunel: String(opt.codigoTunel),
        lote: opt.lote,
        dataFabricacao: opt.dataFabricacao || "",
        dataVencimento: opt.dataVencimento || "",
        saldoLote: formatNumberPtBrFixed(opt.saldo, 2),
        custo: formatNumberPtBrFixed(opt.custoUnitarioEntrada, 2),
      }));
    },
    [lotesDisponiveisSaida]
  );

  const onSalvarMov = async () => {
    if (!form.data || !form.codigoProduto || !form.filial || !form.processo) {
      toast({ title: "Validação", description: "Preencha Data, Código do produto, Filial e Processo.", variant: "destructive" });
      return;
    }
    if (!form.descricaoItem) {
      toast({
        title: "Validação",
        description: "Código não encontrado na OCTI ou sem descrição. Confira o cadastro de itens.",
        variant: "destructive",
      });
      return;
    }
    const quantidade = parseBrazilNumber(form.quantidade || "0");
    const custo = parseBrazilNumber(form.custo || "0");
    if (!(quantidade > 0)) {
      toast({ title: "Validação", description: "Quantidade deve ser maior que zero.", variant: "destructive" });
      return;
    }
    if (!form.codigoTunel) {
      toast({ title: "Validação", description: "Selecione o túnel da filial.", variant: "destructive" });
      return;
    }

    if (form.processo === "saida") {
      if (!form.lote.trim()) {
        toast({
          title: "Validação",
          description: "Selecione um lote cadastrado em entrada (com saldo neste produto, filial e túnel).",
          variant: "destructive",
        });
        return;
      }
      const opt = lotesDisponiveisSaida.find(
        (o) =>
          o.lote === form.lote.trim() &&
          o.filialNome.trim() === form.filial.trim() &&
          o.codigoTunel === Math.trunc(Number(form.codigoTunel))
      );
      if (!opt) {
        toast({
          title: "Validação",
          description: "Lote indisponível para saída. Selecione o lote na lista ou confira produto, filial e túnel.",
          variant: "destructive",
        });
        return;
      }
      if (quantidade > opt.saldo) {
        toast({
          title: "Validação",
          description: `Quantidade maior que o saldo do lote (${formatNumberPtBrFixed(opt.saldo, 2)}).`,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const diffDias = daysBetween(form.dataFabricacao, form.dataVencimento);
      const statusValidade: "No prazo" | "Vencido" =
        form.dataVencimento && new Date(`${todayIso()}T00:00:00`) > new Date(`${form.dataVencimento}T00:00:00`)
          ? "Vencido"
          : "No prazo";

      const valorTotal = quantidade * custo;

      const payload = {
        data_movimento: form.data,
        codigo_produto: form.codigoProduto,
        descricao_item: form.descricaoItem,
        unidade_medida: form.unidadeMedida,
        grupo_itens: form.grupoItens,
        lote: form.lote.trim() || null,
        data_fabricacao: form.dataFabricacao || null,
        data_vencimento: form.dataVencimento || null,
        diferenca_dias_fab_venc: diffDias,
        status_validade: statusValidade,
        processo: form.processo,
        quantidade,
        custo_unitario: custo,
        valor_total: valorTotal,
        filial_nome: form.filial,
        codigo_tunel: Math.trunc(Number(form.codigoTunel)),
      };

      if (selectedMovId != null) {
        await updateControleEstoque(selectedMovId, payload);
        toast({ title: "Sucesso", description: "Movimentação atualizada na OCCE." });
      } else {
        await createControleEstoque(payload);
        setSelectedMovId(null);
        setForm((p) => ({ ...emptyForm(), filial: p.filial }));
        toast({ title: "Sucesso", description: "Movimentação gravada na OCCE." });
      }

      occeLocalMutationAtRef.current = Date.now();
      await loadMovs();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao salvar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onExcluir = async (id: number) => {
    const eraVisualizando = selectedMovId === id;
    try {
      await deleteControleEstoque(id);
      occeLocalMutationAtRef.current = Date.now();
      if (eraVisualizando) {
        setSelectedMovId(null);
        setForm((p) => ({ ...emptyForm(), filial: p.filial }));
      }
      await loadMovs();
      toast({ title: "Sucesso", description: "Movimentação excluída." });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao excluir.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card className="rounded-2xl border border-border/50 bg-card/95">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Controle de estoque</CardTitle>
                <CardDescription>
                  Entrada e saída com validade, filial e túnel (tabela OCCE no Supabase). Clique na grade para abrir e editar; use Nova movimentação ou o + no cabeçalho para incluir outra.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Item (documento)</Label>
                    <Input readOnly value={String(documentoExibido)} className="bg-muted font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={form.data}
                      onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Código do produto</Label>
                    <Input
                      value={form.codigoProduto}
                      onChange={(e) => onCodigoProdutoChange(e.target.value)}
                      onBlur={onCodigoProdutoBlur}
                      placeholder="Digite o código"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Descrição do item</Label>
                    <Input readOnly value={form.descricaoItem} className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unidade de medida</Label>
                    <Input readOnly value={form.unidadeMedida} className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Grupo de itens</Label>
                    <Input readOnly value={form.grupoItens} className="bg-muted" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>
                      {form.processo === "saida" ? "Lote (somente entradas cadastradas)" : "Lote"}
                    </Label>
                    {form.processo === "saida" ? (
                      <Select
                        value={loteSaidaSelectValue}
                        onValueChange={handleLoteSaidaChange}
                        disabled={!form.codigoProduto.trim() || lotesDisponiveisSaida.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !form.codigoProduto.trim()
                                ? "Informe o código do produto"
                                : lotesDisponiveisSaida.length === 0
                                  ? "Nenhum lote com saldo para este produto"
                                  : "Selecione o lote"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none_lote__">Selecione o lote</SelectItem>
                          {lotesDisponiveisSaida.map((o) => (
                            <SelectItem
                              key={loteSaidaOptionKey(o)}
                              value={loteSaidaOptionKey(o)}
                              title={`${o.filialNome} · Túnel ${String(o.codigoTunel).padStart(4, "0")} · saldo ${formatNumberPtBrFixed(o.saldo, 2)}`}
                            >
                              {o.lote}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={form.lote}
                        onChange={(e) => setForm((p) => ({ ...p, lote: e.target.value }))}
                        placeholder="Informe o lote na entrada"
                      />
                    )}
                  </div>
                  {form.processo === "saida" ? (
                    <div className="space-y-1.5">
                      <Label>Saldo</Label>
                      <Input
                        readOnly
                        value={form.saldoLote}
                        placeholder="—"
                        className="bg-muted tabular-nums"
                        title="Saldo disponível neste lote (filial + túnel + produto)"
                      />
                    </div>
                  ) : null}
                </div>
                {form.processo === "saida" &&
                  form.codigoProduto.trim() &&
                  lotesDisponiveisSaida.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Não há lote com saldo para este produto. Cadastre uma entrada com lote ou confira o código.
                    </p>
                  )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Filial</Label>
                    <Select
                      value={form.filial || "__none__"}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          filial: v === "__none__" ? "" : v,
                          codigoTunel: "",
                          ...(p.processo === "saida" ? { lote: "", dataFabricacao: "", dataVencimento: "", saldoLote: "" } : {}),
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione a filial" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione a filial</SelectItem>
                        {filiais.map((f) => (
                          <SelectItem key={f.id} value={f.nome}>
                            {f.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Túnel</Label>
                    <Select
                      value={form.codigoTunel || "__none_tunel__"}
                      disabled={!form.filial}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          codigoTunel: v === "__none_tunel__" ? "" : v,
                          ...(p.processo === "saida" ? { lote: "", dataFabricacao: "", dataVencimento: "", saldoLote: "" } : {}),
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o túnel" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none_tunel__">Selecione o túnel</SelectItem>
                        {tuneisDaFilial.map((t) => (
                          <SelectItem key={t.id} value={String(t.code)}>
                            {String(t.code).padStart(4, "0")} - {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Processo</Label>
                    <Select
                      value={form.processo}
                      onValueChange={(v) => {
                        const proc = v as ProcessoTipo;
                        setForm((p) => ({
                          ...p,
                          processo: proc,
                          ...(proc === "saida"
                            ? { lote: "", dataFabricacao: "", dataVencimento: "", saldoLote: "" }
                            : { saldoLote: "" }),
                        }));
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="saida">Saída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label>Data de fabricação</Label>
                    <Input
                      type="date"
                      value={form.dataFabricacao}
                      onChange={(e) => setForm((p) => ({ ...p, dataFabricacao: e.target.value }))}
                      readOnly={form.processo === "saida"}
                      className={form.processo === "saida" ? "bg-muted" : undefined}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data de vencimento</Label>
                    <Input
                      type="date"
                      value={form.dataVencimento}
                      onChange={(e) => setForm((p) => ({ ...p, dataVencimento: e.target.value }))}
                      readOnly={form.processo === "saida"}
                      className={form.processo === "saida" ? "bg-muted" : undefined}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantidade</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.quantidade}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, quantidade: sanitizeBrDecimalInput(e.target.value) }))
                      }
                      onBlur={() => setForm((p) => ({ ...p, quantidade: formatOcceDecimalTwoPlaces(p.quantidade) }))}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custo unitário</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      value={form.custo}
                      onChange={(e) => setForm((p) => ({ ...p, custo: sanitizeBrDecimalInput(e.target.value) }))}
                      onBlur={() => setForm((p) => ({ ...p, custo: formatOcceDecimalTwoPlaces(p.custo) }))}
                      className="tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex justify-end flex-wrap gap-2">
                  {selectedMovId != null ? (
                    <button
                      type="button"
                      onClick={onNovoDocumento}
                      className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary w-full sm:w-auto"
                      title="Nova movimentação"
                      aria-label="Nova movimentação"
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      <span>Nova movimentação</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onSalvarMov()}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                    title={selectedMovId != null ? "Salvar alterações" : "Adicionar movimentação"}
                    aria-label={selectedMovId != null ? "Salvar alterações" : "Adicionar movimentação"}
                  >
                    {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Plus className="h-4 w-4 shrink-0" />}
                    <span>
                      {saving ? "Salvando..." : selectedMovId != null ? "Salvar alterações" : "Adicionar movimentação"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div ref={chartOccePizzaRef} className="chart-card pl-3 pr-4 py-5 sm:p-6 lg:p-8 overflow-hidden">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
            <div className="flex gap-3 min-w-0">
              <div className="flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 via-primary/15 to-primary/10 border border-primary/25 shadow-lg shadow-primary/10">
                <ChartPie className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-card-foreground">Entrada × saída (gráfico de pizza)</h3>
                <p className="text-xs sm:text-sm text-muted-foreground/90 mt-0.5">
                  A pizza usa como 100% a <span className="font-medium text-foreground/90">soma das entradas</span>: verde = saldo
                  (sobra, entrada − saída), vermelho = total de saída. Novas entradas ou saídas alteram os totais e as fatias.
                </p>
              </div>
            </div>
            <ExportToPng
              targetRef={chartOccePizzaRef}
              filenamePrefix="occe-entrada-saida-pizza"
              expandScrollable={false}
              className="shrink-0"
              label="Baixar PNG"
              title="Baixar gráfico de pizza como imagem PNG"
            />
          </div>
          <EntradaSaidaPieChart totalEntrada={totalEntrada} totalSaida={totalSaida} />
        </div>

        <Card className="rounded-2xl border border-border/50 bg-card/95">
          <CardHeader>
            <CardTitle className="text-base">Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="Total Entrada" value={formatNumberPtBrFixed(totalEntrada, 2)} icon={ArrowDownToLine} />
              <KpiCard title="Total Saída" value={formatNumberPtBrFixed(totalSaida, 2)} icon={ArrowUpFromLine} />
              <KpiCard
                title="Saldo (entrada − saída)"
                value={formatNumberPtBrFixed(saldoTotal, 2)}
                icon={Scale}
              />
            </div>
            {movsComSaldo.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma movimentação cadastrada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <Table className="min-w-[110rem]">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="whitespace-nowrap">Item</TableHead>
                      <TableHead className="whitespace-nowrap">Data</TableHead>
                      <TableHead className="whitespace-nowrap">Código</TableHead>
                      <TableHead className="whitespace-nowrap">Descrição</TableHead>
                      <TableHead className="whitespace-nowrap">Un.</TableHead>
                      <TableHead className="whitespace-nowrap">Grupo</TableHead>
                      <TableHead className="whitespace-nowrap">Lote</TableHead>
                      <TableHead className="whitespace-nowrap">Fabricação</TableHead>
                      <TableHead className="whitespace-nowrap">Vencimento</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Dif. dias</TableHead>
                      <TableHead className="whitespace-nowrap">Status validade</TableHead>
                      <TableHead className="whitespace-nowrap">Processo</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Qtd.</TableHead>
                      <TableHead className="whitespace-nowrap">Filial</TableHead>
                      <TableHead className="whitespace-nowrap">Túnel</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Saldo</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Custo</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movsComSaldo.map((m) => (
                      <TableRow
                        key={m.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/40",
                          selectedMovId === m.id && "bg-muted/60"
                        )}
                        onClick={() => setSelectedMovId(m.id)}
                      >
                        <TableCell className="whitespace-nowrap font-mono tabular-nums align-middle">
                          {m.docEntry}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums font-mono align-middle">
                          {m.dataMovimento}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono align-middle">{m.codigoProduto}</TableCell>
                        <TableCell className="whitespace-nowrap align-middle">{m.descricaoItem}</TableCell>
                        <TableCell className="whitespace-nowrap align-middle">{m.unidadeMedida}</TableCell>
                        <TableCell className="whitespace-nowrap align-middle">{m.grupoItens}</TableCell>
                        <TableCell className="whitespace-nowrap align-middle">{m.lote || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums font-mono align-middle">
                          {m.dataFabricacao || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums font-mono align-middle">
                          {m.dataVencimento || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums align-middle">
                          {m.diferencaDiasFabVenc}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "whitespace-nowrap align-middle",
                            m.statusValidade === "Vencido" && "text-destructive font-semibold"
                          )}
                        >
                          {m.statusValidade}
                        </TableCell>
                        <TableCell className="whitespace-nowrap capitalize align-middle">{m.processo}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums align-middle">
                          {formatNumberPtBrFixed(m.quantidade, 2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap align-middle">{m.filialNome}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono tabular-nums align-middle">
                          {String(m.codigoTunel).padStart(4, "0")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums align-middle">
                          {formatNumberPtBrFixed(m.saldo, 2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums align-middle">
                          {formatNumberPtBrFixed(m.custoUnitario, 2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums align-middle">
                          {formatNumberPtBrFixed(m.valorTotal, 2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right align-middle">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onExcluir(m.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
