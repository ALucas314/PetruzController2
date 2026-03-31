import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
  Factory,
  Save,
  Clock,
  FilePlus,
  Filter,
  Package,
  ClipboardList,
  Layers,
  Weight,
  Box,
  LayoutGrid,
  Scissors,
  ArrowDownToLine,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ExportToPng } from "@/components/ExportToPng";
import { DatePicker } from "@/components/ui/date-picker";
import {
  addCalendarDays,
  getOcppByDateRange,
  getOcppDateBounds,
  createOcpp,
  getNextOcppDocIdentity,
  updateOcpp,
  deleteOcpp,
  getFiliais,
  getLines,
  getItemByCode,
  subscribeOCPPRealtime,
  REALTIME_COLLAPSE_MS,
  REALTIME_SUPPRESS_OWN_WRITE_MS,
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
import { FILIAL_PLACEHOLDER_LABEL, FILIAL_PLACEHOLDER_VALUE, sortFiliaisByNome } from "@/lib/filialSelect";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDocumentNav } from "@/contexts/DocumentNavContext";
import { useIsMobile } from "@/hooks/use-mobile";

function formatDateBr(str: string): string {
  if (!str) return "—";
  const s = str.split("T")[0];
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function toDateOnly(v: unknown): string {
  if (typeof v === "string") return v.split("T")[0] ?? "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().split("T")[0] ?? "";
  return "";
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

const formatNumberFixed = (value: number | string | null | undefined, fractionDigits: number): string => {
  if (value === null || value === undefined || value === "" || value === 0) return "";
  const num = typeof value === "number"
    ? value
    : parseFloat(String(value).replace(/\./g, "").replace(",", "."));
  if (!isFinite(num) || num === 0) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

/** Opções fixas para o campo Tipo Fruto (sem tabela no Supabase). */
const TIPO_FRUTO_OPCOES = ["Açaí", "Fruto"] as const;

/** Perfis para o campo Solidos (armazenado como número na OCPP: 1=Popular, 2=Médio, 3=Especial, 4=Frutas). */
const SOLIDOS_PERFIS = [
  { value: 1, label: "Popular" },
  { value: 2, label: "Médio" },
  { value: 3, label: "Especial" },
  { value: 4, label: "Frutas" },
] as const;

/** Opções para colunas de status (Estrutura, Basqueta, Chapa, etc.): —, PEND, OK. OK exibe verde. */
const PEND_OK_OPCOES = [
  { value: "__vazio__", label: "—" },
  { value: "PEND", label: "PEND" },
  { value: "OK", label: "OK" },
] as const;

/** Após alterar a grade só no estado local, adia recarga via realtime da OCPP (evita sumir com o que ainda não foi gravado). */
const PLANNING_REALTIME_QUIET_MS = 5000;

/** Qtd. Liq. Prev. = Qtd. Latas × Solid, arredondado ao kg inteiro (ex.: 14999,936 → 15.000). */
function calcQtdLiqPrev(latas: number, solid: number | null): number {
  const s = solid ?? 0;
  return Math.round(latas * s);
}

/**
 * Cort Solid (igual ao Excel): =SEERRO([@[Prev. Latas]]*[@Solid];" ")
 * Coluna da planilha = `previsao_latas` × Solid; arredondamento em kg inteiro como Qtd. Liq. Prev.
 */
function calcCortSolid(prevLatasColuna: number, solid: number | null): number {
  const s = solid ?? 0;
  return Math.round(prevLatasColuna * s);
}

/** Calcula Previsão Latas a partir de Qtd. Kg e Tipo fruto: Açaí = Qtd. Kg / 14, Fruto = Qtd. Kg / 1. */
function calcPrevisaoLatasFromTipoFruto(quantidadeKg: number, tipoFruto: string): number {
  const kg = quantidadeKg ?? 0;
  if (!kg) return 0;
  const t = (tipoFruto ?? "").trim();
  if (t === "Açaí") return Math.floor((kg / 14) * 100) / 100;
  if (t === "Fruto") return Math.floor((kg / 1) * 100) / 100;
  return 0;
}

/** Converte valor de Cort Solid (string "385,6" ou "385.6") em número. */
function parseCortSolidValue(stored: string | null | undefined): number {
  const s = (stored ?? "").trim();
  if (!s) return 0;
  return s.includes(",") ? parseFormattedNumber(s) : parseFloat(s) || 0;
}

/** T. Cort = Cort Solid − Qtd. Liq. Prev. (2 decimais). */
function calcTCort(cortSolid: number, qtdLiqPrev: number): number {
  return Number((cortSolid - qtdLiqPrev).toFixed(2));
}

/** Calcula Qtd. Basqueta = Qtd. Kg Túneo / Uni. Basqueta (inteiro, arredondamento para cima). Uni. Basqueta é string (ex.: "22"). */
function calcQtdBasqueta(quantidadeKgTuneo: number, unidadeBase: string | null | undefined): number {
  const uni = parseFormattedNumber(unidadeBase ?? "");
  if (uni === 0) return 0;
  return Math.ceil(quantidadeKgTuneo / uni);
}

/** Calcula Qtd. Chapa = Qtd. Basqueta × Uni. Chapa (inteiro, arredondamento para cima). Uni. Chapa é string (ex.: "8"). */
function calcQtdChapa(quantidadeBasqueta: number, unidadeChapa: string | null | undefined): number {
  const uni = parseFormattedNumber(unidadeChapa ?? "");
  return Math.ceil(quantidadeBasqueta * uni);
}

/** Verifica se o tipo de linha indica 100 gramas (ex.: "100G", "100G Simples", "100gramas"). */
function is100Gramas(tipoLinha: string): boolean {
  const s = (tipoLinha ?? "").trim().toLowerCase();
  if (!s) return false;
  return /100\s*g(\s|ramas|$)/.test(s) || s.includes("100g") || (s.includes("100") && s.includes("gramas"));
}

/** Mix - Pote: Uni. Basqueta 6, Uni. Chapa 0. */
function isMixPote(tipoLinha: string): boolean {
  const s = (tipoLinha ?? "").trim().toLowerCase();
  if (!s) return false;
  return s.includes("mix") && s.includes("pote");
}

/** Verifica se o tipo de linha indica 1Kg (Uni. Basqueta 12, Uni. Chapa 2). */
function is1Kg(tipoLinha: string): boolean {
  const s = (tipoLinha ?? "").trim().toLowerCase();
  if (!s) return false;
  return s === "1kg" || s.includes("1kg") || /^1\s*kg$/i.test(s);
}

/** Verifica se o tipo de linha indica 5 Kg (Uni. Basqueta 10, sem Uni. Chapa). */
function is5Kg(tipoLinha: string): boolean {
  const s = (tipoLinha ?? "").trim().toLowerCase();
  if (!s) return false;
  return s === "5kg" || s.includes("5kg") || /\b5\s*kg\b/i.test(tipoLinha.trim());
}

/** Verifica se o tipo de linha indica Cubos (Uni. Basqueta 22, sem Uni. Chapa). */
function isCubos(tipoLinha: string): boolean {
  const s = (tipoLinha ?? "").trim().toLowerCase();
  return s.includes("cubos");
}

/** Verifica se o tipo de linha indica Sticker (Uni. Basqueta 10, Uni. Chapa 3). */
function isSticker(tipoLinha: string): boolean {
  const s = (tipoLinha ?? "").trim().toLowerCase();
  if (!s) return false;
  return s === "sticker" || s.includes("sticker");
}

/** 4 soldas: Uni. Basqueta 4, Uni. Chapa 6. */
function is4Soldas(tipoLinha: string): boolean {
  const s = (tipoLinha ?? "").trim().toLowerCase();
  if (!s) return false;
  return /\b4\s*soldas\b/.test(s);
}

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

const MIN_ITEM_CODE_LENGTH = 5;

function normalizeItemCode(value: string | number | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw) && raw.length < MIN_ITEM_CODE_LENGTH) {
    return raw.padStart(MIN_ITEM_CODE_LENGTH, "0");
  }
  return raw;
}

function isValidItemCode(value: string | number | null | undefined): boolean {
  const code = normalizeItemCode(value);
  return code.length === 0 || code.length >= MIN_ITEM_CODE_LENGTH;
}

/** Cadastro PCP: só BELA (Iaca) ou Petruz — nomes completos vêm da OCTF. */
function isFilialBelaOuPetruz(nome: string | null | undefined): boolean {
  const n = String(nome ?? "").trim().toUpperCase();
  if (!n) return false;
  return n.includes("BELA") || n.includes("PETRUZ");
}

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

function getLinhaRuleUnitsFor(tipoLinha: string | null | undefined, productionLines: LineOption[]): { unidadeBase: string; unidadeChapa: string } | null {
  const tipoLinhaVal = (tipoLinha ?? "").trim();
  if (!tipoLinhaVal) return null;
  const lineByName = productionLines.find((l) => (l.code?.trim() || l.name?.trim() || `line-${l.id}`) === tipoLinhaVal);
  const nomeLinhaParaRegra = lineByName?.name ?? tipoLinhaVal;
  if (is100Gramas(nomeLinhaParaRegra)) return { unidadeBase: "6", unidadeChapa: "4" };
  if (isMixPote(nomeLinhaParaRegra)) return { unidadeBase: "6", unidadeChapa: "0" };
  if (is1Kg(nomeLinhaParaRegra)) return { unidadeBase: "12", unidadeChapa: "2" };
  if (is5Kg(nomeLinhaParaRegra)) return { unidadeBase: "10", unidadeChapa: "0" };
  if (isCubos(nomeLinhaParaRegra)) return { unidadeBase: "22", unidadeChapa: "0" };
  if (isSticker(nomeLinhaParaRegra)) return { unidadeBase: "10", unidadeChapa: "3" };
  if (is4Soldas(nomeLinhaParaRegra)) return { unidadeBase: "4", unidadeChapa: "6" };
  return null;
}

function normalizeRowUnitsAndDerivedFor(row: OCPPRow, productionLines: LineOption[]): OCPPRow {
  const rule = getLinhaRuleUnitsFor(row.tipo_linha, productionLines);
  const unidadeBaseAtual = (row.unidade_base ?? "").trim();
  const unidadeChapaAtual = (row.unidade_chapa ?? "").trim();
  const unidadeBaseNumerica = parseFormattedNumber(unidadeBaseAtual) > 0;
  const unidadeChapaNumerica = parseFormattedNumber(unidadeChapaAtual) > 0 || unidadeChapaAtual === "0";
  const unidadeBase = unidadeBaseNumerica ? unidadeBaseAtual : (rule?.unidadeBase ?? unidadeBaseAtual);
  const unidadeChapa = unidadeChapaNumerica ? unidadeChapaAtual : (rule?.unidadeChapa ?? unidadeChapaAtual);
  const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, unidadeBase);
  const qtdChapa = calcQtdChapa(qtdBasqueta, unidadeChapa);
  return {
    ...row,
    Code: normalizeItemCode(row.Code),
    unidade_base: unidadeBase,
    unidade_chapa: unidadeChapa,
    quantidade_basqueta: qtdBasqueta,
    quantidade_chapa: qtdChapa,
  };
}

/** Colunas da tabela do dashboard PCP: id, label e função que indica se a célula está "vazia" (para filtrar itens). */
const DASHBOARD_TABLE_COLUMNS: Array<{ id: string; label: string; isEmpty: (row: OCPPRow) => boolean }> = [
  { id: "op", label: "OP", isEmpty: (r) => !(r.op ?? "").toString().trim() },
  { id: "codigo", label: "Código", isEmpty: (r) => !(r.Code ?? "").toString().trim() },
  { id: "descricao", label: "Descrição", isEmpty: (r) => !(r.descricao ?? "").toString().trim() },
  { id: "unidade", label: "Unidade", isEmpty: (r) => !(r.unidade ?? "").toString().trim() },
  { id: "grupo", label: "Grupo", isEmpty: (r) => !(r.grupo ?? "").toString().trim() },
  { id: "quantidade", label: "Quantidade", isEmpty: (r) => (r.quantidade ?? 0) === 0 },
  { id: "tipo_linha", label: "Tipo Linha", isEmpty: (r) => !(r.tipo_linha ?? "").toString().trim() },
  { id: "tipo_fruto", label: "Tipo Fruto", isEmpty: (r) => !(r.tipo_fruto ?? "").toString().trim() },
  { id: "solidos", label: "Sólidos", isEmpty: (r) => r.solidos == null },
  { id: "previsao_latas", label: "Previsão Latas", isEmpty: (r) => (r.previsao_latas ?? 0) === 0 },
  { id: "qtd_latas", label: "Qtd. Latas", isEmpty: (r) => (r.quantidade_latas ?? 0) === 0 && !(((r.tipo_fruto ?? "").trim() === "Açaí" || (r.tipo_fruto ?? "").trim() === "Fruto") && (r.quantidade_kg ?? 0) > 0) },
  { id: "qtd_kg", label: "Qtd em Kg", isEmpty: (r) => (r.quantidade_kg ?? 0) === 0 },
  { id: "qtd_basq", label: "Qtd. Basq", isEmpty: (r) => (r.quantidade_basqueta ?? 0) === 0 },
  { id: "qtd_chapa", label: "Qtd. Chapa", isEmpty: (r) => (r.quantidade_chapa ?? 0) === 0 },
  { id: "t_cort", label: "T. Cort", isEmpty: (r) => !(r.t_cort ?? "").toString().trim() },
  { id: "entrada_tunel", label: "Entrada no Túnel (Kg)", isEmpty: (r) => (r.quantidade_kg_tuneo ?? 0) === 0 },
];

