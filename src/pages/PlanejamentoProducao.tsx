import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Loader2, Factory, Save, Clock } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import {
  getOcppByDateRange,
  createOcpp,
  updateOcpp,
  deleteOcpp,
  getFiliais,
  getLines,
  getItemByCode,
  type OCPPRow,
  type OCPPInsertPayload,
} from "@/services/supabaseData";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatDateBr(str: string): string {
  if (!str) return "—";
  const s = str.split("T")[0];
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const formatNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === "" || value === 0) return "";
  if (typeof value === "number") {
    const parts = value.toString().split(".");
    const integerPart = parts[0];
    const decimalPart = parts[1] || "";
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
  }
  const cleaned = String(value).replace(/\./g, "").replace(",", ".");
  const numValue = parseFloat(cleaned);
  if (isNaN(numValue) || numValue === 0) return "";
  const parts = numValue.toString().split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1] || "";
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
};

/** Opções fixas para o campo Tipo Fruto (sem tabela no Supabase). */
const TIPO_FRUTO_OPCOES = ["Açaí", "Fruto"] as const;

const parseFormattedNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number" && !isNaN(value)) return value;
  const s = String(value).trim();
  if (!s) return 0;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const formatTotal = (value: number): string => {
  const numValue = value || 0;
  const parts = numValue.toFixed(2).split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1] || "00";
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedInteger},${decimalPart}`;
};

const emptyPayload = (data: string): OCPPInsertPayload => ({
  data,
  op: "",
  filial_nome: null,
  Code: null,
  descricao: "",
  unidade: "",
  grupo: "",
  quantidade: 0,
  quantidade_latas: 0,
  previsao_latas: 0,
  quantidade_kg: 0,
  tipo_fruto: "",
  tipo_linha: "",
  unidade_base: "",
  unidade_chapa: "",
  solidos: null,
  solid: null,
  quantidade_kg_tuneo: 0,
  quantidade_liquida_prevista: 0,
  cort_solid: "",
  t_cort: "",
  quantidade_basqueta: 0,
  quantidade_chapa: 0,
  latas: 0,
  estrutura: "",
  basqueta: "",
  chapa: "",
  tuneo: "",
  qual_maquina: "",
  mao_de_obra: "",
  utilidade: "",
  estoque: "",
  timbragem: "",
  corte_reprocesso: "",
  observacao: "",
});

type LineOption = { id: number; code: string; name: string };

export default function PlanejamentoProducao() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const hoje = new Date().toISOString().split("T")[0];
  const [dataFiltro, setDataFiltro] = useState(hoje);
  const [filiais, setFiliais] = useState<Array<{ id: number; codigo: string; nome: string }>>([]);
  const [filialFiltro, setFilialFiltro] = useState<string>("");
  const [productionLines, setProductionLines] = useState<LineOption[]>([]);
  const [registros, setRegistros] = useState<OCPPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const codeLookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getFiliais()
      .then(setFiliais)
      .catch((e) => console.error("Erro ao carregar filiais:", e));
    getLines()
      .then((lines) => setProductionLines(lines.map((l) => ({ id: l.id, code: String(l.code ?? ""), name: String(l.name ?? "") }))))
      .catch((e) => console.error("Erro ao carregar linhas:", e));
  }, []);

  const loadRegistros = useCallback(async () => {
    const de = dataFiltro.split("T")[0];
    if (!de) return;
    setLoading(true);
    try {
      const list = await getOcppByDateRange(de, de, filialFiltro || undefined);
      setRegistros(list);
    } catch (e) {
      console.error("Erro ao carregar OCPP:", e);
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao carregar planejamento",
        variant: "destructive",
      });
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [dataFiltro, filialFiltro, toast]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  const registrosExibidos: OCPPRow[] =
    filialFiltro && registros.length > 0
      ? registros.filter((r) => (r.filial_nome || "").trim() === filialFiltro)
      : registros ?? [];

  /** Atualiza um registro no banco e no estado local (sem recarregar a tabela nem mostrar loading). Preserva zeros à esquerda do código. */
  const updateRow = async (id: number, payload: Partial<OCPPInsertPayload>) => {
    try {
      const updated = await updateOcpp(id, payload);
      setRegistros((prev) =>
        prev.map((r) => (r.id === id ? { ...updated, Code: payload.Code !== undefined ? payload.Code : r.Code ?? updated.Code } : r))
      );
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao atualizar",
        variant: "destructive",
      });
    }
  };

  const setRowField = useCallback((id: number, field: keyof OCPPRow, value: unknown) => {
    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }, []);

  /** Busca item na OCTI pelo código e preenche descrição, unidade e grupo (só ao sair do campo). Atualiza a UI na hora e persiste no banco. */
  const fetchItemAndFillRow = useCallback(
    async (rowId: number, codeVal: string) => {
      const payload: Partial<OCPPInsertPayload> = { Code: codeVal || null };
      if (codeVal) {
        let item: Awaited<ReturnType<typeof getItemByCode>> = null;
        try {
          item = await getItemByCode(codeVal);
        } catch (e) {
          console.error("Erro ao buscar item na OCTI:", e);
          toast({
            title: "Erro ao buscar item",
            description: e instanceof Error ? e.message : "Verifique a tabela OCTI e a conexão.",
            variant: "destructive",
          });
        }
        if (item) {
          payload.descricao = item.nome_item ?? "";
          payload.unidade = item.unidade_medida ?? "";
          payload.grupo = item.grupo_itens ?? "";
          // Atualizar a UI imediatamente (antes de salvar)
          setRegistros((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? { ...r, descricao: payload.descricao ?? "", unidade: payload.unidade ?? "", grupo: payload.grupo ?? "" }
                : r
            )
          );
        } else {
          // Item não encontrado: limpar descrição, unidade e grupo
          payload.descricao = "";
          payload.unidade = "";
          payload.grupo = "";
          setRegistros((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, descricao: "", unidade: "", grupo: "" } : r))
          );
        }
      } else {
        payload.descricao = "";
        payload.unidade = "";
        payload.grupo = "";
        setRegistros((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, descricao: "", unidade: "", grupo: "" } : r))
        );
      }
      try {
        const updated = await updateOcpp(rowId, payload);
        setRegistros((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? { ...updated, Code: prev.find((x) => x.id === rowId)?.Code ?? (codeVal || updated.Code) }
              : r
          )
        );
      } catch (e) {
        toast({
          title: "Erro ao salvar",
          description: e instanceof Error ? e.message : "Erro ao atualizar registro",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const CODE_LOOKUP_DEBOUNCE_MS = 500;

  /** Ao digitar no campo Código: após parar de digitar, busca na OCTI e preenche descrição, unidade e grupo (sem precisar sair do campo). */
  const handleCodeChange = useCallback(
    (row: OCPPRow, value: string) => {
      setRowField(row.id, "Code", value || null);
      if (codeLookupTimeoutRef.current) {
        clearTimeout(codeLookupTimeoutRef.current);
        codeLookupTimeoutRef.current = null;
      }
      const codeVal = (value ?? "").trim();
      if (!codeVal) {
        fetchItemAndFillRow(row.id, "");
        return;
      }
      codeLookupTimeoutRef.current = setTimeout(() => {
        codeLookupTimeoutRef.current = null;
        fetchItemAndFillRow(row.id, codeVal);
      }, CODE_LOOKUP_DEBOUNCE_MS);
    },
    [setRowField, fetchItemAndFillRow]
  );

  /** Ao sair do campo Código: cancela o debounce e busca na OCTI na hora. */
  const handleCodeBlur = useCallback(
    (row: OCPPRow, codeStr: string) => {
      const codeVal = (codeStr ?? "").trim();
      if (codeLookupTimeoutRef.current) {
        clearTimeout(codeLookupTimeoutRef.current);
        codeLookupTimeoutRef.current = null;
      }
      fetchItemAndFillRow(row.id, codeVal);
    },
    [fetchItemAndFillRow]
  );

  /** Converte uma linha (OCPPRow) em payload para update. */
  const rowToPayload = useCallback((row: OCPPRow): Partial<OCPPInsertPayload> => ({
    data: row.data ?? "",
    op: row.op ?? null,
    Code: row.Code ?? null,
    descricao: row.descricao ?? null,
    unidade: row.unidade ?? null,
    grupo: row.grupo ?? null,
    quantidade: row.quantidade ?? 0,
    quantidade_latas: row.quantidade_latas ?? 0,
    previsao_latas: row.previsao_latas ?? 0,
    quantidade_kg: row.quantidade_kg ?? 0,
    tipo_fruto: row.tipo_fruto ?? null,
    tipo_linha: row.tipo_linha ?? null,
    unidade_base: row.unidade_base ?? null,
    unidade_chapa: row.unidade_chapa ?? null,
    solidos: row.solidos ?? null,
    solid: row.solid ?? null,
    quantidade_kg_tuneo: row.quantidade_kg_tuneo ?? 0,
    quantidade_liquida_prevista: row.quantidade_liquida_prevista ?? 0,
    cort_solid: row.cort_solid ?? null,
    t_cort: row.t_cort ?? null,
    quantidade_basqueta: row.quantidade_basqueta ?? 0,
    quantidade_chapa: row.quantidade_chapa ?? 0,
    latas: row.latas ?? 0,
    estrutura: row.estrutura ?? null,
    basqueta: row.basqueta ?? null,
    chapa: row.chapa ?? null,
    tuneo: row.tuneo ?? null,
    qual_maquina: row.qual_maquina ?? null,
    mao_de_obra: row.mao_de_obra ?? null,
    utilidade: row.utilidade ?? null,
    estoque: row.estoque ?? null,
    timbragem: row.timbragem ?? null,
    corte_reprocesso: row.corte_reprocesso ?? null,
    observacao: row.observacao ?? null,
  }), []);

  /** Salva todas as linhas exibidas no banco. */
  const handleSaveAll = useCallback(async () => {
    const rowsToSave = registrosExibidos.filter((r) => r.id != null && Number.isFinite(r.id));
    if (rowsToSave.length === 0) {
      toast({ title: "Nada para salvar", description: "Não há linhas para salvar.", variant: "destructive" });
      return;
    }
    setSavingAll(true);
    try {
      for (const row of rowsToSave) {
        const updated = await updateOcpp(row.id, rowToPayload(row));
        setRegistros((prev) =>
          prev.map((r) => (r.id === row.id ? { ...updated, Code: row.Code ?? updated.Code } : r))
        );
      }
      toast({ title: "Salvo", description: `${rowsToSave.length} linha(s) atualizada(s).` });
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : "Erro ao atualizar registros",
        variant: "destructive",
      });
    } finally {
      setSavingAll(false);
    }
  }, [registrosExibidos, rowToPayload, toast]);

  useEffect(() => {
    return () => {
      if (codeLookupTimeoutRef.current) clearTimeout(codeLookupTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const addLinha = async () => {
    const payload = emptyPayload(dataFiltro.split("T")[0]);
    if (filialFiltro) payload.filial_nome = filialFiltro;
    try {
      setSavingId(-1);
      const newRow = await createOcpp(payload);
      setRegistros((prev) => [...prev, newRow]);
      toast({ title: "Linha adicionada", description: "Registro incluído." });
    } catch (e) {
      toast({
        title: "Erro ao adicionar",
        description: e instanceof Error ? e.message : "Erro ao adicionar linha",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este registro do planejamento?")) return;
    try {
      await deleteOcpp(id);
      setRegistros((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Excluído", description: "Registro removido." });
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao excluir",
        variant: "destructive",
      });
    }
  };

  const calcularTotais = () => {
    const totalQuantidade = registrosExibidos.reduce((sum, r) => sum + (r.quantidade ?? 0), 0);
    const totalLatas = registrosExibidos.reduce((sum, r) => sum + (r.quantidade_latas ?? 0), 0);
    const totalPrevisaoLatas = registrosExibidos.reduce((sum, r) => sum + (r.previsao_latas ?? 0), 0);
    const totalKg = registrosExibidos.reduce((sum, r) => sum + (r.quantidade_kg ?? 0), 0);
    return { totalQuantidade, totalLatas, totalPrevisaoLatas, totalKg };
  };

  return (
    <AppLayout>
      <div className="space-y-6 min-w-0 pt-4 sm:pt-6">
        {/* Voltar — mesma estrutura do Acompanhamento diário */}
        <div className="mt-2 mb-2 flex items-center justify-between gap-2 flex-shrink-0 min-h-[3.5rem]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/analise-producao")}
            className="size-11 min-h-[44px] min-w-[44px] rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-accent hover:border-primary/30 hover:shadow-md shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5 text-foreground shrink-0" strokeWidth={2.5} />
          </Button>
        </div>

        {/* Card principal — mesmo estilo do Acompanhamento diário da produção */}
        <div className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />
          <div className="relative z-10">
            {/* Cabeçalho do card */}
            <div className="relative w-full flex flex-col gap-4 p-4 sm:p-6 lg:p-8 transition-all duration-500 bg-gradient-to-r from-transparent via-primary/2 to-transparent min-[892px]:flex-row min-[892px]:items-center min-[892px]:justify-between">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-5 min-w-0 order-1 max-[891px]:flex-col max-[891px]:items-center max-[891px]:text-center max-[891px]:gap-4">
                <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] border border-primary/30 backdrop-blur-sm">
                  <Factory className="relative h-7 w-7 text-primary drop-shadow-lg" />
                </div>
                <div className="text-left space-y-2 min-w-0 flex-1 w-full max-[891px]:text-center">
                  <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    Planejamento de produção (PCP)
                  </h2>
                  <p className="text-sm text-muted-foreground/80 font-medium">
                    Planeje e controle a produção (PCP)
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1 max-[891px]:items-center max-[891px]:justify-center flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary/70" />
                      <span className="text-sm sm:text-base font-mono font-semibold text-primary">
                        {formatTime(currentTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DatePicker
                        value={dataFiltro}
                        onChange={(v) => v && setDataFiltro(v)}
                        placeholder="Data"
                        className="min-w-[140px]"
                        triggerClassName="border border-input bg-background hover:bg-muted/60 px-2 py-1 min-h-0 h-auto text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={filialFiltro || "__todas__"}
                        onValueChange={(v) => setFilialFiltro(v === "__todas__" ? "" : v)}
                      >
                        <SelectTrigger id="filial-select" className="w-full min-w-[160px] sm:w-[220px] h-9 text-sm">
                          <SelectValue placeholder="Todas as filiais" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todas__">Todas as filiais</SelectItem>
                          {filiais.map((f) => (
                            <SelectItem key={f.id} value={(f.nome || "").trim()}>
                              {f.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Mobile: botões abaixo */}
                  <div className="flex flex-col gap-2 w-full min-[892px]:hidden pt-2 items-center max-w-sm mx-auto">
                    <button
                      type="button"
                      onClick={() => handleSaveAll()}
                      disabled={savingAll || registrosExibidos.length === 0}
                      className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingAll ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
                      <span>{savingAll ? "Salvando..." : "Salvar"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={addLinha}
                      disabled={savingId === -1}
                      className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingId === -1 ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Plus className="h-4 w-4 shrink-0" />}
                      <span>Adicionar Linha</span>
                    </button>
                  </div>
                </div>
              </div>
              {/* Desktop: botões à direita */}
              <div className="hidden min-[892px]:flex flex-wrap items-center gap-2 order-2">
                <button
                  type="button"
                  onClick={() => handleSaveAll()}
                  disabled={savingAll || registrosExibidos.length === 0}
                  className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAll ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
                  <span>{savingAll ? "Salvando..." : "Salvar"}</span>
                </button>
                <button
                  type="button"
                  onClick={addLinha}
                  disabled={savingId === -1}
                  className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingId === -1 ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Plus className="h-4 w-4 shrink-0" />}
                  <span>Adicionar Linha</span>
                </button>
              </div>
            </div>
          </div>

          {/* Área do conteúdo (tabela) — mesma borda e fundo do Acompanhamento diário */}
          <div className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-4 sm:p-5 lg:p-7">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0 rounded-lg border border-border/40 [&::-webkit-scrollbar]:h-2" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="inline-block min-w-full align-middle">
                <Table className="min-w-[2200px] sm:min-w-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 sm:w-16 text-center text-xs sm:text-sm">N°</TableHead>
                      <TableHead className="min-w-[100px] text-xs sm:text-sm">Data</TableHead>
                      <TableHead className="min-w-[140px] text-xs sm:text-sm">OP</TableHead>
                      <TableHead className="min-w-[140px] text-xs sm:text-sm">Código</TableHead>
                      <TableHead className="min-w-[420px] text-xs sm:text-sm">Descrição</TableHead>
                      <TableHead className="min-w-[70px] text-xs sm:text-sm">Unidade</TableHead>
                      <TableHead className="min-w-[220px] text-xs sm:text-sm">Grupo</TableHead>
                      <TableHead className="min-w-[90px] text-xs sm:text-sm text-center">Quantidade</TableHead>
                      <TableHead className="min-w-[90px] text-xs sm:text-sm text-center">Qtd. Latas</TableHead>
                      <TableHead className="min-w-[95px] text-xs sm:text-sm text-center">Previsão Latas</TableHead>
                      <TableHead className="min-w-[75px] text-xs sm:text-sm text-center">Qtd. Kg</TableHead>
                      <TableHead className="min-w-[90px] text-xs sm:text-sm">Tipo Fruto</TableHead>
                      <TableHead className="min-w-[200px] text-xs sm:text-sm">Tipo Linha</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Un. Base</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Un. Chapa</TableHead>
                      <TableHead className="min-w-[70px] text-xs sm:text-sm text-center">Solidos</TableHead>
                      <TableHead className="min-w-[60px] text-xs sm:text-sm text-center">Solid</TableHead>
                      <TableHead className="min-w-[85px] text-xs sm:text-sm text-center">Qtd. Kg Túneo</TableHead>
                      <TableHead className="min-w-[95px] text-xs sm:text-sm text-center">Qtd. Liq. Prev.</TableHead>
                      <TableHead className="min-w-[75px] text-xs sm:text-sm">Cort Solid</TableHead>
                      <TableHead className="min-w-[65px] text-xs sm:text-sm">T. Cort</TableHead>
                      <TableHead className="min-w-[85px] text-xs sm:text-sm text-center">Qtd. Basqueta</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm text-center">Qtd. Chapa</TableHead>
                      <TableHead className="min-w-[60px] text-xs sm:text-sm text-center">Latas</TableHead>
                      <TableHead className="min-w-[100px] text-xs sm:text-sm">Estrutura</TableHead>
                      <TableHead className="min-w-[90px] text-xs sm:text-sm">Basqueta</TableHead>
                      <TableHead className="min-w-[90px] text-xs sm:text-sm">Chapa</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Túneo</TableHead>
                      <TableHead className="min-w-[100px] text-xs sm:text-sm">Máquina</TableHead>
                      <TableHead className="min-w-[100px] text-xs sm:text-sm">Mão de Obra</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Utilidade</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Estoque</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Timbragem</TableHead>
                      <TableHead className="min-w-[100px] text-xs sm:text-sm">Corte Reprocesso</TableHead>
                      <TableHead className="min-w-[140px] text-xs sm:text-sm">Observação</TableHead>
                      <TableHead className="w-12 sm:w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrosExibidos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={36} className="text-center py-8 text-muted-foreground">
                          Nenhum registro para esta data/filial. Clique em &quot;Adicionar Linha&quot; para incluir.
                        </TableCell>
                      </TableRow>
                    ) : (
                      registrosExibidos.map((row, idx) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-center font-medium text-xs sm:text-sm">{idx + 1}</TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <DatePicker
                              value={row.data?.split("T")[0] ?? dataFiltro}
                              onChange={(v) => v && updateRow(row.id, { data: v })}
                              size="sm"
                              triggerClassName="h-8 sm:h-9 text-xs sm:text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 min-w-[140px]">
                            <Input
                              value={row.op ?? ""}
                              onChange={(e) => setRowField(row.id, "op", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { op: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-[120px]"
                              placeholder="OP"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 min-w-[140px]">
                            <Input
                              value={row.Code != null ? String(row.Code) : ""}
                              onChange={(e) => handleCodeChange(row, e.target.value ?? "")}
                              onBlur={(e) => handleCodeBlur(row, e.target.value ?? "")}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-[120px]"
                              placeholder="Código"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 min-w-[420px]">
                            <Input
                              value={row.descricao ?? ""}
                              onChange={(e) => setRowField(row.id, "descricao", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { descricao: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-[400px]"
                              placeholder="Descrição"
                              title={row.descricao ?? undefined}
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.unidade ?? ""}
                              onChange={(e) => setRowField(row.id, "unidade", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { unidade: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full"
                              placeholder="Un."
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 min-w-[220px]">
                            <Input
                              value={row.grupo ?? ""}
                              onChange={(e) => setRowField(row.id, "grupo", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { grupo: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-[200px]"
                              placeholder="Grupo"
                              title={row.grupo ?? undefined}
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.quantidade != null && row.quantidade !== 0 ? formatNumber(row.quantidade) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "quantidade", parseFormattedNumber(v) || 0);
                              }}
                              onBlur={(e) => updateRow(row.id, { quantidade: parseFormattedNumber(e.target.value) || 0 })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center min-w-[7rem]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.quantidade_latas != null && row.quantidade_latas !== 0 ? formatNumber(row.quantidade_latas) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "quantidade_latas", parseFormattedNumber(v) || 0);
                              }}
                              onBlur={(e) => updateRow(row.id, { quantidade_latas: parseFormattedNumber(e.target.value) || 0 })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center min-w-[7rem]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.previsao_latas != null && row.previsao_latas !== 0 ? formatNumber(row.previsao_latas) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "previsao_latas", parseFormattedNumber(v) || 0);
                              }}
                              onBlur={(e) => updateRow(row.id, { previsao_latas: parseFormattedNumber(e.target.value) || 0 })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center min-w-[7rem]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.quantidade_kg != null && row.quantidade_kg !== 0 ? formatNumber(row.quantidade_kg) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "quantidade_kg", parseFormattedNumber(v) || 0);
                              }}
                              onBlur={(e) => updateRow(row.id, { quantidade_kg: parseFormattedNumber(e.target.value) || 0 })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center min-w-[7rem]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={(row.tipo_fruto || "").trim() || "__vazio__"}
                              onValueChange={(v) => updateRow(row.id, { tipo_fruto: v === "__vazio__" ? "" : v })}
                            >
                              <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm min-w-[7rem]">
                                <SelectValue placeholder="Tipo fruto" />
                              </SelectTrigger>
                              <SelectContent className="text-xs sm:text-sm">
                                <SelectItem value="__vazio__">—</SelectItem>
                                {TIPO_FRUTO_OPCOES.map((op) => (
                                  <SelectItem key={op} value={op}>{op}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            {productionLines.length > 0 ? (
                              <div className="min-w-[200px]">
                                <Select
                                  value={(row.tipo_linha || "").trim() || "__vazio__"}
                                  onValueChange={(v) => updateRow(row.id, { tipo_linha: v === "__vazio__" ? "" : v })}
                                >
                                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm min-w-[200px]">
                                    <SelectValue placeholder="Linha" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-72 text-xs sm:text-sm">
                                    <SelectItem value="__vazio__">—</SelectItem>
                                    {productionLines.map((line) => (
                                      <SelectItem key={line.id} value={line.code?.trim() || line.name?.trim() || `line-${line.id}`}>
                                        {line.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <Input
                                value={row.tipo_linha ?? ""}
                                onChange={(e) => setRowField(row.id, "tipo_linha", e.target.value)}
                                onBlur={(e) => updateRow(row.id, { tipo_linha: e.target.value })}
                                className="h-8 sm:h-9 text-xs sm:text-sm min-w-[200px]"
                                placeholder="Tipo linha"
                              />
                            )}
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.unidade_base ?? ""}
                              onChange={(e) => setRowField(row.id, "unidade_base", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { unidade_base: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Un. base"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.unidade_chapa ?? ""}
                              onChange={(e) => setRowField(row.id, "unidade_chapa", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { unidade_chapa: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Un. chapa"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.solidos != null ? formatNumber(row.solidos) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "solidos", v === "" ? null : parseFormattedNumber(v));
                              }}
                              onBlur={(e) => updateRow(row.id, { solidos: e.target.value === "" ? null : parseFormattedNumber(e.target.value) })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-0"
                              placeholder="—"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.solid != null ? formatNumber(row.solid) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "solid", v === "" ? null : parseFormattedNumber(v));
                              }}
                              onBlur={(e) => updateRow(row.id, { solid: e.target.value === "" ? null : parseFormattedNumber(e.target.value) })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-0"
                              placeholder="—"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.quantidade_kg_tuneo != null && row.quantidade_kg_tuneo !== 0 ? formatNumber(row.quantidade_kg_tuneo) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "quantidade_kg_tuneo", parseFormattedNumber(v) || 0);
                              }}
                              onBlur={(e) => updateRow(row.id, { quantidade_kg_tuneo: parseFormattedNumber(e.target.value) || 0 })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-0"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.quantidade_liquida_prevista != null && row.quantidade_liquida_prevista !== 0 ? formatNumber(row.quantidade_liquida_prevista) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "quantidade_liquida_prevista", parseFormattedNumber(v) || 0);
                              }}
                              onBlur={(e) => updateRow(row.id, { quantidade_liquida_prevista: parseFormattedNumber(e.target.value) || 0 })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-0"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.cort_solid ?? ""}
                              onChange={(e) => setRowField(row.id, "cort_solid", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { cort_solid: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Cort/Solid"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.t_cort ?? ""}
                              onChange={(e) => setRowField(row.id, "t_cort", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { t_cort: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="T. Cort"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.quantidade_basqueta != null && row.quantidade_basqueta !== 0 ? formatNumber(row.quantidade_basqueta) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "quantidade_basqueta", parseFormattedNumber(v) || 0);
                              }}
                              onBlur={(e) => updateRow(row.id, { quantidade_basqueta: parseFormattedNumber(e.target.value) || 0 })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-0"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.quantidade_chapa != null && row.quantidade_chapa !== 0 ? formatNumber(row.quantidade_chapa) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "quantidade_chapa", parseFormattedNumber(v) || 0);
                              }}
                              onBlur={(e) => updateRow(row.id, { quantidade_chapa: parseFormattedNumber(e.target.value) || 0 })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-0"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              value={row.latas != null && row.latas !== 0 ? formatNumber(row.latas) : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setRowField(row.id, "latas", parseFormattedNumber(v) || 0);
                              }}
                              onBlur={(e) => updateRow(row.id, { latas: parseFormattedNumber(e.target.value) || 0 })}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-0"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.estrutura ?? ""}
                              onChange={(e) => setRowField(row.id, "estrutura", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { estrutura: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Estrutura"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.basqueta ?? ""}
                              onChange={(e) => setRowField(row.id, "basqueta", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { basqueta: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Basqueta"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.chapa ?? ""}
                              onChange={(e) => setRowField(row.id, "chapa", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { chapa: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Chapa"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.tuneo ?? ""}
                              onChange={(e) => setRowField(row.id, "tuneo", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { tuneo: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Túneo"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.qual_maquina ?? ""}
                              onChange={(e) => setRowField(row.id, "qual_maquina", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { qual_maquina: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Máquina"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.mao_de_obra ?? ""}
                              onChange={(e) => setRowField(row.id, "mao_de_obra", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { mao_de_obra: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Mão de obra"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.utilidade ?? ""}
                              onChange={(e) => setRowField(row.id, "utilidade", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { utilidade: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Utilidade"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.estoque ?? ""}
                              onChange={(e) => setRowField(row.id, "estoque", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { estoque: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Estoque"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.timbragem ?? ""}
                              onChange={(e) => setRowField(row.id, "timbragem", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { timbragem: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Timbragem"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.corte_reprocesso ?? ""}
                              onChange={(e) => setRowField(row.id, "corte_reprocesso", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { corte_reprocesso: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Corte reprocesso"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.observacao ?? ""}
                              onChange={(e) => setRowField(row.id, "observacao", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { observacao: e.target.value })}
                              className="h-8 sm:h-9 text-xs sm:text-sm"
                              placeholder="Observação"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(row.id)}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}

                    {registrosExibidos.length > 0 && (() => {
                      const totais = calcularTotais();
                      return (
                        <TableRow className="bg-muted/50 hover:bg-muted/50 font-bold border-t-2 border-border/70">
                          <TableCell colSpan={7} className="text-right text-xs sm:text-sm font-bold pr-4">
                            Total
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <div className="flex h-8 sm:h-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                              {formatTotal(totais.totalQuantidade)}
                            </div>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <div className="flex h-8 sm:h-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                              {formatTotal(totais.totalLatas)}
                            </div>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <div className="flex h-8 sm:h-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                              {formatTotal(totais.totalPrevisaoLatas)}
                            </div>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <div className="flex h-8 sm:h-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                              {formatTotal(totais.totalKg)}
                            </div>
                          </TableCell>
                          <TableCell colSpan={25} />
                        </TableRow>
                      );
                    })()}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
