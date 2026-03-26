import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, ArrowLeftRight, ArrowRight, FilePlus, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDocumentNav } from "@/contexts/DocumentNavContext";
import {
  createMovimentacaoTunel,
  deleteMovimentacaoTunel,
  getFiliais,
  getMovimentacoesTuneis,
  getTiposProduto,
  getTuneis,
  parseBrazilNumber,
  updateMovimentacaoTunel,
  type CDTPRow,
  type OCMTRow,
  type OCTTRow,
} from "@/services/supabaseData";

type FilialOption = { id: number; codigo: string; nome: string; endereco: string };

type FormState = {
  id: number | null;
  docEntryPreview: string;
  docNumPreview: string;
  filialNome: string;
  codigoTunel: string;
  codigoTipoProduto: string;
  qtdInserida: string;
  dataAbertura: string;
  horaAbertura: string;
  dataFechamento: string;
  horaFechamento: string;
};

type MovRow = {
  rowId: number;
  codigoTipoProduto: string;
  qtdInserida: string;
  dataAbertura: string;
  horaAbertura: string;
  dataFechamento: string;
  horaFechamento: string;
  observacao: string;
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function emptyForm(): FormState {
  return {
    id: null,
    docEntryPreview: "Automatico",
    docNumPreview: "Automatico",
    filialNome: "",
    codigoTunel: "",
    codigoTipoProduto: "",
    qtdInserida: "",
    dataAbertura: todayStr(),
    horaAbertura: "",
    dataFechamento: "",
    horaFechamento: "",
  };
}

function createMovRow(): MovRow {
  return {
    rowId: Date.now() + Math.floor(Math.random() * 1000),
    codigoTipoProduto: "",
    qtdInserida: "",
    dataAbertura: todayStr(),
    horaAbertura: "",
    dataFechamento: "",
    horaFechamento: "",
    observacao: "",
  };
}

function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function fmtDateLabel(dateIso: string | null): string {
  if (!dateIso) return "Sem data";
  const parts = String(dateIso).split("T")[0].split("-");
  if (parts.length !== 3) return String(dateIso);
  const [y, m, d] = parts.map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function padDoc(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "Automatico";
  return String(Math.trunc(n)).padStart(4, "0");
}

function normalizeCodigoDocumento(value: string | number): number {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
}

function formatHoraFechamentoInput(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  const hh = digits.slice(0, 2);
  const mm = digits.slice(2);
  return `${hh}:${mm}`;
}

function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  const msg = error instanceof Error ? error.message : fallback;
  const normalized = String(msg || "").toLowerCase();
  if (
    normalized.includes("42501") ||
    normalized.includes("403") ||
    normalized.includes("forbidden") ||
    normalized.includes("sem permissão")
  ) {
    return "Você não tem permissão para esta ação. Verifique as políticas de acesso (RLS) no Supabase.";
  }
  return msg || fallback;
}

export default function MovimentacaoTuneis() {
  const { toast } = useToast();
  const { setDocumentNav } = useDocumentNav();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<OCMTRow[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [tuneis, setTuneis] = useState<OCTTRow[]>([]);
  const [tiposProduto, setTiposProduto] = useState<CDTPRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [movRows, setMovRows] = useState<MovRow[]>([createMovRow()]);
  const [activeTab, setActiveTab] = useState<"movimentacao" | "analise">("movimentacao");

  const [filtroFilial, setFiltroFilial] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtrosDialogOpen, setFiltrosDialogOpen] = useState(false);
  const [filtroFilialPending, setFiltroFilialPending] = useState("");
  const [filtroDataInicioPending, setFiltroDataInicioPending] = useState("");
  const [filtroDataFimPending, setFiltroDataFimPending] = useState("");

  const tuneisDaFilial = useMemo(
    () => tuneis.filter((t) => t.filial === form.filialNome).sort((a, b) => Number(a.code) - Number(b.code)),
    [tuneis, form.filialNome]
  );
  const tiposDaFilial = useMemo(
    () => tiposProduto.filter((t) => t.filial === form.filialNome).sort((a, b) => Number(a.code) - Number(b.code)),
    [tiposProduto, form.filialNome]
  );
  const tuneisByKey = useMemo(() => {
    const map = new Map<string, OCTTRow>();
    for (const t of tuneis) map.set(`${t.filial}|${String(t.code)}`, t);
    return map;
  }, [tuneis]);
  const tiposByKey = useMemo(() => {
    const map = new Map<string, CDTPRow>();
    for (const t of tiposProduto) map.set(`${t.filial}|${String(t.code)}`, t);
    return map;
  }, [tiposProduto]);

  async function loadBase() {
    const [filiaisData, tuneisData, tiposData] = await Promise.all([getFiliais(), getTuneis(), getTiposProduto()]);
    setFiliais(filiaisData as FilialOption[]);
    setTuneis(tuneisData);
    setTiposProduto(tiposData);
  }

  async function loadRows(filters?: { filialNome?: string; dataInicio?: string; dataFim?: string }) {
    const filialNome = filters?.filialNome ?? filtroFilial;
    const dataInicio = filters?.dataInicio ?? filtroDataInicio;
    const dataFim = filters?.dataFim ?? filtroDataFim;
    const data = await getMovimentacoesTuneis({
      filialNome: filialNome || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    });
    const ordered = [...data].sort((a, b) => {
      const da = Number(a.docEntry || 0);
      const db = Number(b.docEntry || 0);
      if (da !== db) return da - db;
      return Number(a.id || 0) - Number(b.id || 0);
    });
    setRows(ordered);
    return ordered;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await loadBase();
        await loadRows();
      } catch (error: unknown) {
        if (!mounted) return;
        const msg = getFriendlyErrorMessage(error, "Falha ao carregar movimentações.");
        toast({ title: "Erro", description: msg, variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function aplicarFiltros() {
    try {
      setLoading(true);
      const dataInicioNorm = filtroDataInicioPending || filtroDataFimPending || "";
      const dataFimNorm = filtroDataFimPending || filtroDataInicioPending || "";

      await loadRows({
        filialNome: filtroFilialPending,
        dataInicio: dataInicioNorm,
        dataFim: dataFimNorm,
      });
      setFiltroFilial(filtroFilialPending);
      setFiltroDataInicio(dataInicioNorm);
      setFiltroDataFim(dataFimNorm);
      setFiltrosDialogOpen(false);
      setActiveTab("analise");
    } catch (error: unknown) {
      const msg = getFriendlyErrorMessage(error, "Falha ao filtrar.");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function onSalvar() {
    if (!form.filialNome || !form.codigoTunel) {
      toast({
        title: "Validação",
        description: "Preencha Filial e Túnel.",
        variant: "destructive",
      });
      return;
    }
    const validRows = movRows.filter((r) => r.codigoTipoProduto || r.qtdInserida || r.dataAbertura || r.dataFechamento || r.horaAbertura || r.horaFechamento || r.observacao);
    if (validRows.length === 0) {
      toast({ title: "Validação", description: "Adicione pelo menos uma linha para salvar.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      let focoId: number | null = null;
      for (let i = 0; i < validRows.length; i++) {
        const line = validRows[i];
        if (!line.codigoTipoProduto || !line.dataAbertura) {
          throw new Error(`Linha ${i + 1}: preencha Tipo de produto e Data abertura.`);
        }
        const qtdInserida = parseBrazilNumber(line.qtdInserida || "0");
        if (qtdInserida < 0) throw new Error(`Linha ${i + 1}: quantidade inserida não pode ser negativa.`);
        const payload = {
          filial_nome: form.filialNome,
          codigo_tunel: normalizeCodigoDocumento(form.codigoTunel),
          codigo_tipo_produto: normalizeCodigoDocumento(line.codigoTipoProduto),
          qtd_inserida: qtdInserida,
          data_abertura: line.dataAbertura || null,
          hora_abertura: line.horaAbertura || null,
          data_fechamento: line.dataFechamento || null,
          hora_fechamento: line.horaFechamento || null,
          observacao: line.observacao || null,
        };
        if (form.id && i === 0) {
          const updated = await updateMovimentacaoTunel(form.id, payload);
          focoId = updated.id;
        } else {
          const created = await createMovimentacaoTunel(payload);
          focoId = created.id;
        }
      }
      toast({ title: "Sucesso", description: form.id ? "Movimentação atualizada." : "Movimentação(ões) cadastrada(s)." });
      const refreshedRows = await loadRows();
      if (focoId != null) {
        const row = refreshedRows.find((r) => r.id === focoId);
        if (row) onEditar(row);
      }
    } catch (error: unknown) {
      const msg = getFriendlyErrorMessage(error, "Erro ao salvar movimentação.");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function onEditar(row: OCMTRow) {
    setForm({
      id: row.id,
      docEntryPreview: padDoc(row.docEntry),
      docNumPreview: padDoc(row.numeroDocumento),
      filialNome: row.filialNome,
      codigoTunel: String(row.codigoTunel),
      codigoTipoProduto: String(row.codigoTipoProduto),
      qtdInserida: "",
      dataAbertura: "",
      horaAbertura: "",
      dataFechamento: "",
      horaFechamento: "",
    });
    setMovRows([
      {
        rowId: Date.now(),
        codigoTipoProduto: String(row.codigoTipoProduto),
        qtdInserida: String(row.qtdInserida ?? ""),
        dataAbertura: row.dataAbertura || "",
        horaAbertura: row.horaAbertura || "",
        dataFechamento: row.dataFechamento || "",
        horaFechamento: row.horaFechamento || "",
        observacao: row.observacao || "",
      },
    ]);
  }

  useEffect(() => {
    if (form.id) return;
    const maxDoc = rows.reduce((m, r) => Math.max(m, Number(r.docEntry || 0)), 0);
    const next = maxDoc + 1;
    setForm((p) => ({
      ...p,
      docEntryPreview: padDoc(next),
      docNumPreview: padDoc(next),
    }));
  }, [rows, form.id]);

  function onNovoDocumento() {
    setForm(emptyForm());
    setMovRows([createMovRow()]);
  }

  async function onExcluir(id: number) {
    try {
      await deleteMovimentacaoTunel(id);
      toast({ title: "Sucesso", description: "Movimentação excluída." });
      if (form.id === id) onNovoDocumento();
      await loadRows();
    } catch (error: unknown) {
      const msg = getFriendlyErrorMessage(error, "Erro ao excluir movimentação.");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  }

  useEffect(() => {
    if (!filtrosDialogOpen) return;
    setFiltroFilialPending(filtroFilial);
    setFiltroDataInicioPending(filtroDataInicio);
    setFiltroDataFimPending(filtroDataFim);
  }, [filtrosDialogOpen, filtroFilial, filtroDataInicio, filtroDataFim]);

  useEffect(() => {
    const total = rows.length;
    const currentIndex = form.id != null ? rows.findIndex((r) => r.id === form.id) : -1;
    const hasCurrent = currentIndex >= 0;

    setDocumentNav({
      showNav: true,
      canGoPrev: total > 0 && (hasCurrent ? currentIndex > 0 : true),
      canGoNext: total > 0 && (hasCurrent ? currentIndex < total - 1 : true),
      onPrev: () => {
        if (total === 0) return;
        if (!hasCurrent) {
          onEditar(rows[total - 1]);
          return;
        }
        if (currentIndex > 0) onEditar(rows[currentIndex - 1]);
      },
      onNext: () => {
        if (total === 0) return;
        if (!hasCurrent) {
          onEditar(rows[0]);
          return;
        }
        if (currentIndex < total - 1) onEditar(rows[currentIndex + 1]);
      },
      onNewDocument: onNovoDocumento,
      navLabel: total > 0 ? `${hasCurrent ? currentIndex + 1 : 1} de ${total}` : "0 de 0",
    });

    return () => setDocumentNav(null);
  }, [rows, form.id, setDocumentNav]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="inline-flex h-12 min-h-12 items-stretch rounded-xl border border-border/60 bg-muted/40 p-1 gap-0.5 flex-shrink-0" role="tablist" aria-label="Navegação da movimentação de túneis">
            <button
              type="button"
              className={`inline-flex items-center justify-center gap-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg px-4 py-2 h-full min-h-0 text-xs sm:text-sm whitespace-nowrap ${activeTab === "movimentacao" ? "font-semibold bg-primary/10 text-primary border border-primary/25 shadow-sm hover:bg-primary/15" : "font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
              role="tab"
              aria-selected={activeTab === "movimentacao"}
              onClick={() => setActiveTab("movimentacao")}
            >
              <span>Movimentação de Túneis</span>
            </button>
            <button
              type="button"
              className={`inline-flex items-center justify-center gap-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg px-4 py-2 h-full min-h-0 text-xs sm:text-sm whitespace-nowrap ${activeTab === "analise" ? "font-semibold bg-primary/10 text-primary border border-primary/25 shadow-sm hover:bg-primary/15" : "font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
              role="tab"
              aria-selected={activeTab === "analise"}
              onClick={() => setActiveTab("analise")}
            >
              <span>Análise Túneis</span>
            </button>
          </div>
        </div>

        <Card className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />
          <div className="relative z-10">
            <CardHeader className="p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30">
                    <ArrowLeftRight className="h-7 w-7 text-primary" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-xl sm:text-2xl font-bold">Movimentação de Túneis</CardTitle>
                    <CardDescription>Controle diario de movimentações de túneis.</CardDescription>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:items-center">
                  <Dialog open={filtrosDialogOpen} onOpenChange={setFiltrosDialogOpen}>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-2.5 text-xs sm:text-sm font-medium border border-input bg-background hover:bg-muted/50 w-full sm:w-auto"
                        aria-label="Abrir filtros de produção"
                        aria-haspopup="dialog"
                        aria-expanded={filtrosDialogOpen}
                      >
                        <Filter className="h-4 w-4 shrink-0" />
                        <span>Filtros</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="w-[340px] sm:w-[420px] max-w-[95vw] p-4 rounded-lg">
                      <DialogHeader>
                        <DialogTitle className="text-base">Filtros — Movimentação de Túneis</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                          Defina os filtros e clique em Filtrar para aplicar.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 py-2">
                        <div className="space-y-1.5">
                          <Label>Filial</Label>
                          <Select value={filtroFilialPending || "__todas__"} onValueChange={(v) => setFiltroFilialPending(v === "__todas__" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Todas as filiais" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__todas__">Todas as filiais</SelectItem>
                              {filiais.map((f) => (
                                <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Data inicial</Label>
                          <Input type="date" value={filtroDataInicioPending} onChange={(e) => setFiltroDataInicioPending(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Data final</Label>
                          <Input type="date" value={filtroDataFimPending} onChange={(e) => setFiltroDataFimPending(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 h-9"
                          onClick={() => {
                            setFiltroFilialPending("");
                            setFiltroDataInicioPending("");
                            setFiltroDataFimPending("");
                          }}
                        >
                          Limpar
                        </Button>
                        <Button
                          type="button"
                          className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={() => void aplicarFiltros()}
                        >
                          Filtrar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <button
                    type="button"
                    onClick={onNovoDocumento}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary w-full sm:w-auto"
                    title="Novo documento"
                    aria-label="Novo documento"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>Novo documento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSalvar()}
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
              {activeTab === "movimentacao" ? (
              <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">{form.id ? "Editando movimentação" : "Nova movimentação"}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 justify-items-center">
                  <div className="space-y-1.5 w-full sm:w-[220px]">
                    <Label>Número de Documento</Label>
                    <Input readOnly value={form.docNumPreview} className="bg-muted font-mono tabular-nums" />
                  </div>
                  <div className="space-y-1.5 w-full sm:w-[220px]">
                    <Label>Filial</Label>
                    <Select
                      value={form.filialNome || "__placeholder_filial__"}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          filialNome: v === "__placeholder_filial__" ? "" : v,
                          codigoTunel: "",
                          codigoTipoProduto: "",
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione a filial" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__placeholder_filial__" disabled>Selecione a filial</SelectItem>
                        {filiais.map((f) => (
                          <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 w-full sm:w-[220px]">
                    <Label>Código do túnel utilizado</Label>
                    <Select
                      value={form.codigoTunel || "__placeholder_tunel__"}
                      onValueChange={(v) => setForm((p) => ({ ...p, codigoTunel: v === "__placeholder_tunel__" ? "" : v }))}
                      disabled={!form.filialNome}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o tunel" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__placeholder_tunel__" disabled>Selecione o tunel</SelectItem>
                        {tuneisDaFilial.map((t) => (
                          <SelectItem key={t.id} value={String(t.code)}>
                            {String(t.code).padStart(4, "0")} - {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/40 overflow-x-auto">
                  <div className="p-2 sm:p-3 border-b border-border/40 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => setMovRows((prev) => [...prev, createMovRow()])}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar linha
                    </Button>
                  </div>
                  <Table className="min-w-[64rem]">
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-bold whitespace-nowrap">Tipo de produto</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Qtd. inserida</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Data fechamento</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Hora fechamento</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Data abertura</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Hora abertura</TableHead>
                        <TableHead className="font-bold whitespace-nowrap min-w-[22rem]">Observação</TableHead>
                        <TableHead className="font-bold whitespace-nowrap text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movRows.map((row, idx) => (
                      <TableRow key={row.rowId}>
                        <TableCell className="align-top">
                          <Select
                            value={row.codigoTipoProduto || "__placeholder_tipo__"}
                            onValueChange={(v) =>
                              setMovRows((prev) =>
                                prev.map((r) => (r.rowId === row.rowId ? { ...r, codigoTipoProduto: v === "__placeholder_tipo__" ? "" : v } : r))
                              )
                            }
                            disabled={!form.filialNome}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__placeholder_tipo__" disabled>Selecione o tipo</SelectItem>
                              {tiposDaFilial.map((t) => (
                                <SelectItem key={t.id} value={String(t.code)}>
                                  {String(t.code).padStart(4, "0")} - {t.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            inputMode="decimal"
                            placeholder="0,0000"
                            value={row.qtdInserida}
                            onChange={(e) =>
                              setMovRows((prev) => prev.map((r) => (r.rowId === row.rowId ? { ...r, qtdInserida: e.target.value } : r)))
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="date"
                            value={row.dataFechamento}
                            onChange={(e) =>
                              setMovRows((prev) => prev.map((r) => (r.rowId === row.rowId ? { ...r, dataFechamento: e.target.value } : r)))
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="14:10"
                            value={row.horaFechamento}
                            onChange={(e) =>
                              setMovRows((prev) =>
                                prev.map((r) =>
                                  r.rowId === row.rowId ? { ...r, horaFechamento: formatHoraFechamentoInput(e.target.value) } : r
                                )
                              )
                            }
                            onBlur={() => {
                              setMovRows((prev) => prev.map((r) => {
                                if (r.rowId !== row.rowId) return r;
                                const v = r.horaFechamento.trim();
                                if (!v) return r;
                                const [hRaw, mRaw = ""] = v.split(":");
                                const h = Math.min(23, Math.max(0, Number(hRaw || 0)));
                                const m = Math.min(59, Math.max(0, Number(mRaw || 0)));
                                return { ...r, horaFechamento: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="date"
                            value={row.dataAbertura}
                            onChange={(e) =>
                              setMovRows((prev) => prev.map((r) => (r.rowId === row.rowId ? { ...r, dataAbertura: e.target.value } : r)))
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="14:10"
                            value={row.horaAbertura}
                            onChange={(e) =>
                              setMovRows((prev) =>
                                prev.map((r) =>
                                  r.rowId === row.rowId ? { ...r, horaAbertura: formatHoraFechamentoInput(e.target.value) } : r
                                )
                              )
                            }
                            onBlur={() => {
                              setMovRows((prev) => prev.map((r) => {
                                if (r.rowId !== row.rowId) return r;
                                const v = r.horaAbertura.trim();
                                if (!v) return r;
                                const [hRaw, mRaw = ""] = v.split(":");
                                const h = Math.min(23, Math.max(0, Number(hRaw || 0)));
                                const m = Math.min(59, Math.max(0, Number(mRaw || 0)));
                                return { ...r, horaAbertura: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell className="align-top min-w-[22rem]">
                          <Input
                            type="text"
                            placeholder="Observação da linha"
                            className="min-w-[20rem]"
                            value={row.observacao}
                            onChange={(e) =>
                              setMovRows((prev) =>
                                prev.map((r) => (r.rowId === row.rowId ? { ...r, observacao: e.target.value } : r))
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() =>
                              setMovRows((prev) => {
                                if (prev.length <= 1) return [createMovRow()];
                                return prev.filter((r) => r.rowId !== row.rowId);
                              })
                            }
                            aria-label="Excluir linha"
                            title="Excluir linha"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">Nenhuma movimentação encontrada.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Documentos no período: {filtroDataInicio || "início"} até {filtroDataFim || "hoje"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rows.map((row, index) => (
                      <button
                        type="button"
                        key={row.id}
                        className="group relative rounded-xl border border-border/50 bg-card/95 hover:border-primary/40 hover:bg-muted/60 hover:shadow-md transition-all duration-300 p-4 sm:p-5 cursor-pointer text-left"
                        onClick={() => {
                          setActiveTab("movimentacao");
                          onEditar(row);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex min-w-[3.5rem] sm:min-w-[4rem] shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary py-1.5">
                            <span className="text-[10px] font-bold leading-tight">N°</span>
                            <span className="text-sm font-bold tabular-nums">{index + 1}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">de {rows.length}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{row.filialNome || "Sem filial"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{fmtDateLabel(row.dataAbertura)}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono truncate">Doc. {padDoc(row.numeroDocumento)}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">
                              Túnel {String(row.codigoTunel).padStart(4, "0")} · Tipo {String(row.codigoTipoProduto).padStart(4, "0")} · Qtd {fmtNum(row.qtdInserida)}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="group relative rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-muted/60 hover:border-primary/60 transition-all duration-300 p-4 sm:p-5 cursor-pointer flex flex-col items-center justify-center min-h-[100px]"
                      onClick={() => {
                        onNovoDocumento();
                        setActiveTab("movimentacao");
                      }}
                    >
                      <FilePlus className="h-8 w-8 text-primary mb-2" />
                      <span className="text-sm font-semibold text-primary">Novo documento</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "movimentacao" && loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : null}
            </CardContent>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