export default function PlanejamentoProducao() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const cardCaptureRef = useRef<HTMLDivElement | null>(null);
  const kpiCaptureEndRef = useRef<HTMLDivElement | null>(null);
  const [hidePngButtonDuringCapture, setHidePngButtonDuringCapture] = useState(false);
  const captureOriginalStylesRef = useRef<{ height: string; overflow: string } | null>(null);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  const hoje = new Date().toISOString().split("T")[0];
  const [dataFiltro, setDataFiltro] = useState(hoje);
  const [dataFiltroPara, setDataFiltroPara] = useState(hoje);
  const [filiais, setFiliais] = useState<Array<{ id: number; codigo: string; nome: string }>>([]);
  const filiaisBelaOuPetruz = useMemo(
    () => sortFiliaisByNome(filiais.filter((f) => isFilialBelaOuPetruz(f.nome))),
    [filiais]
  );
  const [filialFiltro, setFilialFiltro] = useState<string>("");
  const [productionLines, setProductionLines] = useState<LineOption[]>([]);
  const [filtroCodigo, setFiltroCodigo] = useState("");
  const [filtroTipoLinha, setFiltroTipoLinha] = useState("");
  const [filtroSolidos, setFiltroSolidos] = useState<number | "">("");
  const [filtrosCardOpen, setFiltrosCardOpen] = useState(false);
  /** View do card: grid de documentos (true) ou tabela do documento (false). Inicia em tabela; após Filtrar abre o grid do período. */
  const [showDocumentGridForRange, setShowDocumentGridForRange] = useState(false);
  /** Documento selecionado no grid (chave: data + doc_ordem_global + doc_numero + filial). */
  const [selectedDocKey, setSelectedDocKey] = useState<string | null>(null);
  /** Valores dos filtros dentro do card (só aplicados ao clicar em "Filtrar"). */
  const [dataFiltroPending, setDataFiltroPending] = useState(hoje);
  const [dataFiltroParaPending, setDataFiltroParaPending] = useState(hoje);
  const [filtrosCardMesmaDataPending, setFiltrosCardMesmaDataPending] = useState(false);
  const [filtroCodigoPending, setFiltroCodigoPending] = useState("");
  const [filtroTipoLinhaPending, setFiltroTipoLinhaPending] = useState("");
  const [filtroSolidosPending, setFiltroSolidosPending] = useState<number | "">("");
  const [filialFiltroPending, setFilialFiltroPending] = useState("");
  const [registros, setRegistros] = useState<OCPPRow[]>([]);
  const [registrosNavegacao, setRegistrosNavegacao] = useState<OCPPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  /** Mantém o texto digitado (com vírgula) nos campos numéricos até o blur, para permitir digitar "142,85". */
  const [editingNumeric, setEditingNumeric] = useState<{ rowId: number; field: string; value: string } | null>(null);
  const editingNumericRef = useRef(editingNumeric);
  editingNumericRef.current = editingNumeric;
  /** Ao clicar em "Novo documento", guarda o próximo número (ex.: 2) para exibir "2 de 2" no header até carregar de novo. */
  const [newDocumentIndex, setNewDocumentIndex] = useState<number | null>(null);
  /** Filial do novo documento (ao clicar em "Novo documento"); alterar aqui não dispara filtro. */
  const [filialNovoDocumento, setFilialNovoDocumento] = useState<string>("");
  const codeLookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCodeByRowRef = useRef<Record<number, string>>({});
  const isMobile = useIsMobile();
  /** Marca o momento da última alteração feita por este usuário; evita recarregar ao receber o próprio evento realtime. */
  const lastLocalChangeAtRef = useRef(0);
  /** Enquanto `Date.now()` for menor que este valor, o realtime não recarrega a lista (edição local / foco em célula). */
  const planningRealtimeQuietUntilRef = useRef(0);
  /** Timeout do debounce do realtime para não recarregar a cada tecla. */
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** doc_numero/doc_ordem_global reutilizados em todas as linhas do mesmo "Novo documento" até recarregar. */
  const pendingNovoDocIdentityRef = useRef<{ doc_numero: number; doc_ordem_global: number } | null>(null);
  const { setDocumentNav } = useDocumentNav();

  // --- Estado do Dashboard PCP (acima do card) ---
  const [dashboardDateFrom, setDashboardDateFrom] = useState(hoje);
  const [dashboardDateTo, setDashboardDateTo] = useState(hoje);
  const [dashboardUnidade, setDashboardUnidade] = useState("");
  const [dashboardGrupo, setDashboardGrupo] = useState("");
  const [dashboardTipoLinha, setDashboardTipoLinha] = useState("");
  const [dashboardTipoFruto, setDashboardTipoFruto] = useState("");
  const [dashboardOpCode, setDashboardOpCode] = useState("");
  const [dashboardData, setDashboardData] = useState<OCPPRow[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false);
  const [dashboardDateFromPending, setDashboardDateFromPending] = useState(hoje);
  const [dashboardDateToPending, setDashboardDateToPending] = useState(hoje);
  const [dashboardMesmaDataPending, setDashboardMesmaDataPending] = useState(false);
  const [dashboardUnidadePending, setDashboardUnidadePending] = useState("");
  const [dashboardGrupoPending, setDashboardGrupoPending] = useState("");
  const [dashboardTipoLinhaPending, setDashboardTipoLinhaPending] = useState("");
  const [dashboardTipoFrutoPending, setDashboardTipoFrutoPending] = useState("");
  const [dashboardOpCodePending, setDashboardOpCodePending] = useState("");
  const [dashboardItemCode, setDashboardItemCode] = useState("");
  const [dashboardItemCodePending, setDashboardItemCodePending] = useState("");
  /** Colunas visíveis na tabela do dashboard (id -> visível). Padrão: todas visíveis. */
  const [dashboardVisibleColumns, setDashboardVisibleColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DASHBOARD_TABLE_COLUMNS.map((c) => [c.id, true]))
  );
  /** Ocultar itens em que estas colunas estejam vazias (id -> ocultar quando vazio). Padrão: nenhuma. */
  const [dashboardHideWhenEmptyColumns, setDashboardHideWhenEmptyColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DASHBOARD_TABLE_COLUMNS.map((c) => [c.id, false]))
  );
  const [dashboardVisibleColumnsPending, setDashboardVisibleColumnsPending] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DASHBOARD_TABLE_COLUMNS.map((c) => [c.id, true]))
  );
  const [dashboardHideWhenEmptyPending, setDashboardHideWhenEmptyPending] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DASHBOARD_TABLE_COLUMNS.map((c) => [c.id, false]))
  );

  const isEditing = (rowId: number, field: string) =>
    editingNumeric?.rowId === rowId && editingNumeric?.field === field;
  const getNumericDisplay = (row: OCPPRow, field: keyof OCPPRow, fallback: string) => {
    if (isEditing(row.id, field as string)) return editingNumeric!.value;
    const val = row[field];
    if (val == null || (typeof val === "number" && val === 0)) return fallback;
    return formatNumber(val as number);
  };

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
    const ate = (dataFiltroPara || dataFiltro).toString().split("T")[0];
    if (!de) return;
    const [dataInicio, dataFim] = de <= ate ? [de, ate] : [ate, de];
    setLoading(true);
    setNewDocumentIndex(null);
    try {
      const list = await getOcppByDateRange(dataInicio, dataFim, filialFiltro || undefined);
      if (list.length === 0) {
        const bounds = await getOcppDateBounds(filialFiltro || undefined);
        if (bounds.minDate && bounds.maxDate && (bounds.minDate !== dataInicio || bounds.maxDate !== dataFim)) {
          setDataFiltro(bounds.minDate);
          setDataFiltroPara(bounds.maxDate);
          setDataFiltroPending(bounds.minDate);
          setDataFiltroParaPending(bounds.maxDate);
          return;
        }
      }
      setRegistros(list.map((row) => normalizeRowUnitsAndDerivedFor(row, productionLines)));
    } catch (e) {
      console.error("Erro ao carregar OCPP:", e);
      toastRef.current({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao carregar planejamento",
        variant: "destructive",
      });
      setRegistros([]);
    } finally {
      pendingNovoDocIdentityRef.current = null;
      setLoading(false);
    }
  }, [dataFiltro, dataFiltroPara, filialFiltro, productionLines]);

  /** Carrega todos os registros (independente da data filtrada) para navegação no header com setas. */
  const loadRegistrosNavegacao = useCallback(async () => {
    try {
      const bounds = await getOcppDateBounds(filialFiltro || undefined);
      if (!bounds.minDate || !bounds.maxDate) {
        setRegistrosNavegacao([]);
        return;
      }
      const list = await getOcppByDateRange(bounds.minDate, bounds.maxDate, filialFiltro || undefined);
      setRegistrosNavegacao(list.map((row) => normalizeRowUnitsAndDerivedFor(row, productionLines)));
    } catch (e) {
      console.error("Erro ao carregar navegação PCP:", e);
      setRegistrosNavegacao([]);
    }
  }, [filialFiltro, productionLines]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  useEffect(() => {
    loadRegistrosNavegacao();
  }, [loadRegistrosNavegacao]);

  useEffect(() => {
    if (registros.length === 0 || productionLines.length === 0) return;
    setRegistros((prev) => prev.map((row) => normalizeRowUnitsAndDerivedFor(row, productionLines)));
  }, [productionLines]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Continua bloqueando realtime enquanto o usuário edita uma célula numérica (valor só vai para `registros` no blur). */
  useEffect(() => {
    if (editingNumeric != null) {
      planningRealtimeQuietUntilRef.current = Date.now() + PLANNING_REALTIME_QUIET_MS;
    }
  }, [editingNumeric]);

  /** Sincronização em tempo real OCPP: mesmo padrão da bi-horária (debounce curto + ignorar eco do próprio save neste aparelho). */
  useEffect(() => {
    const unsubscribe = subscribeOCPPRealtime(() => {
      const now = Date.now();
      if (now < planningRealtimeQuietUntilRef.current) return;
      if (editingNumericRef.current != null) return;
      if (codeLookupTimeoutRef.current != null) return;
      if (now - lastLocalChangeAtRef.current < REALTIME_SUPPRESS_OWN_WRITE_MS) return;
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(() => {
        realtimeDebounceRef.current = null;
        const t = Date.now();
        if (t < planningRealtimeQuietUntilRef.current) return;
        if (editingNumericRef.current != null) return;
        if (codeLookupTimeoutRef.current != null) return;
        if (t - lastLocalChangeAtRef.current < REALTIME_SUPPRESS_OWN_WRITE_MS) return;
        loadRegistros();
      }, REALTIME_COLLAPSE_MS);
    });
    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      unsubscribe();
    };
  }, [loadRegistros]);

  /** Ao abrir o card de filtros, copia os valores aplicados para os campos pendentes. */
  useEffect(() => {
    if (filtrosCardOpen) {
      setDataFiltroPending(dataFiltro);
      setDataFiltroParaPending(dataFiltroPara);
      setFiltroCodigoPending(filtroCodigo);
      setFiltroTipoLinhaPending(filtroTipoLinha);
      setFiltroSolidosPending(filtroSolidos);
      setFilialFiltroPending(filialFiltro);
    }
  }, [filtrosCardOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- sync only when opening

  /** Aplica os filtros do card (pendentes) e fecha o card. Abre o grid de documentos do período; KPIs só somam após escolher um card. */
  const applyFiltrosCard = useCallback(() => {
    setDataFiltro(dataFiltroPending);
    setDataFiltroPara(dataFiltroParaPending);
    setFiltroCodigo(filtroCodigoPending);
    setFiltroTipoLinha(filtroTipoLinhaPending);
    setFiltroSolidos(filtroSolidosPending);
    setFilialFiltro(filialFiltroPending);
    setSelectedDocKey(null);
    setShowDocumentGridForRange(true);
    setFiltrosCardOpen(false);
  }, [dataFiltroPending, dataFiltroParaPending, filtroCodigoPending, filtroTipoLinhaPending, filtroSolidosPending, filialFiltroPending]);

  /** Carrega dados do dashboard PCP (intervalo de datas). */
  const loadDashboardData = useCallback(async () => {
    const de = toDateOnly(dashboardDateFrom);
    const ate = toDateOnly(dashboardDateTo);
    if (!de) return;
    const [dataInicio, dataFim] = de <= ate ? [de, ate] : [ate, de];
    setDashboardLoading(true);
    try {
      const list = await getOcppByDateRange(dataInicio, dataFim);
      setDashboardData(list);
    } catch (e) {
      console.error("Erro ao carregar dashboard PCP:", e);
      toastRef.current({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao carregar dados do dashboard",
        variant: "destructive",
      });
      setDashboardData([]);
    } finally {
      setDashboardLoading(false);
    }
  }, [dashboardDateFrom, dashboardDateTo]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  /** Ao abrir o dialog de filtros do dashboard, sincroniza valores pendentes. */
  useEffect(() => {
    if (dashboardFiltersOpen) {
      setDashboardDateFromPending(dashboardDateFrom);
      setDashboardDateToPending(dashboardDateTo);
      setDashboardUnidadePending(dashboardUnidade);
      setDashboardGrupoPending(dashboardGrupo);
      setDashboardTipoLinhaPending(dashboardTipoLinha);
      setDashboardTipoFrutoPending(dashboardTipoFruto);
      setDashboardOpCodePending(dashboardOpCode);
      setDashboardItemCodePending(dashboardItemCode);
      setDashboardVisibleColumnsPending({ ...dashboardVisibleColumns });
      setDashboardHideWhenEmptyPending({ ...dashboardHideWhenEmptyColumns });
    }
  }, [dashboardFiltersOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Aplica filtros do dashboard e fecha o dialog. */
  const applyDashboardFilters = useCallback(() => {
    setDashboardDateFrom(dashboardDateFromPending);
    setDashboardDateTo(dashboardDateToPending);
    setDashboardUnidade(dashboardUnidadePending);
    setDashboardGrupo(dashboardGrupoPending);
    setDashboardTipoLinha(dashboardTipoLinhaPending);
    setDashboardTipoFruto(dashboardTipoFrutoPending);
    setDashboardOpCode(dashboardOpCodePending);
    setDashboardItemCode(dashboardItemCodePending);
    setDashboardVisibleColumns({ ...dashboardVisibleColumnsPending });
    setDashboardHideWhenEmptyColumns({ ...dashboardHideWhenEmptyPending });
    setDashboardFiltersOpen(false);
  }, [dashboardDateFromPending, dashboardDateToPending, dashboardUnidadePending, dashboardGrupoPending, dashboardTipoLinhaPending, dashboardTipoFrutoPending, dashboardOpCodePending, dashboardItemCodePending, dashboardVisibleColumnsPending, dashboardHideWhenEmptyPending]);

  /** Dados do dashboard após filtros (client-side). Inclui filtro "ocultar itens com colunas vazias". */
  const dashboardFiltered: OCPPRow[] = useMemo(() => {
    let list = dashboardData;
    const u = (dashboardUnidade ?? "").trim();
    if (u) list = list.filter((r) => (r.unidade ?? "").trim().toLowerCase() === u.toLowerCase());
    const g = (dashboardGrupo ?? "").trim();
    if (g) list = list.filter((r) => (r.grupo ?? "").trim().toLowerCase() === g.toLowerCase());
    const tl = (dashboardTipoLinha ?? "").trim();
    if (tl) list = list.filter((r) => (r.tipo_linha ?? "").trim().toLowerCase() === tl.toLowerCase());
    const tf = (dashboardTipoFruto ?? "").trim();
    if (tf) list = list.filter((r) => (r.tipo_fruto ?? "").trim().toLowerCase() === tf.toLowerCase());
    const op = (dashboardOpCode ?? "").trim();
    if (op) list = list.filter((r) => (r.op ?? "").trim().toLowerCase().includes(op.toLowerCase()));
    const itemCode = (dashboardItemCode ?? "").trim();
    if (itemCode) list = list.filter((r) => `${r.Code ?? ""}`.toLowerCase().includes(itemCode.toLowerCase()));
    const hideWhenEmpty = dashboardHideWhenEmptyColumns;
    const colsToHide = DASHBOARD_TABLE_COLUMNS.filter((c) => hideWhenEmpty[c.id]);
    if (colsToHide.length > 0) {
      list = list.filter((row) => !colsToHide.some((c) => c.isEmpty(row)));
    }
    return list;
  }, [dashboardData, dashboardUnidade, dashboardGrupo, dashboardTipoLinha, dashboardTipoFruto, dashboardOpCode, dashboardItemCode, dashboardHideWhenEmptyColumns]);

  /** Totais do dashboard. Previsão Latas: só soma valor manual (no cenário Açaí/Fruto+Qtd.Kg não conta). Qtd. Latas: soma valor exibido (inclui calculado). */
  const dashboardTotals = useMemo(() => {
    const qtd = dashboardFiltered.length;
    if (qtd === 0) {
      return { quantidade: 0, quantidade_latas: 0, previsao_latas: 0, latas: 0, quantidade_kg: 0, quantidade_basqueta: 0, quantidade_chapa: 0, t_cort: 0, quantidade_kg_tuneo: 0 };
    }
    let quantidade = 0, quantidade_latas = 0, previsao_latas = 0, latas = 0, quantidade_kg = 0, quantidade_basqueta = 0, quantidade_chapa = 0, t_cort = 0, quantidade_kg_tuneo = 0;
    dashboardFiltered.forEach((r) => {
      quantidade += r.quantidade ?? 0;
      const tf = (r.tipo_fruto ?? "").trim();
      const kg = r.quantidade_kg ?? 0;
      const isCalculado = (tf === "Açaí" || tf === "Fruto") && kg > 0;
      previsao_latas += r.previsao_latas ?? 0;
      const qtdLatasRow = isCalculado
        ? ((r.quantidade_latas ?? 0) !== 0 ? (r.quantidade_latas ?? 0) : calcPrevisaoLatasFromTipoFruto(kg, tf))
        : (r.quantidade_latas ?? 0);
      quantidade_latas += qtdLatasRow;
      latas += r.latas ?? 0;
      quantidade_kg += kg;
      quantidade_basqueta += r.quantidade_basqueta ?? 0;
      quantidade_chapa += r.quantidade_chapa ?? 0;
      quantidade_kg_tuneo += r.quantidade_kg_tuneo ?? 0;
      t_cort += parseCortSolidValue(r.t_cort);
    });
    return { quantidade, quantidade_latas, previsao_latas, latas, quantidade_kg, quantidade_basqueta, quantidade_chapa, t_cort, quantidade_kg_tuneo };
  }, [dashboardFiltered]);

  /** Colunas do dashboard visíveis atualmente (ordem preservada). */
  const dashboardVisibleColsList = useMemo(
    () => DASHBOARD_TABLE_COLUMNS.filter((c) => dashboardVisibleColumns[c.id] !== false),
    [dashboardVisibleColumns]
  );

  /** Opções únicas para filtros do dashboard (Unidade, Grupo, Tipo Linha, Tipo Fruto). */
  const dashboardFilterOptions = useMemo(() => {
    const unidadeSet = new Set<string>();
    const grupoSet = new Set<string>();
    const tipoLinhaSet = new Set<string>();
    const tipoFrutoSet = new Set<string>();
    dashboardData.forEach((r) => {
      const u = (r.unidade ?? "").trim();
      if (u) unidadeSet.add(u);
      const g = (r.grupo ?? "").trim();
      if (g) grupoSet.add(g);
      const tl = (r.tipo_linha ?? "").trim();
      if (tl) tipoLinhaSet.add(tl);
      const tf = (r.tipo_fruto ?? "").trim();
      if (tf) tipoFrutoSet.add(tf);
    });
    return {
      unidades: Array.from(unidadeSet).sort(),
      grupos: Array.from(grupoSet).sort(),
      tipoLinhas: Array.from(tipoLinhaSet).sort(),
      tipoFrutos: Array.from(tipoFrutoSet).sort(),
    };
  }, [dashboardData]);

  /** Lista base após filtro de filial (para opções de Tipo Linha e filtros). */
  const registrosBaseFilial: OCPPRow[] = filialFiltro && registros.length > 0
    ? registros.filter((r) => (r.filial_nome || "").trim() === filialFiltro)
    : registros ?? [];

  /** Documento = data + identificadores SAP + filial. Sem a data, linhas de dias diferentes com o mesmo doc_numero/null viravam um único documento. */
  const getDocKey = useCallback((r: OCPPRow) => {
    const day =
      r.data != null && String(r.data).trim() !== "" ? String(r.data).split("T")[0] : "null";
    const ord = r.doc_ordem_global != null ? String(r.doc_ordem_global) : "null";
    const num = r.doc_numero != null ? String(r.doc_numero) : "null";
    const filial = (r.filial_nome || "").trim() || "null";
    return `${day}|${ord}|${num}|${filial}`;
  }, []);

  const documentosDoPeriodo = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        data_dia: string;
        doc_numero: number | null;
        doc_ordem_global: number | null;
        filial_nome: string | null;
        rows: OCPPRow[];
      }
    >();
    registrosBaseFilial.forEach((r) => {
      const key = getDocKey(r);
      const day =
        r.data != null && String(r.data).trim() !== "" ? String(r.data).split("T")[0] : "";
      const existing = map.get(key);
      if (existing) existing.rows.push(r);
      else {
        map.set(key, {
          key,
          data_dia: day,
          doc_numero: r.doc_numero ?? null,
          doc_ordem_global: r.doc_ordem_global ?? null,
          filial_nome: r.filial_nome ?? null,
          rows: [r],
        });
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const cmpData = (a.data_dia || "").localeCompare(b.data_dia || "");
      if (cmpData !== 0) return cmpData;
      const an = a.doc_numero ?? 0;
      const bn = b.doc_numero ?? 0;
      if (an !== bn) return an - bn;
      const ao = a.doc_ordem_global ?? 0;
      const bo = b.doc_ordem_global ?? 0;
      return ao - bo;
    });
    return list;
  }, [registrosBaseFilial, getDocKey]);

  /** Cabeçalho: contexto de filial (não altera filtro; filtro de filiais só no card Filtros). */
  const filialExibicaoHeader = useMemo(() => {
    if (selectedDocKey) {
      const doc = documentosDoPeriodo.find((d) => d.key === selectedDocKey);
      const nome = (doc?.filial_nome ?? "").trim();
      return nome || "—";
    }
    return filialFiltro ? filialFiltro : "Todas as filiais";
  }, [selectedDocKey, documentosDoPeriodo, filialFiltro]);

  const documentosParaNavegacao = useMemo(() => {
    const base = filialFiltro && registrosNavegacao.length > 0
      ? registrosNavegacao.filter((r) => (r.filial_nome || "").trim() === filialFiltro)
      : registrosNavegacao;
    const map = new Map<
      string,
      {
        key: string;
        data_dia: string;
        doc_numero: number | null;
        doc_ordem_global: number | null;
        filial_nome: string | null;
        rows: OCPPRow[];
      }
    >();
    base.forEach((r) => {
      const key = getDocKey(r);
      const day = r.data != null && String(r.data).trim() !== "" ? String(r.data).split("T")[0] : "";
      const existing = map.get(key);
      if (existing) existing.rows.push(r);
      else map.set(key, {
        key,
        data_dia: day,
        doc_numero: r.doc_numero ?? null,
        doc_ordem_global: r.doc_ordem_global ?? null,
        filial_nome: r.filial_nome ?? null,
        rows: [r],
      });
    });
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const cmpData = (a.data_dia || "").localeCompare(b.data_dia || "");
      if (cmpData !== 0) return cmpData;
      const an = a.doc_numero ?? 0;
      const bn = b.doc_numero ?? 0;
      if (an !== bn) return an - bn;
      const ao = a.doc_ordem_global ?? 0;
      const bo = b.doc_ordem_global ?? 0;
      return ao - bo;
    });
    return list;
  }, [registrosNavegacao, filialFiltro, getDocKey]);

  const documentosParaNavegacaoRef = useRef(documentosParaNavegacao);
  documentosParaNavegacaoRef.current = documentosParaNavegacao;
  const selectedDocKeyNavRef = useRef<string | null>(selectedDocKey);
  selectedDocKeyNavRef.current = selectedDocKey;

  /**
   * Com a tabela aberta: garante documento selecionado para KPIs/rodapé.
   * Com o grid aberto (após Filtrar): não força seleção — o usuário escolhe o card.
   */
  useEffect(() => {
    if (loading) return;
    if (newDocumentIndex != null) return;
    if (documentosDoPeriodo.length === 0) {
      setSelectedDocKey(null);
      return;
    }
    if (showDocumentGridForRange) return;
    const valid = selectedDocKey != null && documentosDoPeriodo.some((d) => d.key === selectedDocKey);
    if (valid) return;
    const last = documentosDoPeriodo[documentosDoPeriodo.length - 1];
    setSelectedDocKey(last.key);
  }, [loading, documentosDoPeriodo, newDocumentIndex, selectedDocKey, showDocumentGridForRange]);

  /** Valores únicos de tipo_linha nos registros carregados, para o filtro bater com o que está salvo (ex.: código ou "Balde"). */
  const opcoesTipoLinhaFiltro = useMemo(() => {
    const set = new Set<string>();
    registrosBaseFilial.forEach((r) => {
      const t = (r.tipo_linha ?? "").trim();
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [registrosBaseFilial]);

  /** Retorna o nome da linha para exibição no filtro (em vez do código). */
  const getNomeLinhaParaFiltro = useCallback((valorSalvo: string) => {
    const v = (valorSalvo ?? "").trim();
    if (!v) return v;
    const line = productionLines.find((l) => (l.code ?? "").trim() === v || (l.name ?? "").trim() === v);
    return line?.name || line?.code || v;
  }, [productionLines]);

  const registrosExibidos: OCPPRow[] = (() => {
    let list = registrosBaseFilial;
    if (selectedDocKey) list = list.filter((r) => getDocKey(r) === selectedDocKey);
    const codigoTrim = (filtroCodigo ?? "").trim().toLowerCase();
    if (codigoTrim) list = list.filter((r) => String(r.Code ?? "").toLowerCase().includes(codigoTrim));
    const tipoLinhaTrim = (filtroTipoLinha ?? "").trim();
    if (tipoLinhaTrim) list = list.filter((r) => (r.tipo_linha ?? "").trim().toLowerCase() === tipoLinhaTrim.toLowerCase());
    if (filtroSolidos !== "" && filtroSolidos != null) list = list.filter((r) => r.solidos === filtroSolidos);
    return list;
  })();

  /**
   * Totais para os KPIs do planejamento: mesma regra da linha de totais do dashboard PCP (Personalizado),
   * aplicada às linhas exibidas (data, filial, documento selecionado e filtros do card).
   */
  const planejamentoKpiTotals = useMemo(() => {
    const emptyTotals = {
      quantidade: 0,
      quantidade_latas: 0,
      previsao_latas: 0,
      quantidade_kg: 0,
      quantidade_basqueta: 0,
      quantidade_chapa: 0,
      t_cort: 0,
      quantidade_kg_tuneo: 0,
    };
    if (!selectedDocKey) return emptyTotals;

    let list = registrosBaseFilial.filter((r) => getDocKey(r) === selectedDocKey);
    const codigoTrim = (filtroCodigo ?? "").trim().toLowerCase();
    if (codigoTrim) list = list.filter((r) => String(r.Code ?? "").toLowerCase().includes(codigoTrim));
    const tipoLinhaTrim = (filtroTipoLinha ?? "").trim();
    if (tipoLinhaTrim) list = list.filter((r) => (r.tipo_linha ?? "").trim().toLowerCase() === tipoLinhaTrim.toLowerCase());
    if (filtroSolidos !== "" && filtroSolidos != null) list = list.filter((r) => r.solidos === filtroSolidos);

    if (list.length === 0) return emptyTotals;
    let quantidade = 0,
      quantidade_latas = 0,
      previsao_latas = 0,
      quantidade_kg = 0,
      quantidade_basqueta = 0,
      quantidade_chapa = 0,
      t_cort = 0,
      quantidade_kg_tuneo = 0;
    list.forEach((r) => {
      quantidade += r.quantidade ?? 0;
      const tf = (r.tipo_fruto ?? "").trim();
      const kg = r.quantidade_kg ?? 0;
      const isCalculado = (tf === "Açaí" || tf === "Fruto") && kg > 0;
      previsao_latas += r.previsao_latas ?? 0;
      const qtdLatasRow = isCalculado
        ? ((r.quantidade_latas ?? 0) !== 0 ? (r.quantidade_latas ?? 0) : calcPrevisaoLatasFromTipoFruto(kg, tf))
        : (r.quantidade_latas ?? 0);
      quantidade_latas += qtdLatasRow;
      quantidade_kg += kg;
      quantidade_basqueta += r.quantidade_basqueta ?? 0;
      quantidade_chapa += r.quantidade_chapa ?? 0;
      quantidade_kg_tuneo += r.quantidade_kg_tuneo ?? 0;
      t_cort += parseCortSolidValue(r.t_cort);
    });
    return {
      quantidade,
      quantidade_latas,
      previsao_latas,
      quantidade_kg,
      quantidade_basqueta,
      quantidade_chapa,
      t_cort,
      quantidade_kg_tuneo,
    };
  }, [registrosBaseFilial, selectedDocKey, filtroCodigo, filtroTipoLinha, filtroSolidos, getDocKey]);

  /** Atualiza um registro no banco e no estado local (sem recarregar a tabela nem mostrar loading). Preserva zeros à esquerda do código. */
  const updateRow = async (id: number, payload: Partial<OCPPInsertPayload>) => {
    lastLocalChangeAtRef.current = Date.now();
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
    planningRealtimeQuietUntilRef.current = Date.now() + PLANNING_REALTIME_QUIET_MS;
    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }, []);

  /** Busca item na OCTI pelo código e preenche descrição, unidade, grupo, Uni. Basqueta e Uni. Chapa (a partir da unidade do item). Atualiza a UI na hora e persiste no banco. */
  const fetchItemAndFillRow = useCallback(
    async (rowId: number, codeVal: string) => {
      const normalizedCode = normalizeItemCode(codeVal);
      const latestCode = latestCodeByRowRef.current[rowId] ?? "";
      if (normalizedCode !== latestCode) return;
      if (!isValidItemCode(normalizedCode)) return;
      const payload: Partial<OCPPInsertPayload> = { Code: normalizedCode || null };
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
          const currentRow = registros.find((r) => r.id === rowId);
          const rule = getLinhaRuleUnitsFor(currentRow?.tipo_linha, productionLines);
          let unidadeBase = (currentRow?.unidade_base ?? "").trim();
          let unidadeChapa = (currentRow?.unidade_chapa ?? "").trim();
          if (rule) {
            unidadeBase = rule.unidadeBase;
            unidadeChapa = rule.unidadeChapa;
          }
          const qtdBasqueta = calcQtdBasqueta(currentRow?.quantidade_kg_tuneo ?? 0, unidadeBase);
          const qtdChapa = calcQtdChapa(qtdBasqueta, unidadeChapa);
          const unidade = (item as { unidade_medida?: string; U_Uom?: string; u_uom?: string }).unidade_medida
            ?? (item as { U_Uom?: string }).U_Uom
            ?? (item as { u_uom?: string }).u_uom
            ?? "";
          payload.descricao = (item as { nome_item?: string; Name?: string }).nome_item ?? (item as { Name?: string }).Name ?? "";
          payload.unidade = unidade;
          payload.grupo = (item as { grupo_itens?: string; U_ItemGroup?: string }).grupo_itens ?? (item as { U_ItemGroup?: string }).U_ItemGroup ?? "";
          payload.unidade_base = unidadeBase;
          payload.unidade_chapa = unidadeChapa;
          payload.quantidade_basqueta = qtdBasqueta;
          payload.quantidade_chapa = qtdChapa;
          // Atualizar a UI imediatamente (antes de salvar)
          setRegistros((prev) =>
            prev.map((r) =>
              r.id === rowId
                ? {
                    ...r,
                    descricao: payload.descricao ?? "",
                    unidade: payload.unidade ?? "",
                    grupo: payload.grupo ?? "",
                    unidade_base: payload.unidade_base ?? "",
                    unidade_chapa: payload.unidade_chapa ?? "",
                    quantidade_basqueta: payload.quantidade_basqueta ?? 0,
                    quantidade_chapa: payload.quantidade_chapa ?? 0,
                  }
                : r
            )
          );
        } else {
          // Item não encontrado: limpar descrição, unidade, grupo e unidades base/chapa
          payload.descricao = "";
          payload.unidade = "";
          payload.grupo = "";
          payload.unidade_base = "";
          payload.unidade_chapa = "";
          setRegistros((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, descricao: "", unidade: "", grupo: "", unidade_base: "", unidade_chapa: "" } : r))
          );
        }
      } else {
        payload.descricao = "";
        payload.unidade = "";
        payload.grupo = "";
        payload.unidade_base = "";
        payload.unidade_chapa = "";
        setRegistros((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, descricao: "", unidade: "", grupo: "", unidade_base: "", unidade_chapa: "" } : r))
        );
      }
      lastLocalChangeAtRef.current = Date.now();
      try {
        const updated = await updateOcpp(rowId, payload);
        const currentLatest = latestCodeByRowRef.current[rowId] ?? "";
        if (normalizeItemCode(codeVal) !== currentLatest) return;
        setRegistros((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? { ...updated, Code: (normalizedCode || prev.find((x) => x.id === rowId)?.Code) ?? updated.Code }
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
    [toast, registros, productionLines]
  );

  const CODE_LOOKUP_DEBOUNCE_MS = 500;

  /** Ao digitar no campo Código: após parar de digitar, busca na OCTI e preenche descrição, unidade e grupo (sem precisar sair do campo). */
  const handleCodeChange = useCallback(
    (row: OCPPRow, value: string) => {
      setRowField(row.id, "Code", value || null);
      latestCodeByRowRef.current[row.id] = normalizeItemCode(value);
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
      const codeVal = normalizeItemCode(codeStr);
      if (!isValidItemCode(codeVal)) {
        toast({
          title: "Código inválido",
          description: `O código do item deve ter no mínimo ${MIN_ITEM_CODE_LENGTH} caracteres.`,
          variant: "destructive",
        });
        return;
      }
      setRowField(row.id, "Code", codeVal || null);
      latestCodeByRowRef.current[row.id] = codeVal;
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
    Code: normalizeItemCode(row.Code),
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
    quantidade_liquida_prevista: (() => {
      const hasFormula = (row.quantidade_latas != null && row.quantidade_latas !== 0) && (row.solid != null && row.solid !== 0);
      if (hasFormula) return calcQtdLiqPrev(row.quantidade_latas ?? 0, row.solid ?? null);
      const stored = row.quantidade_liquida_prevista ?? 0;
      const storedNum = typeof stored === "number" ? stored : parseFormattedNumber(String(stored));
      if (storedNum !== 0) return Number(storedNum.toFixed(2));
      return calcQtdLiqPrev(row.quantidade_latas ?? 0, row.solid ?? null);
    })(),
    cort_solid: (() => {
      const tf = (row.tipo_fruto ?? "").trim();
      const kg = row.quantidade_kg ?? 0;
      if ((tf === "Açaí" || tf === "Fruto") && kg > 0) return formatNumberFixed(calcCortSolid(row.previsao_latas ?? 0, row.solid ?? null), 2) || null;
      return (row.cort_solid ?? "").trim() !== "" ? row.cort_solid : (formatNumberFixed(calcCortSolid(row.previsao_latas ?? 0, row.solid ?? null), 2) || null);
    })(),
    t_cort: (() => {
      const tf = (row.tipo_fruto ?? "").trim();
      const kg = row.quantidade_kg ?? 0;
      const useCalculatedCort = (tf === "Açaí" || tf === "Fruto") && kg > 0;
      const cortNum = useCalculatedCort ? calcCortSolid(row.previsao_latas ?? 0, row.solid ?? null) : ((row.cort_solid ?? "").trim() !== "" ? parseCortSolidValue(row.cort_solid!) : calcCortSolid(row.previsao_latas ?? 0, row.solid ?? null));
      const hasFormulaLiq = (row.quantidade_latas != null && row.quantidade_latas !== 0) && (row.solid != null && row.solid !== 0);
      const liqPrev = hasFormulaLiq ? calcQtdLiqPrev(row.quantidade_latas ?? 0, row.solid ?? null) : ((row.quantidade_liquida_prevista ?? 0) !== 0 ? (row.quantidade_liquida_prevista ?? 0) : calcQtdLiqPrev(row.quantidade_latas ?? 0, row.solid ?? null));
      return formatNumberFixed(calcTCort(cortNum, liqPrev), 2) || null;
    })(),
    quantidade_basqueta: calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, row.unidade_base ?? ""),
    quantidade_chapa: calcQtdChapa(calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, row.unidade_base ?? ""), row.unidade_chapa ?? ""),
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
    const invalidCodeRow = rowsToSave.find((r) => !isValidItemCode(r.Code));
    if (invalidCodeRow) {
      toast({
        title: "Código inválido",
        description: `Código do item deve ter no mínimo ${MIN_ITEM_CODE_LENGTH} caracteres.`,
        variant: "destructive",
      });
      return;
    }
    lastLocalChangeAtRef.current = Date.now();
    setSavingAll(true);
    try {
      for (const row of rowsToSave) {
        const updated = await updateOcpp(row.id, rowToPayload(row));
        setRegistros((prev) =>
          prev.map((r) => (r.id === row.id ? { ...updated, Code: row.Code ?? updated.Code } : r))
        );
      }
      toast({ title: "Salvo", description: `${rowsToSave.length} linha(s) atualizada(s).` });
      await loadRegistros();
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: e instanceof Error ? e.message : "Erro ao atualizar registros",
        variant: "destructive",
      });
    } finally {
      setSavingAll(false);
    }
  }, [registrosExibidos, rowToPayload, toast, loadRegistros]);

  /** Criar novo documento: limpa a lista. Filial do cadastro é só no campo do header (não usa o filtro de listagem). */
  const createNewDocument = useCallback(() => {
    const totalDocs = documentosParaNavegacao.length;
    pendingNovoDocIdentityRef.current = null;
    setNewDocumentIndex(totalDocs + 1);
    setFilialNovoDocumento(isFilialBelaOuPetruz(filialFiltro) ? filialFiltro : "");
    setRegistros([]);
    setSelectedDocKey(null);
    setShowDocumentGridForRange(false);
    toast({
      title: "Novo documento",
      description: "Obrigatório escolher filial BELA ou Petruz. Depois adicione linhas e salve.",
    });
  }, [documentosParaNavegacao.length, filialFiltro]);

  /** Contagem para PCP por documento: "1 de 1" = um documento (com N linhas), "2 de 3" = segundo doc de três. Setas navegam entre documentos. */
  useEffect(() => {
    let current: number;
    let total: number;
    if (newDocumentIndex != null) {
      current = newDocumentIndex;
      total = newDocumentIndex;
    } else if (documentosParaNavegacao.length > 0) {
      total = documentosParaNavegacao.length;
      if (selectedDocKey) {
        const idx = documentosParaNavegacao.findIndex((d) => d.key === selectedDocKey);
        current = idx >= 0 ? idx + 1 : 1;
      } else {
        current = total;
      }
    } else {
      total = 0;
      current = 0;
    }
    const idx = selectedDocKey ? documentosParaNavegacao.findIndex((d) => d.key === selectedDocKey) : -1;
    const canGoPrev = documentosParaNavegacao.length > 0 && idx > 0;
    const canGoNext = documentosParaNavegacao.length > 0 && idx >= 0 && idx < documentosParaNavegacao.length - 1;
    setDocumentNav({
      showNav: true,
      canGoPrev,
      canGoNext,
      onPrev: () => {
        const list = documentosParaNavegacaoRef.current;
        const key = selectedDocKeyNavRef.current;
        const i = key ? list.findIndex((d) => d.key === key) : -1;
        if (i > 0) {
          setNewDocumentIndex(null);
          const target = list[i - 1];
          const launchDay = addCalendarDays(target.data_dia, -1);
          setDataFiltro(launchDay);
          setDataFiltroPara(launchDay);
          setSelectedDocKey(target.key);
          setShowDocumentGridForRange(false);
        }
      },
      onNext: () => {
        const list = documentosParaNavegacaoRef.current;
        const key = selectedDocKeyNavRef.current;
        const i = key ? list.findIndex((d) => d.key === key) : -1;
        if (i >= 0 && i < list.length - 1) {
          setNewDocumentIndex(null);
          const target = list[i + 1];
          const launchDay = addCalendarDays(target.data_dia, -1);
          setDataFiltro(launchDay);
          setDataFiltroPara(launchDay);
          setSelectedDocKey(target.key);
          setShowDocumentGridForRange(false);
        }
      },
      onNewDocument: createNewDocument,
      navLabel: `${current} de ${total}`,
    });
    return () => setDocumentNav(null);
  }, [documentosParaNavegacao, selectedDocKey, newDocumentIndex, createNewDocument, setDocumentNav]);

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
    const isNovoDoc = newDocumentIndex != null && !selectedDocKey;
    const isDocExistente = selectedDocKey != null && documentosDoPeriodo.length > 0;
    let payload: OCPPInsertPayload;
    if (isDocExistente) {
      const doc = documentosDoPeriodo.find((d) => d.key === selectedDocKey);
      const first = doc?.rows[0];
      const dataStr = first?.data ? String(first.data).split("T")[0] : addCalendarDays(dataFiltro.split("T")[0], 1);
      payload = emptyPayload(dataStr);
      payload.filial_nome = (first?.filial_nome ?? doc?.filial_nome) || null;
      if (first?.doc_numero != null) payload.doc_numero = first.doc_numero;
      if (first?.doc_ordem_global != null) payload.doc_ordem_global = first.doc_ordem_global;
    } else if (isNovoDoc) {
      payload = emptyPayload(addCalendarDays(dataFiltro.split("T")[0], 1));
      const filial = filialNovoDocumento;
      if (!isFilialBelaOuPetruz(filial)) {
        toast({
          title: "Filial obrigatória",
          description: "No campo Filial do documento (acima), escolha BELA ou Petruz antes de adicionar linhas.",
          variant: "destructive",
        });
        return;
      }
      payload.filial_nome = filial;
      try {
        if (pendingNovoDocIdentityRef.current == null) {
          pendingNovoDocIdentityRef.current = await getNextOcppDocIdentity(payload.data, payload.filial_nome);
        }
        const idn = pendingNovoDocIdentityRef.current;
        payload.doc_numero = idn.doc_numero;
        payload.doc_ordem_global = idn.doc_ordem_global;
      } catch (e) {
        toast({
          title: "Erro",
          description: e instanceof Error ? e.message : "Não foi possível obter o número do documento.",
          variant: "destructive",
        });
        return;
      }
    } else if (documentosDoPeriodo.length === 0) {
      payload = emptyPayload(addCalendarDays(dataFiltro.split("T")[0], 1));
      const filial = filialFiltro;
      if (!isFilialBelaOuPetruz(filial)) {
        toast({
          title: "Filial obrigatória",
          description: "Nos filtros, escolha BELA ou Petruz antes de adicionar a primeira linha.",
          variant: "destructive",
        });
        return;
      }
      payload.filial_nome = filial;
      try {
        const idn = await getNextOcppDocIdentity(payload.data, payload.filial_nome);
        payload.doc_numero = idn.doc_numero;
        payload.doc_ordem_global = idn.doc_ordem_global;
      } catch (e) {
        toast({
          title: "Erro",
          description: e instanceof Error ? e.message : "Não foi possível obter o número do documento.",
          variant: "destructive",
        });
        return;
      }
    } else {
      toast({
        title: "Selecione um documento",
        description: "Escolha um documento na lista, use Novo documento ou ajuste o filtro de filial.",
        variant: "destructive",
      });
      return;
    }
    lastLocalChangeAtRef.current = Date.now();
    try {
      setSavingId(-1);
      const newRow = await createOcpp(payload);
      setRegistros((prev) => [...prev, newRow]);
      toast({ title: "Linha adicionada", description: isDocExistente ? "Linha incluída no documento." : "Registro incluído." });
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
    lastLocalChangeAtRef.current = Date.now();
    try {
      await deleteOcpp(id);
      setRegistros((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirmId(null);
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
    const totalPrevisaoLatas = registrosExibidos.reduce((sum, r) => sum + (r.previsao_latas ?? 0), 0);
    const totalLatas = registrosExibidos.reduce((sum, r) => {
      const tf = (r.tipo_fruto ?? "").trim();
      const kg = r.quantidade_kg ?? 0;
      const isCalculado = (tf === "Açaí" || tf === "Fruto") && kg > 0;
      const qtdLatas = isCalculado
        ? ((r.quantidade_latas ?? 0) !== 0 ? (r.quantidade_latas ?? 0) : calcPrevisaoLatasFromTipoFruto(kg, tf))
        : (r.quantidade_latas ?? 0);
      return sum + qtdLatas;
    }, 0);
    const totalKg = registrosExibidos.reduce((sum, r) => sum + (r.quantidade_kg ?? 0), 0);
    return { totalQuantidade, totalLatas, totalPrevisaoLatas, totalKg };
  };

  return (
    <AppLayout>
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro</AlertDialogTitle>
            <AlertDialogDescription>Excluir este registro do planejamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId !== null && handleDelete(deleteConfirmId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

        {/* Dashboard PCP — acima do card de planejamento */}
        <section className="rounded-2xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-md overflow-hidden" aria-label="Dashboard Planejamento de Produção PCP">
          <div className="border-b border-border/40 bg-muted/30 px-4 py-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Planejamento de Produção PCP</h2>
              <Dialog open={dashboardFiltersOpen} onOpenChange={setDashboardFiltersOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 shrink-0" aria-label="Abrir filtros do dashboard">
                    <Filter className="h-4 w-4" />
                    Filtros
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md rounded-lg">
                  <DialogHeader>
                    <DialogTitle>Filtros do dashboard</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                      <Label>Data (intervalo)</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="dashboard-filtros-mesma-data-desktop"
                          checked={dashboardMesmaDataPending}
                          onCheckedChange={(checked) => {
                            const value = Boolean(checked);
                            setDashboardMesmaDataPending(value);
                            if (value && dashboardDateFromPending) setDashboardDateToPending(dashboardDateFromPending);
                          }}
                        />
                        <Label htmlFor="dashboard-filtros-mesma-data-desktop" className="text-xs text-muted-foreground cursor-pointer">
                          Mesma data
                        </Label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">De</Label>
                          <DatePicker
                            value={dashboardDateFromPending}
                            onChange={(v) => {
                              if (!v) return;
                              setDashboardDateFromPending(v);
                              if (dashboardMesmaDataPending) setDashboardDateToPending(v);
                            }}
                            placeholder="Data"
                            triggerClassName="h-9 border rounded-md w-full text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Até</Label>
                          <DatePicker
                            value={dashboardDateToPending}
                            onChange={(v) => {
                              if (!v) return;
                              setDashboardDateToPending(v);
                              if (dashboardMesmaDataPending) setDashboardDateFromPending(v);
                            }}
                            placeholder="Data"
                            triggerClassName="h-9 border rounded-md w-full text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-unidade">Unidade</Label>
                      <Select value={dashboardUnidadePending || "__todos__"} onValueChange={(v) => setDashboardUnidadePending(v === "__todos__" ? "" : v)}>
                        <SelectTrigger id="dashboard-filtro-unidade" className="h-9">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos</SelectItem>
                          {dashboardFilterOptions.unidades.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-grupo">Grupo</Label>
                      <Select value={dashboardGrupoPending || "__todos__"} onValueChange={(v) => setDashboardGrupoPending(v === "__todos__" ? "" : v)}>
                        <SelectTrigger id="dashboard-filtro-grupo" className="h-9">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos</SelectItem>
                          {dashboardFilterOptions.grupos.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-tipo-linha">Tipo de Linha</Label>
                      <Select value={dashboardTipoLinhaPending || "__todos__"} onValueChange={(v) => setDashboardTipoLinhaPending(v === "__todos__" ? "" : v)}>
                        <SelectTrigger id="dashboard-filtro-tipo-linha" className="h-9">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos</SelectItem>
                          {dashboardFilterOptions.tipoLinhas.map((tl) => (
                            <SelectItem key={tl} value={tl}>{getNomeLinhaParaFiltro(tl) || tl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-tipo-fruto">Tipo de Fruto</Label>
                      <Select value={dashboardTipoFrutoPending || "__todos__"} onValueChange={(v) => setDashboardTipoFrutoPending(v === "__todos__" ? "" : v)}>
                        <SelectTrigger id="dashboard-filtro-tipo-fruto" className="h-9">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos</SelectItem>
                          {dashboardFilterOptions.tipoFrutos.map((tf) => (
                            <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-op">OP Code</Label>
                      <Input
                        id="dashboard-filtro-op"
                        value={dashboardOpCodePending}
                        onChange={(e) => setDashboardOpCodePending(e.target.value)}
                        placeholder="Ex.: OP-001"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setDashboardFiltersOpen(false)}>Cancelar</Button>
                    <Button onClick={applyDashboardFilters}>Aplicar filtros</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="p-4 sm:p-5 overflow-x-auto">
            {dashboardLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap text-xs font-medium">OP</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium">Código</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium">Descrição</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium">Unidade</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium">Grupo</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium">Tipo Linha</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium">Tipo Fruto</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium text-right">Sólidos</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium text-right">Qtd. Latas</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium text-right">Prev. Latas</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium text-right">Qtd em Kg</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium text-right">Qtd. Basq</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium text-right">Qtd. Chapa</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium text-right">T. Cort</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-medium text-right">Entrada no Túnel (Kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardFiltered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                          Nenhum registro encontrado para os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dashboardFiltered.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs">{row.op ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{row.Code ?? "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{row.descricao ?? "—"}</TableCell>
                          <TableCell className="text-xs">{row.unidade ?? "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{row.grupo ?? "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{row.tipo_linha ? (getNomeLinhaParaFiltro(row.tipo_linha) || row.tipo_linha) : "—"}</TableCell>
                          <TableCell className="text-xs">{row.tipo_fruto ?? "—"}</TableCell>
                          <TableCell className="text-xs text-right">{row.solidos != null ? SOLIDOS_PERFIS.find((p) => p.value === row.solidos)?.label ?? row.solidos : "—"}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(row.quantidade_latas)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(row.previsao_latas)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(row.quantidade_kg)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(row.quantidade_basqueta)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(row.quantidade_chapa)}</TableCell>
                          <TableCell className="text-xs text-right">{row.t_cort ?? "—"}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(row.quantidade_kg_tuneo)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {dashboardFiltered.length > 0 && (
                    <TableFooter>
                      <TableRow className="bg-primary/10 font-bold border-t-2 border-primary/30">
                        <TableCell colSpan={7} className="text-sm">Total</TableCell>
                        <TableCell className="text-xs text-right"></TableCell>
                          <TableCell className="text-xs text-right">{formatNumberFixed(dashboardTotals.quantidade_latas, 2)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(dashboardTotals.previsao_latas)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(dashboardTotals.quantidade_kg)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(dashboardTotals.quantidade_basqueta)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(dashboardTotals.quantidade_chapa)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumberFixed(dashboardTotals.t_cort, 3)}</TableCell>
                        <TableCell className="text-xs text-right">{formatNumber(dashboardTotals.quantidade_kg_tuneo)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            )}
          </div>
        </section>

        {/* Card principal — mesmo estilo do Acompanhamento diário da produção */}
        <div ref={cardCaptureRef} className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] overflow-hidden">
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
                    <div className="hidden" aria-hidden={true}>
                      <DatePicker
                        value={dataFiltro}
                        onChange={(v) => v && setDataFiltro(v)}
                        placeholder="Data lançamento"
                        className="min-w-[140px]"
                        triggerClassName="border border-input bg-background hover:bg-muted/60 px-2 py-1 min-h-0 h-auto text-sm"
                      />
                    </div>
                    {newDocumentIndex != null && !selectedDocKey ? (
                      <div className="flex flex-col gap-1 min-w-0">
                        <Label htmlFor="filial-select" className="text-xs text-muted-foreground font-normal">
                          Filial do documento (cadastro)
                        </Label>
                        <Select
                          value={filialNovoDocumento || FILIAL_PLACEHOLDER_VALUE}
                          onValueChange={(v) =>
                            setFilialNovoDocumento(v === FILIAL_PLACEHOLDER_VALUE ? "" : v)
                          }
                        >
                          <SelectTrigger
                            id="filial-select"
                            className="w-full min-w-[160px] sm:w-[220px] h-9 text-sm"
                            disabled={registrosExibidos.length > 0}
                            aria-label="Filial do novo documento"
                            title={
                              registrosExibidos.length > 0
                                ? "Filial fixa após a primeira linha deste documento."
                                : undefined
                            }
                          >
                            <SelectValue placeholder={`${FILIAL_PLACEHOLDER_LABEL} (obrigatório)`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={FILIAL_PLACEHOLDER_VALUE} disabled>
                              {FILIAL_PLACEHOLDER_LABEL}
                            </SelectItem>
                            {filiaisBelaOuPetruz.length > 0 ? (
                              filiaisBelaOuPetruz.map((f) => (
                                <SelectItem key={f.id} value={(f.nome || "").trim()}>
                                  {f.nome}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-3 text-xs text-muted-foreground">
                                Cadastre BELA e Petruz na OCTF (nenhuma filial compatível encontrada).
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 min-w-0 max-w-[min(100%,22rem)]">
                        <Label htmlFor="filial-select-contexto" className="text-xs text-muted-foreground font-normal">
                          Filial do documento
                        </Label>
                        <div
                          id="filial-select-contexto"
                          className="flex h-9 w-full min-w-[160px] sm:w-[220px] items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-foreground"
                          title="Documento atual (BELA Iaca ou Petruz). Para filtrar a listagem, use Filtros no card."
                        >
                          <span className="line-clamp-1 text-left">{filialExibicaoHeader}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">
                          Filtro da listagem: <span className="font-medium text-foreground">Filtros</span> no card.
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Mobile: botões abaixo */}
                  <div className="flex flex-col gap-2 w-full min-[892px]:hidden pt-2 items-center max-w-sm mx-auto">
                    <button
                      type="button"
                      onClick={() => createNewDocument()}
                      className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary w-full"
                      title="Novo documento"
                      aria-label="Novo documento"
                    >
                      <FilePlus className="h-4 w-4 shrink-0" />
                      <span>Novo documento</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveAll()}
                      disabled={savingAll || registrosExibidos.length === 0}
                      className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingAll ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
                      <span>{savingAll ? "Salvando..." : "Salvar"}</span>
                    </button>
                    <div style={{ visibility: hidePngButtonDuringCapture ? "hidden" : "visible" }} className="w-full">
                      <ExportToPng
                        targetRef={cardCaptureRef}
                        filenamePrefix="planejamento-producao-pcp"
                        label="Baixar PNG"
                        disabled={savingAll || registrosExibidos.length === 0}
                        expandScrollable={false}
                        onBeforeCapture={async () => {
                          setHidePngButtonDuringCapture(true);

                          // Espera o React re-renderizar para garantir que o botão sumiu antes do toPng.
                          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

                          const start = cardCaptureRef.current;
                          const end = kpiCaptureEndRef.current;
                          if (start && end) {
                            captureOriginalStylesRef.current = {
                              height: start.style.height,
                              overflow: start.style.overflow,
                            };
                            const height = end.getBoundingClientRect().bottom - start.getBoundingClientRect().top;
                            start.style.height = `${Math.max(0, height)}px`;
                          }
                        }}
                        onAfterCapture={async () => {
                          setHidePngButtonDuringCapture(false);
                          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

                          const start = cardCaptureRef.current;
                          const orig = captureOriginalStylesRef.current;
                          if (start && orig) {
                            start.style.height = orig.height;
                            start.style.overflow = orig.overflow;
                            captureOriginalStylesRef.current = null;
                          }
                        }}
                        className="w-full justify-center"
                        title="Baixar PNG do PCP (a partir da linha azul do card)"
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Desktop: botões à direita */}
              <div className="hidden min-[892px]:flex items-center gap-2 order-2 shrink-0">
                <button
                  type="button"
                  onClick={() => createNewDocument()}
                  className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary"
                  title="Novo documento"
                  aria-label="Novo documento"
                >
                  <FilePlus className="h-4 w-4 shrink-0" />
                  <span>Novo documento</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAll()}
                  disabled={savingAll || registrosExibidos.length === 0}
                  className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAll ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
                  <span>{savingAll ? "Salvando..." : "Salvar"}</span>
                </button>
                <div style={{ visibility: hidePngButtonDuringCapture ? "hidden" : "visible" }}>
                  <ExportToPng
                    targetRef={cardCaptureRef}
                    filenamePrefix="planejamento-producao-pcp"
                    label="Baixar PNG"
                    disabled={savingAll || registrosExibidos.length === 0}
                      expandScrollable={false}
                      onBeforeCapture={async () => {
                        setHidePngButtonDuringCapture(true);
                        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

                        const start = cardCaptureRef.current;
                        const end = kpiCaptureEndRef.current;
                        if (start && end) {
                          captureOriginalStylesRef.current = {
                            height: start.style.height,
                            overflow: start.style.overflow,
                          };
                          const height = end.getBoundingClientRect().bottom - start.getBoundingClientRect().top;
                          start.style.height = `${Math.max(0, height)}px`;
                        }
                      }}
                      onAfterCapture={async () => {
                        setHidePngButtonDuringCapture(false);
                        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

                        const start = cardCaptureRef.current;
                        const orig = captureOriginalStylesRef.current;
                        if (start && orig) {
                          start.style.height = orig.height;
                          start.style.overflow = orig.overflow;
                          captureOriginalStylesRef.current = null;
                        }
                      }}
                    title="Baixar PNG do PCP (a partir da linha azul do card)"
                  />
                </div>
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
            <>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 mb-3">
              <Dialog open={filtrosCardOpen} onOpenChange={setFiltrosCardOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium border border-input bg-background hover:bg-muted/50 shrink-0 w-full sm:w-auto"
                    aria-label="Abrir filtros"
                  >
                    <Filter className="h-4 w-4 shrink-0" />
                    <span>Filtros</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="w-[340px] sm:w-[380px] p-4 rounded-lg shadow-lg border-border/60 max-w-[95vw]">
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-foreground">Filtros</p>
                    <p className="text-xs text-muted-foreground -mt-2">
                      Período pela data de lançamento (cadastro). A data do documento no planejamento é o dia seguinte.
                    </p>
                    <div className="grid gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="card-filtros-mesma-data"
                          checked={filtrosCardMesmaDataPending}
                          onCheckedChange={(checked) => {
                            const value = Boolean(checked);
                            setFiltrosCardMesmaDataPending(value);
                            if (value && dataFiltroPending) setDataFiltroParaPending(dataFiltroPending);
                          }}
                        />
                        <Label htmlFor="card-filtros-mesma-data" className="text-xs text-muted-foreground cursor-pointer">
                          Mesma data
                        </Label>
                      </div>
                      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <Label htmlFor="card-filtro-de" className="text-xs text-muted-foreground">De</Label>
                        <DatePicker
                          id="card-filtro-de"
                          value={dataFiltroPending}
                          onChange={(v) => {
                            if (!v) return;
                            setDataFiltroPending(v);
                            if (filtrosCardMesmaDataPending) setDataFiltroParaPending(v);
                          }}
                          placeholder="Lançamento"
                          className="min-w-0"
                          triggerClassName="h-9 rounded-md border border-input bg-background px-2 text-sm w-full"
                        />
                      </div>
                      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <Label htmlFor="card-filtro-para" className="text-xs text-muted-foreground">Para</Label>
                        <DatePicker
                          id="card-filtro-para"
                          value={dataFiltroParaPending}
                          onChange={(v) => {
                            if (!v) return;
                            setDataFiltroParaPending(v);
                            if (filtrosCardMesmaDataPending) setDataFiltroPending(v);
                          }}
                          placeholder="Lançamento"
                          className="min-w-0"
                          triggerClassName="h-9 rounded-md border border-input bg-background px-2 text-sm w-full"
                        />
                      </div>
                      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <Label htmlFor="card-filtro-codigo" className="text-xs text-muted-foreground">Código</Label>
                        <Input
                          id="card-filtro-codigo"
                          value={filtroCodigoPending}
                          onChange={(e) => setFiltroCodigoPending(e.target.value)}
                          placeholder="Código do produto"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <Label htmlFor="card-filtro-tipo-linha" className="text-xs text-muted-foreground">Tipo Linha</Label>
                        <Select value={filtroTipoLinhaPending || "__todos__"} onValueChange={(v) => setFiltroTipoLinhaPending(v === "__todos__" ? "" : v)}>
                          <SelectTrigger id="card-filtro-tipo-linha" className="h-9 text-sm">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__todos__">Todos</SelectItem>
                            {opcoesTipoLinhaFiltro.length > 0
                              ? opcoesTipoLinhaFiltro.map((valorSalvo) => (
                                  <SelectItem key={valorSalvo} value={valorSalvo}>{getNomeLinhaParaFiltro(valorSalvo)}</SelectItem>
                                ))
                              : productionLines.map((l) => (
                                  <SelectItem key={l.id} value={(l.name ?? l.code ?? "").trim() || String(l.id)}>{(l.name || l.code) || `Linha ${l.id}`}</SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <Label htmlFor="card-filtro-solidos" className="text-xs text-muted-foreground">Solidos</Label>
                        <Select value={filtroSolidosPending === "" ? "__todos__" : String(filtroSolidosPending)} onValueChange={(v) => setFiltroSolidosPending(v === "__todos__" ? "" : Number(v))}>
                          <SelectTrigger id="card-filtro-solidos" className="h-9 text-sm">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__todos__">Todos</SelectItem>
                            {SOLIDOS_PERFIS.map((p) => (
                              <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <Label htmlFor="card-filtro-filial" className="text-xs text-muted-foreground">
                          Filial (listagem)
                        </Label>
                        <Select value={filialFiltroPending || "__todas__"} onValueChange={(v) => setFilialFiltroPending(v === "__todas__" ? "" : v)}>
                          <SelectTrigger id="card-filtro-filial" className="h-9 text-sm">
                            <SelectValue placeholder="Todas as filiais" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__todas__">Todas as filiais</SelectItem>
                            {filiais.map((f) => (
                              <SelectItem key={f.id} value={(f.nome || "").trim()}>{f.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={applyFiltrosCard}
                      className="w-full h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Filtrar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="flex flex-col sm:flex-row sm:ml-auto items-stretch sm:items-center gap-2 w-full sm:w-auto">
              </div>
            </div>

            {/* KPIs — mesma lógica da linha de totais do dashboard Planejamento PCP Personalizado (documento, data e filtros) */}
            <div className="mb-5 space-y-2">
              <p className="text-xs text-muted-foreground">
                {showDocumentGridForRange && documentosDoPeriodo.length > 0 && !selectedDocKey
                  ? "Selecione um documento no grid abaixo para ver os totais (não são somados todos os documentos do período)."
                  : "Totais do documento selecionado (e filtros Código / Tipo linha / Sólidos); mesma regra do dashboard PCP personalizado por linha."}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <KpiCard
                  title="Total produto acabado"
                  value={formatNumberFixed(planejamentoKpiTotals.quantidade, 2) || "0,00"}
                  icon={Package}
                />
                <KpiCard
                  title="Total Previsão em latas"
                  value={formatNumberFixed(planejamentoKpiTotals.previsao_latas, 2) || "0,00"}
                  icon={ClipboardList}
                />
                <KpiCard
                  title="Quantidade de Latas"
                  value={formatNumberFixed(planejamentoKpiTotals.quantidade_latas, 2) || "0,00"}
                  icon={Layers}
                />
                <KpiCard
                  title="Total Fruto e In - Natura"
                  value={formatNumberFixed(planejamentoKpiTotals.quantidade_kg, 2) || "0,00"}
                  icon={Weight}
                />
                <KpiCard
                  title="Quantidade de Basqueta"
                  value={formatNumberFixed(planejamentoKpiTotals.quantidade_basqueta, 0) || "0"}
                  icon={Box}
                />
                <KpiCard
                  title="Quantidade de Chapa"
                  value={formatNumberFixed(planejamentoKpiTotals.quantidade_chapa, 0) || "0"}
                  icon={LayoutGrid}
                />
                <KpiCard
                  title="Total Previsto para Corte"
                  value={formatNumberFixed(planejamentoKpiTotals.t_cort, 2) || "0,00"}
                  icon={Scissors}
                />
                <KpiCard
                  title="Entrada no Túnel (Kg)"
                  value={formatNumberFixed(planejamentoKpiTotals.quantidade_kg_tuneo, 2) || "0,00"}
                  icon={ArrowDownToLine}
                />
              </div>
            </div>

              {/* Marcador para recorte do PNG: parar após os cards de KPI */}
              <div ref={kpiCaptureEndRef} />

            {showDocumentGridForRange ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {documentosDoPeriodo.length === 0 ? (
                  <div className="col-span-full text-center text-muted-foreground py-10">
                    Nenhum documento encontrado para os filtros aplicados.
                  </div>
                ) : (
                  documentosDoPeriodo.map((doc, index) => {
                    const totalLatas = doc.rows.reduce((s, r) => s + (Number(r.quantidade_latas) || 0), 0);
                    const totalPrev = doc.rows.reduce((s, r) => s + (Number(r.previsao_latas) || 0), 0);
                    const totalKg = doc.rows.reduce((s, r) => s + (Number(r.quantidade_kg) || 0), 0);
                    const numeroDoc = doc.doc_numero != null ? String(doc.doc_numero) : (doc.doc_ordem_global != null ? String(doc.doc_ordem_global) : String(index + 1));
                    const filialNome = (doc.filial_nome || "").trim() ? String(doc.filial_nome).trim() : "Todas as filiais";
                    const firstRowData = doc.rows[0]?.data;
                    const dateStr = firstRowData ? (typeof firstRowData === "string" ? firstRowData.split("T")[0] : "") : "";
                    return (
                      <div
                        key={doc.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setNewDocumentIndex(null);
                          setSelectedDocKey(doc.key);
                          setShowDocumentGridForRange(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setNewDocumentIndex(null);
                            setSelectedDocKey(doc.key);
                            setShowDocumentGridForRange(false);
                          }
                        }}
                        className="group relative rounded-xl border border-border/50 bg-card/95 hover:border-primary/40 hover:bg-muted/60 hover:shadow-md transition-all duration-300 p-4 sm:p-5 cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex min-w-[3.5rem] sm:min-w-[4rem] shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary py-1.5">
                            <span className="text-[10px] font-bold leading-tight">N°</span>
                            <span className="text-sm font-bold tabular-nums">{numeroDoc}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">de {documentosDoPeriodo.length}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate" title={filialNome}>
                              {filialNome}
                            </p>
                            {dateStr ? (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDateBr(dateStr + "T00:00:00")}
                              </p>
                            ) : null}
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {doc.rows.length} linha(s) · Prev. Latas {formatNumberFixed(totalPrev, 2) || "—"} · Kg {formatNumber(totalKg) || "—"}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <>
              <div className="mb-5 flex w-full justify-end">
                <button
                  type="button"
                  onClick={addLinha}
                  disabled={savingId === -1}
                  className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3 w-full sm:w-auto shrink-0 gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all duration-300 z-10 relative"
                >
                  {savingId === -1 ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Plus className="h-4 w-4 shrink-0" />}
                  <span className="truncate">Adicionar Linha</span>
                </button>
              </div>
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
                      <TableHead className="min-w-[90px] text-xs sm:text-sm text-center">Previsão Latas</TableHead>
                      <TableHead className="min-w-[95px] text-xs sm:text-sm text-center">Qtd. Latas</TableHead>
                      <TableHead className="min-w-[75px] text-xs sm:text-sm text-center">Qtd. Kg</TableHead>
                      <TableHead className="min-w-[90px] text-xs sm:text-sm">Tipo Fruto</TableHead>
                      <TableHead className="min-w-[200px] text-xs sm:text-sm">Tipo Linha</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Uni. Basqueta</TableHead>
                      <TableHead className="min-w-[80px] text-xs sm:text-sm">Uni. Chapa</TableHead>
                      <TableHead className="min-w-[120px] text-xs sm:text-sm text-center">Solidos</TableHead>
                      <TableHead className="min-w-[100px] text-xs sm:text-sm text-center">Solid</TableHead>
                      <TableHead className="min-w-[130px] text-xs sm:text-sm text-center">Qtd. Kg Túneo</TableHead>
                      <TableHead className="min-w-[130px] text-xs sm:text-sm text-center">Qtd. Liq. Prev.</TableHead>
                      <TableHead className="min-w-[130px] text-xs sm:text-sm">Cort Solid</TableHead>
                      <TableHead className="min-w-[130px] text-xs sm:text-sm">T. Cort</TableHead>
                      <TableHead className="min-w-[130px] text-xs sm:text-sm text-center">Qtd. Basqueta</TableHead>
                      <TableHead className="min-w-[130px] text-xs sm:text-sm text-center">Qtd. Chapa</TableHead>
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
                      <TableHead className="min-w-[320px] sm:min-w-[420px] text-xs sm:text-sm">Observação</TableHead>
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
                              value={row.data?.split("T")[0] ?? addCalendarDays(dataFiltro.split("T")[0], 1)}
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
                              inputMode="decimal"
                              value={getNumericDisplay(row, "quantidade", "")}
                              onFocus={() => setEditingNumeric({ rowId: row.id, field: "quantidade", value: row.quantidade != null && row.quantidade !== 0 ? formatNumber(row.quantidade) : "" })}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setEditingNumeric((p) => (p?.rowId === row.id && p?.field === "quantidade" ? { ...p, value: v } : { rowId: row.id, field: "quantidade", value: v }));
                              }}
                              onBlur={(e) => {
                                const num = parseFormattedNumber(isEditing(row.id, "quantidade") ? editingNumeric?.value : e.target.value) || 0;
                                setEditingNumeric(null);
                                updateRow(row.id, { quantidade: num });
                              }}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center min-w-[7rem]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={isEditing(row.id, "previsao_latas") ? editingNumeric!.value : (row.previsao_latas != null && row.previsao_latas !== 0 ? formatNumber(row.previsao_latas) : "")}
                              onFocus={() => {
                                const disp = row.previsao_latas != null && row.previsao_latas !== 0 ? formatNumber(row.previsao_latas) : "";
                                setEditingNumeric({ rowId: row.id, field: "previsao_latas", value: disp });
                              }}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setEditingNumeric((p) => (p?.rowId === row.id && p?.field === "previsao_latas" ? { ...p, value: v } : { rowId: row.id, field: "previsao_latas", value: v }));
                              }}
                              onBlur={(e) => {
                                const prevLatas = parseFormattedNumber(isEditing(row.id, "previsao_latas") ? editingNumeric?.value : e.target.value) || 0;
                                setEditingNumeric(null);
                                const cortSolid = calcCortSolid(prevLatas, row.solid ?? null);
                                const liqPrev = calcQtdLiqPrev(row.quantidade_latas ?? 0, row.solid ?? null);
                                updateRow(row.id, { previsao_latas: prevLatas, cort_solid: formatNumberFixed(cortSolid, 2) || "", quantidade_liquida_prevista: liqPrev, t_cort: formatNumberFixed(calcTCort(cortSolid, liqPrev), 2) || "" });
                              }}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center min-w-[7rem]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={isEditing(row.id, "quantidade_latas") ? editingNumeric!.value : (() => {
                                const tf = (row.tipo_fruto ?? "").trim();
                                if ((tf === "Açaí" || tf === "Fruto") && (row.quantidade_kg != null && row.quantidade_kg !== 0)) {
                                  const calc = calcPrevisaoLatasFromTipoFruto(row.quantidade_kg, row.tipo_fruto ?? "");
                                  if (calc !== 0) return formatNumber(calc);
                                }
                                return row.quantidade_latas != null && row.quantidade_latas !== 0 ? formatNumber(row.quantidade_latas) : "";
                              })()}
                              onFocus={() => {
                                const tf = (row.tipo_fruto ?? "").trim();
                                const disp = (tf === "Açaí" || tf === "Fruto") && (row.quantidade_kg != null && row.quantidade_kg !== 0)
                                  ? formatNumber(calcPrevisaoLatasFromTipoFruto(row.quantidade_kg, row.tipo_fruto ?? ""))
                                  : (row.quantidade_latas != null && row.quantidade_latas !== 0 ? formatNumber(row.quantidade_latas) : "");
                                setEditingNumeric({ rowId: row.id, field: "quantidade_latas", value: disp });
                              }}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setEditingNumeric((p) => (p?.rowId === row.id && p?.field === "quantidade_latas" ? { ...p, value: v } : { rowId: row.id, field: "quantidade_latas", value: v }));
                              }}
                              onBlur={(e) => {
                                const latasVal = parseFormattedNumber(isEditing(row.id, "quantidade_latas") ? editingNumeric?.value : e.target.value) || 0;
                                setEditingNumeric(null);
                                const liqPrev = calcQtdLiqPrev(latasVal, row.solid ?? null);
                                const cortNum = (row.cort_solid ?? "").trim() !== "" ? parseCortSolidValue(row.cort_solid!) : calcCortSolid(row.previsao_latas ?? 0, row.solid ?? null);
                                updateRow(row.id, { quantidade_latas: latasVal, quantidade_liquida_prevista: liqPrev, t_cort: formatNumberFixed(calcTCort(cortNum, liqPrev), 2) || "" });
                              }}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center min-w-[7rem]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getNumericDisplay(row, "quantidade_kg", "")}
                              onFocus={() => setEditingNumeric({ rowId: row.id, field: "quantidade_kg", value: row.quantidade_kg != null && row.quantidade_kg !== 0 ? formatNumber(row.quantidade_kg) : "" })}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setEditingNumeric((p) => (p?.rowId === row.id && p?.field === "quantidade_kg" ? { ...p, value: v } : { rowId: row.id, field: "quantidade_kg", value: v }));
                              }}
                              onBlur={(e) => {
                                const kg = parseFormattedNumber(isEditing(row.id, "quantidade_kg") ? editingNumeric?.value : e.target.value) || 0;
                                setEditingNumeric(null);
                                const latasCalculado = calcPrevisaoLatasFromTipoFruto(kg, row.tipo_fruto ?? "");
                                const payload: Partial<OCPPInsertPayload> = { quantidade_kg: kg };
                                if ((row.tipo_fruto ?? "").trim() === "Açaí" || (row.tipo_fruto ?? "").trim() === "Fruto") {
                                  payload.quantidade_latas = latasCalculado;
                                  payload.previsao_latas = 0;
                                  if (latasCalculado !== 0) {
                                    const cortSolid = calcCortSolid(0, row.solid ?? null);
                                    const liqPrev = calcQtdLiqPrev(latasCalculado, row.solid ?? null);
                                    payload.quantidade_liquida_prevista = liqPrev;
                                    payload.cort_solid = formatNumberFixed(cortSolid, 2) || "";
                                    payload.t_cort = formatNumberFixed(calcTCort(cortSolid, liqPrev), 2) || "";
                                  }
                                }
                                updateRow(row.id, payload);
                              }}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center min-w-[7rem]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={(row.tipo_fruto || "").trim() || "__vazio__"}
                              onValueChange={(v) => {
                                const newVal = v === "__vazio__" ? "" : v;
                                const payload: Partial<OCPPInsertPayload> = { tipo_fruto: newVal };
                                const tipoLinhaVal = (row.tipo_linha ?? "").trim();
                                const lineByName = productionLines.find((l) => (l.code?.trim() || l.name?.trim() || `line-${l.id}`) === tipoLinhaVal);
                                const nomeLinhaParaRegra = lineByName?.name ?? tipoLinhaVal;
                                if (is100Gramas(nomeLinhaParaRegra)) {
                                  payload.unidade_base = "6";
                                  payload.unidade_chapa = "4";
                                  const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "6");
                                  payload.quantidade_basqueta = qtdBasqueta;
                                  payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "4");
                                } else if (isMixPote(nomeLinhaParaRegra)) {
                                  payload.unidade_base = "6";
                                  payload.unidade_chapa = "0";
                                  const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "6");
                                  payload.quantidade_basqueta = qtdBasqueta;
                                  payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                } else if (is1Kg(nomeLinhaParaRegra)) {
                                  payload.unidade_base = "12";
                                  payload.unidade_chapa = "2";
                                  const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "12");
                                  payload.quantidade_basqueta = qtdBasqueta;
                                  payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "2");
                                } else if (is5Kg(nomeLinhaParaRegra)) {
                                  payload.unidade_base = "10";
                                  payload.unidade_chapa = "0";
                                  const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "10");
                                  payload.quantidade_basqueta = qtdBasqueta;
                                  payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                } else if (isCubos(nomeLinhaParaRegra)) {
                                  payload.unidade_base = "22";
                                  payload.unidade_chapa = "0";
                                  const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "22");
                                  payload.quantidade_basqueta = qtdBasqueta;
                                  payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                } else if (isSticker(nomeLinhaParaRegra)) {
                                  payload.unidade_base = "10";
                                  payload.unidade_chapa = "3";
                                  const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "10");
                                  payload.quantidade_basqueta = qtdBasqueta;
                                  payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "3");
                                } else if (is4Soldas(nomeLinhaParaRegra)) {
                                  payload.unidade_base = "4";
                                  payload.unidade_chapa = "6";
                                  const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "4");
                                  payload.quantidade_basqueta = qtdBasqueta;
                                  payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "6");
                                } else {
                                  payload.unidade_base = "0";
                                  payload.unidade_chapa = "0";
                                  const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "0");
                                  payload.quantidade_basqueta = qtdBasqueta;
                                  payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                }
                                const latasCalculado = calcPrevisaoLatasFromTipoFruto(row.quantidade_kg ?? 0, newVal);
                                payload.quantidade_latas = latasCalculado;
                                payload.previsao_latas = 0;
                                if (latasCalculado !== 0) {
                                  const cortSolid = calcCortSolid(0, row.solid ?? null);
                                  const liqPrev = calcQtdLiqPrev(latasCalculado, row.solid ?? null);
                                  payload.quantidade_liquida_prevista = liqPrev;
                                  payload.cort_solid = formatNumberFixed(cortSolid, 2) || "";
                                  payload.t_cort = formatNumberFixed(calcTCort(cortSolid, liqPrev), 2) || "";
                                  setRowField(row.id, "quantidade_latas", latasCalculado);
                                  setRowField(row.id, "previsao_latas", 0);
                                  setRowField(row.id, "cort_solid", formatNumberFixed(cortSolid, 2) || "");
                                  setRowField(row.id, "t_cort", formatNumberFixed(calcTCort(cortSolid, liqPrev), 2) || "");
                                } else {
                                  setRowField(row.id, "quantidade_latas", 0);
                                  setRowField(row.id, "previsao_latas", 0);
                                }
                                updateRow(row.id, payload);
                              }}
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
                                  onValueChange={(v) => {
                                    const newVal = v === "__vazio__" ? "" : v;
                                    const payload: Partial<OCPPInsertPayload> = { tipo_linha: newVal };
                                    const lineByName = productionLines.find((l) => (l.code?.trim() || l.name?.trim() || `line-${l.id}`) === newVal);
                                    const nomeLinhaParaRegra = lineByName?.name ?? newVal;
                                    if (is100Gramas(nomeLinhaParaRegra)) {
                                      payload.unidade_base = "6";
                                      payload.unidade_chapa = "4";
                                      const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "6");
                                      payload.quantidade_basqueta = qtdBasqueta;
                                      payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "4");
                                    } else if (isMixPote(nomeLinhaParaRegra)) {
                                      payload.unidade_base = "6";
                                      payload.unidade_chapa = "0";
                                      const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "6");
                                      payload.quantidade_basqueta = qtdBasqueta;
                                      payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                    } else if (is1Kg(nomeLinhaParaRegra)) {
                                      payload.unidade_base = "12";
                                      payload.unidade_chapa = "2";
                                      const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "12");
                                      payload.quantidade_basqueta = qtdBasqueta;
                                      payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "2");
                                    } else if (is5Kg(nomeLinhaParaRegra)) {
                                      payload.unidade_base = "10";
                                      payload.unidade_chapa = "0";
                                      const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "10");
                                      payload.quantidade_basqueta = qtdBasqueta;
                                      payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                    } else if (isCubos(nomeLinhaParaRegra)) {
                                      payload.unidade_base = "22";
                                      payload.unidade_chapa = "0";
                                      const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "22");
                                      payload.quantidade_basqueta = qtdBasqueta;
                                      payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                    } else if (isSticker(nomeLinhaParaRegra)) {
                                      payload.unidade_base = "10";
                                      payload.unidade_chapa = "3";
                                      const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "10");
                                      payload.quantidade_basqueta = qtdBasqueta;
                                      payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "3");
                                    } else if (is4Soldas(nomeLinhaParaRegra)) {
                                      payload.unidade_base = "4";
                                      payload.unidade_chapa = "6";
                                      const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "4");
                                      payload.quantidade_basqueta = qtdBasqueta;
                                      payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "6");
                                    } else {
                                      payload.unidade_base = "0";
                                      payload.unidade_chapa = "0";
                                      const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "0");
                                      payload.quantidade_basqueta = qtdBasqueta;
                                      payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                    }
                                    updateRow(row.id, payload);
                                  }}
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
                                onBlur={(e) => {
                                  const newVal = e.target.value.trim();
                                  const payload: Partial<OCPPInsertPayload> = { tipo_linha: newVal };
                                  if (is100Gramas(newVal)) {
                                    payload.unidade_base = "6";
                                    payload.unidade_chapa = "4";
                                    const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "6");
                                    payload.quantidade_basqueta = qtdBasqueta;
                                    payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "4");
                                  } else if (isMixPote(newVal)) {
                                    payload.unidade_base = "6";
                                    payload.unidade_chapa = "0";
                                    const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "6");
                                    payload.quantidade_basqueta = qtdBasqueta;
                                    payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                  } else if (is1Kg(newVal)) {
                                    payload.unidade_base = "12";
                                    payload.unidade_chapa = "2";
                                    const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "12");
                                    payload.quantidade_basqueta = qtdBasqueta;
                                    payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "2");
                                  } else if (is5Kg(newVal)) {
                                    payload.unidade_base = "10";
                                    payload.unidade_chapa = "0";
                                    const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "10");
                                    payload.quantidade_basqueta = qtdBasqueta;
                                    payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                  } else if (isCubos(newVal)) {
                                    payload.unidade_base = "22";
                                    payload.unidade_chapa = "0";
                                    const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "22");
                                    payload.quantidade_basqueta = qtdBasqueta;
                                    payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                  } else if (isSticker(newVal)) {
                                    payload.unidade_base = "10";
                                    payload.unidade_chapa = "3";
                                    const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "10");
                                    payload.quantidade_basqueta = qtdBasqueta;
                                    payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "3");
                                  } else if (is4Soldas(newVal)) {
                                    payload.unidade_base = "4";
                                    payload.unidade_chapa = "6";
                                    const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "4");
                                    payload.quantidade_basqueta = qtdBasqueta;
                                    payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "6");
                                  } else {
                                    payload.unidade_base = "0";
                                    payload.unidade_chapa = "0";
                                    const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, "0");
                                    payload.quantidade_basqueta = qtdBasqueta;
                                    payload.quantidade_chapa = calcQtdChapa(qtdBasqueta, "0");
                                  }
                                  updateRow(row.id, payload);
                                }}
                                className="h-8 sm:h-9 text-xs sm:text-sm min-w-[200px]"
                                placeholder="Tipo linha"
                              />
                            )}
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.unidade_base ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setRowField(row.id, "unidade_base", v);
                                const kgTuneo = row.quantidade_kg_tuneo ?? 0;
                                const qtdBasqueta = calcQtdBasqueta(kgTuneo, v);
                                setRowField(row.id, "quantidade_basqueta", qtdBasqueta);
                                setRowField(row.id, "quantidade_chapa", calcQtdChapa(qtdBasqueta, row.unidade_chapa ?? ""));
                              }}
                              onBlur={(e) => {
                                const v = e.target.value;
                                const kgTuneo = row.quantidade_kg_tuneo ?? 0;
                                const qtdBasqueta = calcQtdBasqueta(kgTuneo, v);
                                updateRow(row.id, { unidade_base: v, quantidade_basqueta: qtdBasqueta, quantidade_chapa: calcQtdChapa(qtdBasqueta, row.unidade_chapa ?? "") });
                              }}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Uni. Basqueta"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={row.unidade_chapa ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setRowField(row.id, "unidade_chapa", v);
                                const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, row.unidade_base ?? "");
                                setRowField(row.id, "quantidade_chapa", calcQtdChapa(qtdBasqueta, v));
                              }}
                              onBlur={(e) => {
                                const v = e.target.value;
                                const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, row.unidade_base ?? "");
                                updateRow(row.id, { unidade_chapa: v, quantidade_chapa: calcQtdChapa(qtdBasqueta, v) });
                              }}
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                              placeholder="Uni. Chapa"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Select
                              value={row.solidos != null && [1, 2, 3, 4].includes(Number(row.solidos)) ? String(row.solidos) : "__vazio__"}
                              onValueChange={(v) => {
                                const solidosVal = v === "__vazio__" ? null : Number(v);
                                const payload: Partial<OCPPInsertPayload> = { solidos: solidosVal };
                                const solidVal = solidosVal === 1 ? 9.64 : solidosVal === 2 ? 6.5 : solidosVal === 3 ? 5.15 : solidosVal === 4 ? 1 : 0;
                                const liqPrev = calcQtdLiqPrev(row.quantidade_latas ?? 0, solidVal === 0 ? null : solidVal);
                                const cortSolid = calcCortSolid(row.previsao_latas ?? 0, solidVal === 0 ? null : solidVal);
                                payload.solid = solidVal;
                                payload.quantidade_liquida_prevista = liqPrev;
                                payload.cort_solid = formatNumberFixed(cortSolid, 2) || "";
                                payload.t_cort = formatNumberFixed(calcTCort(cortSolid, liqPrev), 2) || "";
                                setRowField(row.id, "solid", solidVal);
                                setRowField(row.id, "quantidade_liquida_prevista", liqPrev);
                                setRowField(row.id, "cort_solid", formatNumberFixed(cortSolid, 2) || "");
                                setRowField(row.id, "t_cort", formatNumberFixed(calcTCort(cortSolid, liqPrev), 2) || "");
                                updateRow(row.id, payload);
                              }}
                            >
                              <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-[7.5rem]">
                                <SelectValue placeholder="Solidos" />
                              </SelectTrigger>
                              <SelectContent className="text-xs sm:text-sm">
                                <SelectItem value="__vazio__">—</SelectItem>
                                {SOLIDOS_PERFIS.map((p) => (
                                  <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getNumericDisplay(row, "solid", "")}
                              onFocus={() => setEditingNumeric({ rowId: row.id, field: "solid", value: row.solid != null ? formatNumber(row.solid) : "" })}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setEditingNumeric((p) => (p?.rowId === row.id && p?.field === "solid" ? { ...p, value: v } : { rowId: row.id, field: "solid", value: v }));
                              }}
                              onBlur={(e) => {
                                const raw = isEditing(row.id, "solid") ? editingNumeric?.value : e.target.value;
                                const solidVal = raw === "" ? null : parseFormattedNumber(raw);
                                setEditingNumeric(null);
                                const liqPrev = calcQtdLiqPrev(row.quantidade_latas ?? 0, solidVal);
                                const cortSolid = calcCortSolid(row.previsao_latas ?? 0, solidVal);
                                updateRow(row.id, { solid: solidVal, quantidade_liquida_prevista: liqPrev, cort_solid: formatNumberFixed(cortSolid, 2) || "", t_cort: formatNumberFixed(calcTCort(cortSolid, liqPrev), 2) || "" });
                              }}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-[7rem]"
                              placeholder="—"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getNumericDisplay(row, "quantidade_kg_tuneo", "")}
                              onFocus={() => setEditingNumeric({ rowId: row.id, field: "quantidade_kg_tuneo", value: row.quantidade_kg_tuneo != null && row.quantidade_kg_tuneo !== 0 ? formatNumber(row.quantidade_kg_tuneo) : "" })}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setEditingNumeric((p) => (p?.rowId === row.id && p?.field === "quantidade_kg_tuneo" ? { ...p, value: v } : { rowId: row.id, field: "quantidade_kg_tuneo", value: v }));
                              }}
                              onBlur={(e) => {
                                const kgTuneo = parseFormattedNumber(isEditing(row.id, "quantidade_kg_tuneo") ? editingNumeric?.value : e.target.value) || 0;
                                setEditingNumeric(null);
                                const qtdBasqueta = calcQtdBasqueta(kgTuneo, row.unidade_base ?? "");
                                updateRow(row.id, { quantidade_kg_tuneo: kgTuneo, quantidade_basqueta: qtdBasqueta, quantidade_chapa: calcQtdChapa(qtdBasqueta, row.unidade_chapa ?? "") });
                              }}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-[8rem]"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={isEditing(row.id, "quantidade_liquida_prevista") ? editingNumeric!.value : (() => {
                                const calculated = calcQtdLiqPrev(row.quantidade_latas ?? 0, row.solid ?? null);
                                const hasFormula = (row.quantidade_latas != null && row.quantidade_latas !== 0) && (row.solid != null && row.solid !== 0);
                                const toShow = hasFormula ? (calculated !== 0 ? calculated : null) : ((row.quantidade_liquida_prevista ?? 0) !== 0 ? row.quantidade_liquida_prevista : calculated !== 0 ? calculated : null);
                                return toShow != null && toShow !== 0 ? formatNumberFixed(toShow, 3) : "";
                              })()}
                              onFocus={() => {
                                const calculated = calcQtdLiqPrev(row.quantidade_latas ?? 0, row.solid ?? null);
                                const hasFormula = (row.quantidade_latas != null && row.quantidade_latas !== 0) && (row.solid != null && row.solid !== 0);
                                const toShow = hasFormula ? (calculated !== 0 ? calculated : null) : ((row.quantidade_liquida_prevista ?? 0) !== 0 ? row.quantidade_liquida_prevista : calculated !== 0 ? calculated : null);
                                setEditingNumeric({ rowId: row.id, field: "quantidade_liquida_prevista", value: toShow != null && toShow !== 0 ? formatNumberFixed(toShow, 3) : "" });
                              }}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[\d.,]*$/.test(v)) setEditingNumeric((p) => (p?.rowId === row.id && p?.field === "quantidade_liquida_prevista" ? { ...p, value: v } : { rowId: row.id, field: "quantidade_liquida_prevista", value: v }));
                              }}
                              onBlur={(e) => {
                                const raw = parseFormattedNumber(isEditing(row.id, "quantidade_liquida_prevista") ? editingNumeric?.value : e.target.value) || 0;
                                const newVal = Number(raw.toFixed(3));
                                setEditingNumeric(null);
                                const cortNum = parseCortSolidValue(row.cort_solid ?? "");
                                updateRow(row.id, { quantidade_liquida_prevista: newVal, t_cort: formatNumberFixed(calcTCort(cortNum, newVal), 2) || "" });
                              }}
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-[8rem]"
                              placeholder="Qtd. Latas × Solid"
                              title="Qtd. Liq. Prev. = Qtd. Latas × Solid"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={(() => {
                                const tf = (row.tipo_fruto ?? "").trim();
                                const kg = row.quantidade_kg ?? 0;
                                const useCalculated = (tf === "Açaí" || tf === "Fruto") && kg > 0;
                                const calculated = calcCortSolid(row.previsao_latas ?? 0, row.solid ?? null);
                                if (useCalculated && calculated !== 0) return formatNumberFixed(calculated, 2);
                                const stored = row.cort_solid ?? "";
                                if (stored.trim() !== "") {
                                  const num = parseCortSolidValue(stored);
                                  return formatNumberFixed(num, 2);
                                }
                                return calculated !== 0 ? formatNumberFixed(calculated, 2) : "";
                              })()}
                              readOnly
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-[8rem] bg-muted/50"
                              placeholder="Prev. Latas × Solid (Excel)"
                              title='Excel: =SEERRO([@[Prev. Latas]]*[@Solid];" ")'
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Input
                              value={(() => {
                                const tf = (row.tipo_fruto ?? "").trim();
                                const kg = row.quantidade_kg ?? 0;
                                const useCalculatedCort = (tf === "Açaí" || tf === "Fruto") && kg > 0;
                                const cortNum = useCalculatedCort
                                  ? calcCortSolid(row.previsao_latas ?? 0, row.solid ?? null)
                                  : ((row.cort_solid ?? "").trim() !== "" ? parseCortSolidValue(row.cort_solid!) : calcCortSolid(row.previsao_latas ?? 0, row.solid ?? null));
                                const hasFormulaLiq = (row.quantidade_latas != null && row.quantidade_latas !== 0) && (row.solid != null && row.solid !== 0);
                                const liqPrev = hasFormulaLiq ? calcQtdLiqPrev(row.quantidade_latas ?? 0, row.solid ?? null) : ((row.quantidade_liquida_prevista ?? 0) !== 0 ? (row.quantidade_liquida_prevista ?? 0) : calcQtdLiqPrev(row.quantidade_latas ?? 0, row.solid ?? null));
                                const calculated = calcTCort(cortNum, liqPrev);
                                return formatNumberFixed(calculated, 3) || "0";
                              })()}
                              readOnly
                              className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-[8rem] bg-muted/50"
                              placeholder="Cort Solid − Qtd. Liq. Prev."
                              title="T. Cort = Cort Solid − Qtd. Liq. Prev."
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              value={(() => {
                                const kgTuneo = row.quantidade_kg_tuneo ?? 0;
                                const calculated = calcQtdBasqueta(kgTuneo, row.unidade_base ?? "");
                                return calculated !== 0 ? formatNumber(calculated) : "";
                              })()}
                              readOnly
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-[8rem] bg-muted/50"
                              placeholder="Qtd. Kg Túneo ÷ Uni. Basqueta (inteiro)"
                              title="Qtd. Basqueta = arredondar para cima (inteiro): Qtd. Kg Túneo ÷ Uni. Basqueta"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Input
                              value={(() => {
                                const qtdBasqueta = calcQtdBasqueta(row.quantidade_kg_tuneo ?? 0, row.unidade_base ?? "");
                                const calculated = calcQtdChapa(qtdBasqueta, row.unidade_chapa ?? "");
                                return calculated !== 0 ? formatNumber(calculated) : "";
                              })()}
                              readOnly
                              className="h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-[8rem] bg-muted/50"
                              placeholder="Qtd. Basqueta × Uni. Chapa (inteiro)"
                              title="Qtd. Chapa = arredondar para cima (inteiro): Qtd. Basqueta × Uni. Chapa"
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <Select
                              value={row.latas === 1 ? "OK" : "__vazio__"}
                              onValueChange={(v) => {
                                const numVal = v === "OK" ? 1 : 0;
                                setRowField(row.id, "latas", numVal);
                                updateRow(row.id, { latas: numVal });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm text-center w-full min-w-0 ${row.latas === 1 ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : "border-destructive/60 bg-destructive/10 text-destructive font-medium"}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.estrutura ?? "").trim() && ["PEND", "OK"].includes((row.estrutura ?? "").trim()) ? (row.estrutura ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "estrutura", val);
                                updateRow(row.id, { estrutura: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.estrutura ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.estrutura ?? "").trim() === "PEND" || !(row.estrutura ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.basqueta ?? "").trim() && ["PEND", "OK"].includes((row.basqueta ?? "").trim()) ? (row.basqueta ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "basqueta", val);
                                updateRow(row.id, { basqueta: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.basqueta ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.basqueta ?? "").trim() === "PEND" || !(row.basqueta ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.chapa ?? "").trim() && ["PEND", "OK"].includes((row.chapa ?? "").trim()) ? (row.chapa ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "chapa", val);
                                updateRow(row.id, { chapa: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.chapa ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.chapa ?? "").trim() === "PEND" || !(row.chapa ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.tuneo ?? "").trim() && ["PEND", "OK"].includes((row.tuneo ?? "").trim()) ? (row.tuneo ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "tuneo", val);
                                updateRow(row.id, { tuneo: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.tuneo ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.tuneo ?? "").trim() === "PEND" || !(row.tuneo ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.qual_maquina ?? "").trim() && ["PEND", "OK"].includes((row.qual_maquina ?? "").trim()) ? (row.qual_maquina ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "qual_maquina", val);
                                updateRow(row.id, { qual_maquina: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.qual_maquina ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.qual_maquina ?? "").trim() === "PEND" || !(row.qual_maquina ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.mao_de_obra ?? "").trim() && ["PEND", "OK"].includes((row.mao_de_obra ?? "").trim()) ? (row.mao_de_obra ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "mao_de_obra", val);
                                updateRow(row.id, { mao_de_obra: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.mao_de_obra ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.mao_de_obra ?? "").trim() === "PEND" || !(row.mao_de_obra ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.utilidade ?? "").trim() && ["PEND", "OK"].includes((row.utilidade ?? "").trim()) ? (row.utilidade ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "utilidade", val);
                                updateRow(row.id, { utilidade: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.utilidade ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.utilidade ?? "").trim() === "PEND" || !(row.utilidade ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.estoque ?? "").trim() && ["PEND", "OK"].includes((row.estoque ?? "").trim()) ? (row.estoque ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "estoque", val);
                                updateRow(row.id, { estoque: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.estoque ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.estoque ?? "").trim() === "PEND" || !(row.estoque ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.timbragem ?? "").trim() && ["PEND", "OK"].includes((row.timbragem ?? "").trim()) ? (row.timbragem ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "timbragem", val);
                                updateRow(row.id, { timbragem: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.timbragem ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.timbragem ?? "").trim() === "PEND" || !(row.timbragem ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Select
                              value={((row.corte_reprocesso ?? "").trim() && ["PEND", "OK"].includes((row.corte_reprocesso ?? "").trim()) ? (row.corte_reprocesso ?? "").trim() : "__vazio__")}
                              onValueChange={(v) => {
                                const val = v === "__vazio__" ? "" : v;
                                setRowField(row.id, "corte_reprocesso", val);
                                updateRow(row.id, { corte_reprocesso: val });
                              }}
                            >
                              <SelectTrigger className={`h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0 ${(row.corte_reprocesso ?? "").trim() === "OK" ? "border-green-600/60 bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : ((row.corte_reprocesso ?? "").trim() === "PEND" || !(row.corte_reprocesso ?? "").trim() ? "border-destructive/60 bg-destructive/10 text-destructive font-medium" : "")}`}>
                                <SelectValue placeholder="PEND" />
                              </SelectTrigger>
                              <SelectContent>
                                {PEND_OK_OPCOES.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 align-top">
                            <Textarea
                              value={row.observacao ?? ""}
                              onChange={(e) => setRowField(row.id, "observacao", e.target.value)}
                              onBlur={(e) => updateRow(row.id, { observacao: e.target.value })}
                              className="min-h-[40px] sm:min-h-[50px] w-full min-w-[280px] sm:min-w-[380px] text-xs sm:text-sm resize-y"
                              placeholder="Observação"
                              rows={2}
                            />
                          </TableCell>
                          <TableCell className="p-2 sm:p-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirmId(row.id)}
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
                              {formatTotal(totais.totalPrevisaoLatas)}
                            </div>
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 text-center">
                            <div className="flex h-8 sm:h-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                              {formatTotal(totais.totalLatas)}
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
            </>
          )}
            </>
          )}
          </div>
        </div>

        {/* Dashboard PCP — abaixo do card de planejamento */}
        <section className="rounded-2xl border border-border/50 bg-card/95 backdrop-blur-sm shadow-md overflow-hidden" aria-label="Dashboard Planejamento de Produção PCP (Personalizado)">
          <div className="border-b border-border/40 bg-muted/30 px-4 py-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Planejamento de Produção PCP (Personalizado)</h2>
              <Dialog open={dashboardFiltersOpen} onOpenChange={setDashboardFiltersOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 shrink-0" aria-label="Abrir filtros do dashboard">
                    <Filter className="h-4 w-4" />
                    Filtros
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:w-full sm:max-w-lg rounded-lg max-h-[85dvh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
                  <DialogHeader className="shrink-0 pb-2">
                    <DialogTitle className="text-base sm:text-lg">Filtros do dashboard</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 sm:gap-4 py-2 overflow-y-auto min-h-0 pr-1 -mr-1 overscroll-contain">
                    <div className="grid gap-2">
                      <Label className="text-sm">Data de lançamento (intervalo)</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="dashboard-filtros-mesma-data-mobile"
                          checked={dashboardMesmaDataPending}
                          onCheckedChange={(checked) => {
                            const value = Boolean(checked);
                            setDashboardMesmaDataPending(value);
                            if (value && dashboardDateFromPending) setDashboardDateToPending(dashboardDateFromPending);
                          }}
                        />
                        <Label htmlFor="dashboard-filtros-mesma-data-mobile" className="text-xs text-muted-foreground cursor-pointer">
                          Mesma data
                        </Label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">De</Label>
                          <DatePicker
                            value={dashboardDateFromPending}
                            onChange={(v) => {
                              if (!v) return;
                              setDashboardDateFromPending(v);
                              if (dashboardMesmaDataPending) setDashboardDateToPending(v);
                            }}
                            placeholder="Lançamento"
                            triggerClassName="h-9 sm:h-9 border rounded-md w-full text-sm min-h-[2.25rem]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Até</Label>
                          <DatePicker
                            value={dashboardDateToPending}
                            onChange={(v) => {
                              if (!v) return;
                              setDashboardDateToPending(v);
                              if (dashboardMesmaDataPending) setDashboardDateFromPending(v);
                            }}
                            placeholder="Lançamento"
                            triggerClassName="h-9 sm:h-9 border rounded-md w-full text-sm min-h-[2.25rem]"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-unidade" className="text-sm">Unidade</Label>
                      <Select value={dashboardUnidadePending || "__todos__"} onValueChange={(v) => setDashboardUnidadePending(v === "__todos__" ? "" : v)}>
                        <SelectTrigger id="dashboard-filtro-unidade" className="h-9 min-h-[2.25rem] text-sm">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos</SelectItem>
                          {dashboardFilterOptions.unidades.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-grupo" className="text-sm">Grupo</Label>
                      <Select value={dashboardGrupoPending || "__todos__"} onValueChange={(v) => setDashboardGrupoPending(v === "__todos__" ? "" : v)}>
                        <SelectTrigger id="dashboard-filtro-grupo" className="h-9 min-h-[2.25rem] text-sm">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos</SelectItem>
                          {dashboardFilterOptions.grupos.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-tipo-linha" className="text-sm">Tipo de Linha</Label>
                      <Select value={dashboardTipoLinhaPending || "__todos__"} onValueChange={(v) => setDashboardTipoLinhaPending(v === "__todos__" ? "" : v)}>
                        <SelectTrigger id="dashboard-filtro-tipo-linha" className="h-9 min-h-[2.25rem] text-sm">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos</SelectItem>
                          {dashboardFilterOptions.tipoLinhas.map((tl) => (
                            <SelectItem key={tl} value={tl}>{getNomeLinhaParaFiltro(tl) || tl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-tipo-fruto" className="text-sm">Tipo de Fruto</Label>
                      <Select value={dashboardTipoFrutoPending || "__todos__"} onValueChange={(v) => setDashboardTipoFrutoPending(v === "__todos__" ? "" : v)}>
                        <SelectTrigger id="dashboard-filtro-tipo-fruto" className="h-9 min-h-[2.25rem] text-sm">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos</SelectItem>
                          {dashboardFilterOptions.tipoFrutos.map((tf) => (
                            <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-op" className="text-sm">OP Code</Label>
                      <Input
                        id="dashboard-filtro-op"
                        value={dashboardOpCodePending}
                        onChange={(e) => setDashboardOpCodePending(e.target.value)}
                        placeholder="Ex.: OP-001"
                        className="h-9 min-h-[2.25rem] text-sm"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dashboard-filtro-item-code" className="text-sm">Código do item (Item Code)</Label>
                      <Input
                        id="dashboard-filtro-item-code"
                        value={dashboardItemCodePending}
                        onChange={(e) => setDashboardItemCodePending(e.target.value)}
                        placeholder="Ex.: 001 ou parte do código"
                        className="h-9 min-h-[2.25rem] text-sm"
                      />
                  </div>
                    <div className="grid gap-2 border-t border-border pt-4">
                      <Label className="text-sm font-semibold">Colunas visíveis</Label>
                      <p className="text-xs text-muted-foreground">Marque as colunas que deseja exibir na tabela.</p>
                      <label className="flex items-center gap-2.5 cursor-pointer py-2 px-1 rounded-md hover:bg-muted/50 min-h-[2.5rem] border-b border-border/50 mb-1 touch-manipulation">
                        <Checkbox
                          checked={DASHBOARD_TABLE_COLUMNS.every((c) => dashboardVisibleColumnsPending[c.id] !== false)}
                          onCheckedChange={(checked) => {
                            const value = checked === true;
                            setDashboardVisibleColumnsPending(() =>
                              Object.fromEntries(DASHBOARD_TABLE_COLUMNS.map((c) => [c.id, value]))
                            );
                          }}
                          className="shrink-0"
                        />
                        <span className="text-sm font-medium">Selecionar tudo / Desmarcar tudo</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 max-h-44 sm:max-h-40 overflow-y-auto py-1">
                        {DASHBOARD_TABLE_COLUMNS.map((col) => (
                          <label key={col.id} className="flex items-center gap-2.5 cursor-pointer py-2 sm:py-1.5 px-1 rounded-md hover:bg-muted/50 min-h-[2.5rem] sm:min-h-0 touch-manipulation">
                            <Checkbox
                              checked={dashboardVisibleColumnsPending[col.id] !== false}
                              onCheckedChange={(checked) =>
                                setDashboardVisibleColumnsPending((prev) => ({ ...prev, [col.id]: checked !== false }))
                              }
                              className="shrink-0"
                            />
                            <span className="text-xs sm:text-xs">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 border-t border-border pt-4">
                      <Label className="text-sm font-semibold">Ocultar itens com colunas vazias</Label>
                      <p className="text-xs text-muted-foreground">Se marcar uma coluna, itens em que essa coluna estiver vazia não aparecerão na tabela.</p>
                      <label className="flex items-center gap-2.5 cursor-pointer py-2 px-1 rounded-md hover:bg-muted/50 min-h-[2.5rem] border-b border-border/50 mb-1 touch-manipulation">
                        <Checkbox
                          checked={DASHBOARD_TABLE_COLUMNS.every((c) => dashboardHideWhenEmptyPending[c.id] === true)}
                          onCheckedChange={(checked) => {
                            const value = checked === true;
                            setDashboardHideWhenEmptyPending(() =>
                              Object.fromEntries(DASHBOARD_TABLE_COLUMNS.map((c) => [c.id, value]))
                            );
                          }}
                          className="shrink-0"
                        />
                        <span className="text-sm font-medium">Selecionar tudo / Desmarcar tudo</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 max-h-44 sm:max-h-40 overflow-y-auto py-1">
                        {DASHBOARD_TABLE_COLUMNS.map((col) => (
                          <label key={col.id} className="flex items-center gap-2.5 cursor-pointer py-2 sm:py-1.5 px-1 rounded-md hover:bg-muted/50 min-h-[2.5rem] sm:min-h-0 touch-manipulation">
                            <Checkbox
                              checked={dashboardHideWhenEmptyPending[col.id] === true}
                              onCheckedChange={(checked) =>
                                setDashboardHideWhenEmptyPending((prev) => ({ ...prev, [col.id]: checked === true }))
                              }
                              className="shrink-0"
                            />
                            <span className="text-xs sm:text-xs">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 sm:pt-2 shrink-0 border-t border-border/60 mt-2 pt-4">
                    <Button variant="outline" onClick={() => setDashboardFiltersOpen(false)} className="min-h-[2.5rem] sm:min-h-9 w-full sm:w-auto">Cancelar</Button>
                    <Button onClick={applyDashboardFilters} className="min-h-[2.5rem] sm:min-h-9 w-full sm:w-auto">Aplicar filtros</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="p-4 sm:p-5 overflow-x-auto">
            {dashboardLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {dashboardVisibleColsList.map((col) => (
                        <TableHead
                          key={col.id}
                          className={["quantidade", "previsao_latas", "qtd_latas", "qtd_kg", "qtd_basq", "qtd_chapa", "t_cort", "entrada_tunel"].includes(col.id) ? "whitespace-nowrap text-xs font-medium text-right" : "whitespace-nowrap text-xs font-medium"}
                        >
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardFiltered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={dashboardVisibleColsList.length || 15} className="text-center text-muted-foreground py-8">
                          Nenhum registro encontrado para os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dashboardFiltered.map((row) => (
                        <TableRow key={row.id}>
                          {dashboardVisibleColsList.map((col) => {
                            const isRight = ["quantidade", "previsao_latas", "qtd_latas", "qtd_kg", "qtd_basq", "qtd_chapa", "t_cort", "entrada_tunel"].includes(col.id);
                            const cn = isRight ? "text-xs text-right" : col.id === "op" || col.id === "codigo" ? "font-mono text-xs" : col.id === "descricao" || col.id === "grupo" || col.id === "tipo_linha" ? "text-xs whitespace-nowrap" : "text-xs";
                            let content: React.ReactNode = "—";
                            switch (col.id) {
                              case "op": content = row.op ?? "—"; break;
                              case "codigo": content = row.Code ?? "—"; break;
                              case "descricao": content = row.descricao ?? "—"; break;
                              case "unidade": content = row.unidade ?? "—"; break;
                              case "grupo": content = row.grupo ?? "—"; break;
                              case "quantidade": content = (row.quantidade ?? 0) !== 0 ? formatNumber(row.quantidade ?? 0) : "—"; break;
                              case "tipo_linha": content = row.tipo_linha ? (getNomeLinhaParaFiltro(row.tipo_linha) || row.tipo_linha) : "—"; break;
                              case "tipo_fruto": content = row.tipo_fruto ?? "—"; break;
                              case "solidos": content = row.solidos != null ? (SOLIDOS_PERFIS.find((p) => p.value === row.solidos)?.label ?? row.solidos) : "—"; break;
                              case "previsao_latas": content = row.previsao_latas != null && row.previsao_latas !== 0 ? formatNumber(row.previsao_latas) : "—"; break;
                              case "qtd_latas":
                                content = (() => {
                            const tf = (row.tipo_fruto ?? "").trim();
                            if ((tf === "Açaí" || tf === "Fruto") && (row.quantidade_kg != null && row.quantidade_kg !== 0)) {
                              const calc = calcPrevisaoLatasFromTipoFruto(row.quantidade_kg, row.tipo_fruto ?? "");
                              return calc !== 0 ? formatNumber(calc) : formatNumber(row.quantidade_latas);
                            }
                            return formatNumber(row.quantidade_latas);
                                })();
                                break;
                              case "qtd_kg": content = formatNumber(row.quantidade_kg); break;
                              case "qtd_basq": content = formatNumber(row.quantidade_basqueta); break;
                              case "qtd_chapa": content = formatNumber(row.quantidade_chapa); break;
                              case "t_cort": content = row.t_cort ?? "—"; break;
                              case "entrada_tunel": content = formatNumber(row.quantidade_kg_tuneo); break;
                              default: break;
                            }
                            return <TableCell key={col.id} className={cn}>{content}</TableCell>;
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {dashboardFiltered.length > 0 && dashboardVisibleColsList.length > 0 && (
                    <TableFooter>
                      <TableRow className="bg-primary/10 font-bold border-t-2 border-primary/30">
                        {(() => {
                          const labelIds = ["op", "codigo", "descricao", "unidade", "grupo", "tipo_linha", "tipo_fruto"];
                          const visibleLabels = dashboardVisibleColsList.filter((c) => labelIds.includes(c.id));
                          let labelSpanShown = false;
                          return dashboardVisibleColsList.map((col) => {
                            if (labelIds.includes(col.id)) {
                              if (!labelSpanShown) {
                                labelSpanShown = true;
                                return <TableCell key="total" colSpan={visibleLabels.length} className="text-sm">Total</TableCell>;
                              }
                              return null;
                            }
                            if (col.id === "solidos") return <TableCell key={col.id} className="text-xs text-right"></TableCell>;
                            if (col.id === "quantidade") return <TableCell key={col.id} className="text-xs text-right">{formatNumberFixed(dashboardTotals.quantidade, 2)}</TableCell>;
                            if (col.id === "previsao_latas") return <TableCell key={col.id} className="text-xs text-right">{formatNumberFixed(dashboardTotals.previsao_latas, 2)}</TableCell>;
                            if (col.id === "qtd_latas") return <TableCell key={col.id} className="text-xs text-right">{formatNumberFixed(dashboardTotals.quantidade_latas, 2)}</TableCell>;
                            if (col.id === "qtd_kg") return <TableCell key={col.id} className="text-xs text-right">{formatNumberFixed(dashboardTotals.quantidade_kg, 2)}</TableCell>;
                            if (col.id === "qtd_basq") return <TableCell key={col.id} className="text-xs text-right">{formatNumberFixed(dashboardTotals.quantidade_basqueta, 0)}</TableCell>;
                            if (col.id === "qtd_chapa") return <TableCell key={col.id} className="text-xs text-right">{formatNumberFixed(dashboardTotals.quantidade_chapa, 0)}</TableCell>;
                            if (col.id === "t_cort") return <TableCell key={col.id} className="text-xs text-right">{formatNumberFixed(dashboardTotals.t_cort, 3)}</TableCell>;
                            if (col.id === "entrada_tunel") return <TableCell key={col.id} className="text-xs text-right">{formatNumberFixed(dashboardTotals.quantidade_kg_tuneo, 2)}</TableCell>;
                            return <TableCell key={col.id} className="text-xs text-right"></TableCell>;
                          }).filter((x): x is React.ReactElement => x != null);
                        })()}
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
