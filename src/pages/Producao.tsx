import { useState, useEffect, useMemo, MouseEvent, useCallback, useRef, RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Clock, Calculator, Delete, Factory, Download, Calendar, TrendingUp, Target, Save, Database, Loader2, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Sparkles, Zap, ChevronLeft, ChevronRight, Pencil, ClipboardList, CalendarCheck, FilePlus, Filter } from "lucide-react";
import { ExportToPng, captureElementToPngBlob } from "@/components/ExportToPng";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from "recharts";
import {
  getItems,
  getLines,
  getFiliais,
  getItemByCode,
  loadProducao,
  saveProducao,
  deleteProducaoRecord,
  getDraft,
  saveDraft,
  getProducaoHistory,
  getOCTPByInicio,
  insertOCTP,
  updateOCTP,
  deleteOCTP,
  computeDuracaoMinutos,
  type OCTPRow,
} from "@/services/supabaseData";
import { useToast } from "@/hooks/use-toast";
import { useDocumentNav } from "@/contexts/DocumentNavContext";
import { useAuth } from "@/contexts/AuthContext";

interface ProductionItem {
  id: number;
  /** Id do registro na tabela OCPD quando o item foi carregado do banco (permite atualizar em vez de inserir) */
  ocpdId?: number;
  numero: number;
  dataDia?: string;
  op: string;
  codigoItem: string;
  descricaoItem: string;
  linha: string;
  quantidadePlanejada: number | string;
  quantidadeRealizada: number | string;
  diferenca: number;
  horasTrabalhadas: string;
  restanteHoras: string;
  horaFinal: string;
  calculo1HorasEditMode: boolean;
  observacao?: string;
}

interface ProductionLine {
  id: number;
  code: string;
  name: string;
}

export type GrupoReprocesso = "Reprocesso" | "Matéria Prima Açaí" | "Matéria Prima Fruto";

interface ReprocessoItem {
  id: number;
  numero: number;
  tipo: "Cortado" | "Usado";
  linha: string;
  grupo: GrupoReprocesso;
  codigo: string;
  descricao: string;
  quantidade: string;
}

/** Item do card OCTP (Problema, Ação, Responsável, Início, Hora inicial, Hora final, Intervalo, Descrição do Status) */
interface OCTPItem {
  id: number;
  numero: number;
  problema: string;
  acao: string;
  responsavel: string;
  hora: string | null; // ISO ou vazio (exibição formatada)
  inicio: string; // YYYY-MM-DD
  horaInicio: string; // HH:MM (editável) → coluna hora_inicio
  horaFinal: string;   // HH:MM (editável) → coluna hora_fim
  duracaoMinutos?: number | null; // intervalo em minutos (coluna duracao_minutos)
  descricao_status: string;
}

/** Status que param o relógio (hora final fixa). */
const OCTP_STATUS_RELOGIO_PARADO = ["Concluída", "Concluída com atraso", "Não Concluída"] as const;

function isOCTPStatusRelogioParado(status: string | null | undefined): boolean {
  return status != null && (OCTP_STATUS_RELOGIO_PARADO as readonly string[]).includes(status);
}

/** Opções de status do OCTP com cor da bolinha */
const OCTP_STATUS_OPTIONS = [
  { id: "Cancelada", label: "Cancelada", color: "#6b7280" },           // Cinza
  { id: "Atrasada", label: "Atrasada", color: "#ef4444" },             // Vermelha
  { id: "Concluída", label: "Concluída", color: "#22c55e" },           // Verde
  { id: "Concluída com atraso", label: "Concluída com atraso", color: "#f97316" }, // Laranja
  { id: "Não Concluída", label: "Não Concluída", color: "#dc2626" },   // Vermelho escuro
  { id: "Em andamento", label: "Em andamento", color: "#eab308" },     // Amarelo
  { id: "A iniciar", label: "A iniciar", color: "#3b82f6" },           // Azul
] as const;

/** Gradientes premium para o gráfico de pizza OCTP (claro → base → escuro, igual Status de Produção) */
const OCTP_PIE_GRADIENTS: Record<string, { light: string; dark: string }> = {
  "#ef4444": { light: "#f87171", dark: "#b91c1c" },
  "#22c55e": { light: "#4ade80", dark: "#15803d" },
  "#eab308": { light: "#facc15", dark: "#a16207" },
  "#f97316": { light: "#fb923c", dark: "#c2410c" },
  "#dc2626": { light: "#f87171", dark: "#991b1b" },
  "#3b82f6": { light: "#60a5fa", dark: "#1d4ed8" },
  "#6b7280": { light: "#9ca3af", dark: "#4b5563" },
};

// Quebra texto em até 3 linhas para labels do eixo (gráfico Planejado vs Realizado)
function wrapTextInThreeLines(text: string, maxCharsPerLine = 22): string[] {
  const t = (text ?? "").trim();
  if (!t) return ["", "", ""];
  const words = t.split(/\s+/);
  if (words.length <= 3) return [words.join(" "), "", ""].slice(0, 3);
  const lines: string[] = [];
  let current = "";
  const targetLen = Math.max(8, Math.ceil(t.length / 3));
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= targetLen || !current) {
      current = next;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  while (lines.length < 3) lines.push("");
  return lines.slice(0, 3);
}

/** Quebra texto em várias linhas com no máximo maxCharsPerLine por linha (para celulares < 400px). */
function wrapTextToLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const t = (text ?? "").trim();
  if (!t || maxLines < 1) return [""];
  const words = t.split(/\s+/);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxCharsPerLine || !current) {
      current = next;
    } else {
      lines.push(current);
      current = w;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length ? lines : [""];
}

/** Retorna componente de tick do eixo Y com nome quebrado em mais linhas (celulares estreitos). */
function makeYAxisTickMultiLine(maxCharsPerLine: number, maxLines: number) {
  return (props: { x?: number; y?: number; payload?: { value?: string } }) => {
    const { x = 0, y = 0, payload } = props;
    const label = payload?.value ?? "";
    const lines = wrapTextToLines(label, maxCharsPerLine, maxLines);
    const fontSize = maxCharsPerLine <= 10 ? 10 : maxCharsPerLine <= 14 ? 11 : 13;
    const lineHeight = maxCharsPerLine <= 10 ? "1em" : "1.05em";
    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor="end" fontSize={fontSize} fontWeight={600} fill="hsl(var(--foreground))">
          {lines.map((line, i) => (
            <tspan key={i} x={0} dy={i === 0 ? 0 : lineHeight}>{line}</tspan>
          ))}
        </text>
      </g>
    );
  };
}

// Tick do eixo X com nome do item em até 3 linhas, alinhado à coluna
const XAxisTickThreeLines = (props: { x?: number; y?: number; payload?: { value?: string; name?: string } }) => {
  const { x = 0, y = 0, payload } = props;
  const label = payload?.value ?? (payload as { name?: string })?.name ?? "";
  const lines = wrapTextInThreeLines(label);
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : "1.1em"}>{line}</tspan>
        ))}
      </text>
    </g>
  );
};

// Componente customizado para renderizar labels nos gráficos de barra
const CustomBarLabel = (props: any) => {
  const { x, y, width, value, dataKey } = props;
  if (!value || value === 0 || !x || !y || !width) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="hsl(var(--muted-foreground))"
      fontSize={11}
      fontWeight={600}
      textAnchor="middle"
      className="drop-shadow-sm"
    >
      {value.toLocaleString("pt-BR")}
    </text>
  );
};

// Componente customizado para renderizar labels nos gráficos de área
const CustomAreaLabel = (props: any) => {
  const { x, y, value } = props;
  if (!value || value === 0 || !x || !y) return null;

  return (
    <text
      x={x}
      y={y - 8}
      fill="hsl(var(--muted-foreground))"
      fontSize={11}
      fontWeight={600}
      textAnchor="middle"
      className="drop-shadow-sm"
    >
      {value.toLocaleString("pt-BR")}
    </text>
  );
};

const DRAFT_SCREEN = "producao";
const DRAFT_DEBOUNCE_MS = 1000;

function Producao() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { setDocumentNav, documentNav } = useDocumentNav();
  const producaoCardRef = useRef<HTMLDivElement>(null);
  const historicoCardRef = useRef<HTMLDivElement>(null);
  const reprocessoCardRef = useRef<HTMLDivElement>(null);
  const reprocessoExportRestoreRef = useRef<{ input: HTMLInputElement; wrapper: HTMLDivElement }[]>([]);
  const octpCardRef = useRef<HTMLDivElement>(null);
  const octpExportRestoreRef = useRef<{ el: HTMLElement; wrapper: HTMLDivElement }[]>([]);
  const chartPlanejadoRealizadoRef = useRef<HTMLDivElement>(null);
  const chartDiferencaItemRef = useRef<HTMLDivElement>(null);
  const chartStatusProducaoRef = useRef<HTMLDivElement>(null);
  const chartProducaoLinhaRef = useRef<HTMLDivElement>(null);
  const historicoProducaoLinhaRef = useRef<HTMLDivElement>(null);
  /** Ref para o header sempre chamar a versão mais recente de saveToDatabase (com todos os campos atualizados) */
  const saveToDatabaseRef = useRef<() => void | Promise<void>>(() => {});
  const [chartBarMargin, setChartBarMargin] = useState({ top: 28, right: 24, left: 24, bottom: 8 });
  const [linhaBarSize, setLinhaBarSize] = useState(20);
  const [pieOuterRadius, setPieOuterRadius] = useState(72);
  const [chartYAxisWidth, setChartYAxisWidth] = useState(200);
  const [chartTickMaxChars, setChartTickMaxChars] = useState(22);
  const [chartTickMaxLines, setChartTickMaxLines] = useState(3);
  const [chartMarginRight, setChartMarginRight] = useState(72);
  /** No celular: mais espaço por linha no gráfico Planejado vs Realizado para evitar nome em cima de nome */
  const [chartRowHeightExtra, setChartRowHeightExtra] = useState(52);
  const [chartBarCategoryGap, setChartBarCategoryGap] = useState(40);
  const [chartBarGap, setChartBarGap] = useState(22);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setChartBarMargin(w < 640 ? { top: 28, right: 16, left: 4, bottom: 8 } : { top: 28, right: 24, left: 24, bottom: 8 });
      setLinhaBarSize(w >= 1024 ? 26 : w >= 640 ? 22 : 20);
      setPieOuterRadius(w >= 1024 ? 88 : 72);
      if (w < 400) {
        setChartYAxisWidth(110);
        setChartTickMaxChars(10);
        setChartTickMaxLines(5);
        setChartMarginRight(52);
        setChartRowHeightExtra(100);
        setChartBarCategoryGap(36);
        setChartBarGap(28);
      } else if (w < 640) {
        setChartYAxisWidth(160);
        setChartTickMaxChars(14);
        setChartTickMaxLines(4);
        setChartMarginRight(60);
        setChartRowHeightExtra(92);
        setChartBarCategoryGap(40);
        setChartBarGap(26);
      } else {
        setChartYAxisWidth(200);
        setChartTickMaxChars(22);
        setChartTickMaxLines(3);
        setChartMarginRight(72);
        setChartRowHeightExtra(52);
        setChartBarCategoryGap(40);
        setChartBarGap(22);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const openedFromStateRef = useRef(false);
  /** true depois que o documento aberto pelo Relatório terminou de carregar (evita flicker loading/documento) */
  const reportDocumentLoadedRef = useRef(false);
  const isNewDocumentRef = useRef(false); // true após "Novo documento" para não recarregar do DB e manter setas habilitadas
  const justLoadedByIndexRef = useRef(false); // true após carregar doc pela seta, para o useEffect não sobrescrever com load sem filial
  const skipNextDataLoadRef = useRef(false); // true após restaurar rascunho, para não sobrescrever com loadFromDatabase
  const latestDraftRef = useRef<{ user_id: string; payload: Record<string, unknown> } | null>(null); // para salvar ao sair/aba
  const [currentTime, setCurrentTime] = useState(new Date());
  const [horasTrabalhadas, setHorasTrabalhadas] = useState("");
  const [calculo1HorasEditMode, setCalculo1HorasEditMode] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorDisplay, setCalculatorDisplay] = useState("0");
  const [calculatorPreviousValue, setCalculatorPreviousValue] = useState<number | null>(null);
  const [calculatorOperation, setCalculatorOperation] = useState<string | null>(null);
  const [calculatorShouldReset, setCalculatorShouldReset] = useState(false);
  const [calculatorExpression, setCalculatorExpression] = useState("");
  const [calculatorTargetItemId, setCalculatorTargetItemId] = useState<number | null>(null);
  const [calculatorTargetType, setCalculatorTargetType] = useState<"item" | "reprocesso" | null>(null);
  const [horaFinal, setHoraFinal] = useState("");
  const [restanteHoras, setRestanteHoras] = useState("");
  const [observacao, setObservacao] = useState("");
  const [totalReprocesso, setTotalReprocesso] = useState("");
  const [latasPrevista, setLatasPrevista] = useState("");
  const [latasRealizadas, setLatasRealizadas] = useState("");
  const [latasBatidas, setLatasBatidas] = useState("");
  const [totalCortado, setTotalCortado] = useState("");
  const [dataCabecalhoSelecionada, setDataCabecalhoSelecionada] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [percentualMeta, setPercentualMeta] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<"menu" | "cadastro" | "historico">(() => {
    const s = location.state as { loadData?: string; loadFilialNome?: string } | null;
    return s?.loadData && s?.loadFilialNome ? "cadastro" : "menu";
  });
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [allRecords, setAllRecords] = useState<any[]>([]); // Todos os registros ordenados
  const [currentRecordIndex, setCurrentRecordIndex] = useState<number>(-1); // Índice do registro atual
  const [currentRecordId, setCurrentRecordId] = useState<number | null>(null); // ID do registro atual
  /** doc_id do documento atual (null = legado ou novo ainda não salvo). Novo documento gera UUID. */
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  /** Na sub-aba Acompanhamento diário: true = exibe grid de documentos da data; false = exibe o formulário do documento aberto */
  const [showDocumentGridForDate, setShowDocumentGridForDate] = useState(false);
  /** Filtro do grid por número de documento: valor digitado e valor aplicado ao clicar em Filtrar */
  const [gridFilterNumeroDoc, setGridFilterNumeroDoc] = useState("");
  const [gridFilterNumeroDocApplied, setGridFilterNumeroDocApplied] = useState("");
  /** Intervalo de datas no grid de documentos (De / Até); valores dos inputs */
  const [gridDataDe, setGridDataDe] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [gridDataAte, setGridDataAte] = useState<string>(() => new Date().toISOString().split("T")[0]);
  /** Intervalo aplicado ao clicar em Filtrar (usa esses valores para filtrar a lista) */
  const [gridDataDeApplied, setGridDataDeApplied] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [gridDataAteApplied, setGridDataAteApplied] = useState<string>(() => new Date().toISOString().split("T")[0]);
  /** Filtro por filial no grid (valor do select); aplicado ao clicar em Filtrar */
  const [gridFilialFilter, setGridFilialFilter] = useState<string>("");
  const [gridFilialFilterApplied, setGridFilialFilterApplied] = useState<string>("");
  /** Filtro por código do item e linha no grid (aplicado ao clicar em Filtrar no card de filtros) */
  const [gridCodigoItem, setGridCodigoItem] = useState<string>("");
  const [gridCodigoItemApplied, setGridCodigoItemApplied] = useState<string>("");
  const [gridLinhaFilter, setGridLinhaFilter] = useState<string>("");
  const [gridLinhaFilterApplied, setGridLinhaFilterApplied] = useState<string>("");
  /** Dialog de filtros do grid (Data, Código, Linha) — aberto pelo botão Filtros no card Acompanhamento diário */
  const [gridFiltrosDialogOpen, setGridFiltrosDialogOpen] = useState(false);
  const [gridDataDePending, setGridDataDePending] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [gridDataAtePending, setGridDataAtePending] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [gridCodigoItemPending, setGridCodigoItemPending] = useState("");
  const [gridLinhaPending, setGridLinhaPending] = useState("");

  /** Voltar: se veio de Relatórios (returnTo no state), navega para lá; senão volta ao menu da página. */
  const handleVoltar = useCallback(() => {
    const s = location.state as { returnTo?: string } | null;
    if (s?.returnTo) navigate(s.returnTo);
    else setCurrentView("menu");
  }, [location.state, navigate]);

  // Catálogo de itens vindo da OCTI (mapeado por código)
  const [itemCatalog, setItemCatalog] = useState<Record<string, { nome_item: string }>>({});
  // Linhas de produção (OCLP)
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  // Reprocessos
  const [reprocessos, setReprocessos] = useState<ReprocessoItem[]>([]);
  // Filtros do card de reprocesso (tipo, linha, grupo, código) — valores do formulário
  const [reprocessoFiltroTipo, setReprocessoFiltroTipo] = useState<"" | "Cortado" | "Usado">("");
  const [reprocessoFiltroLinha, setReprocessoFiltroLinha] = useState<string>("");
  const [reprocessoFiltroGrupo, setReprocessoFiltroGrupo] = useState<"" | GrupoReprocesso>("");
  const [reprocessoFiltroCodigo, setReprocessoFiltroCodigo] = useState<string>("");
  // Valores aplicados ao clicar em Filtrar (usados para exibir a tabela)
  const [reprocessoAppliedTipo, setReprocessoAppliedTipo] = useState<"" | "Cortado" | "Usado">("");
  const [reprocessoAppliedLinha, setReprocessoAppliedLinha] = useState<string>("");
  const [reprocessoAppliedGrupo, setReprocessoAppliedGrupo] = useState<"" | GrupoReprocesso>("");
  const [reprocessoAppliedCodigo, setReprocessoAppliedCodigo] = useState<string>("");
  /** Dialog de filtros do reprocesso — aberto pelo botão Filtros */
  const [reprocessoFiltrosDialogOpen, setReprocessoFiltrosDialogOpen] = useState(false);
  const [reprocessoFiltroTipoPending, setReprocessoFiltroTipoPending] = useState<"" | "Cortado" | "Usado">("");
  const [reprocessoFiltroLinhaPending, setReprocessoFiltroLinhaPending] = useState<string>("");
  const [reprocessoFiltroGrupoPending, setReprocessoFiltroGrupoPending] = useState<"" | GrupoReprocesso>("");
  const [reprocessoFiltroCodigoPending, setReprocessoFiltroCodigoPending] = useState<string>("");
  // Lista de reprocessos filtrada pelos valores aplicados (só atualiza ao clicar em Filtrar)
  const reprocessosFiltrados = useMemo(() => {
    return reprocessos.filter((r) => {
      if (reprocessoAppliedTipo && r.tipo !== reprocessoAppliedTipo) return false;
      if (reprocessoAppliedGrupo && r.grupo !== reprocessoAppliedGrupo) return false;
      if (reprocessoAppliedCodigo.trim()) {
        const codigoVal = (r.codigo ?? "").toString().trim().toLowerCase();
        const filtroCodigo = reprocessoAppliedCodigo.trim().toLowerCase();
        if (!codigoVal.includes(filtroCodigo)) return false;
      }
      if (!reprocessoAppliedLinha) return true;
      const linhaVal = (r.linha ?? "").toString().trim();
      const filtroVal = reprocessoAppliedLinha.trim();
      if (linhaVal === filtroVal) return true;
      const selectedLine = productionLines.find((l) => (l.code ? String(l.code) : `line-${l.id}`) === filtroVal);
      if (selectedLine) {
        const codeOrId = selectedLine.code ? String(selectedLine.code) : `line-${selectedLine.id}`;
        return linhaVal === codeOrId || linhaVal === (selectedLine.name ?? "");
      }
      return false;
    });
  }, [reprocessos, reprocessoAppliedTipo, reprocessoAppliedLinha, reprocessoAppliedGrupo, reprocessoAppliedCodigo, productionLines]);

  // Ao abrir o dialog de filtros do reprocesso, copiar valores aplicados para os campos pendentes
  useEffect(() => {
    if (reprocessoFiltrosDialogOpen) {
      setReprocessoFiltroTipoPending(reprocessoAppliedTipo);
      setReprocessoFiltroLinhaPending(reprocessoAppliedLinha);
      setReprocessoFiltroGrupoPending(reprocessoAppliedGrupo);
      setReprocessoFiltroCodigoPending(reprocessoAppliedCodigo);
    }
  }, [reprocessoFiltrosDialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- sync only when opening

  /** Aplica os filtros do dialog de reprocesso e fecha o dialog */
  const applyReprocessoFiltrosDialog = useCallback(() => {
    setReprocessoFiltroTipo(reprocessoFiltroTipoPending);
    setReprocessoAppliedTipo(reprocessoFiltroTipoPending);
    setReprocessoFiltroLinha(reprocessoFiltroLinhaPending);
    setReprocessoAppliedLinha(reprocessoFiltroLinhaPending);
    setReprocessoFiltroGrupo(reprocessoFiltroGrupoPending);
    setReprocessoAppliedGrupo(reprocessoFiltroGrupoPending);
    setReprocessoFiltroCodigo(reprocessoFiltroCodigoPending);
    setReprocessoAppliedCodigo(reprocessoFiltroCodigoPending);
    setReprocessoFiltrosDialogOpen(false);
  }, [reprocessoFiltroTipoPending, reprocessoFiltroLinhaPending, reprocessoFiltroGrupoPending, reprocessoFiltroCodigoPending]);

  // Normaliza data vinda do banco (string ISO ou Date) para YYYY-MM-DD (evita mistura BELA/Petruz por fuso)
  const normalizeDataDia = (dateValue: string | Date | null | undefined): string => {
    if (!dateValue) return "";
    if (typeof dateValue === "string") return dateValue.split("T")[0];
    return new Date(dateValue).toISOString().split("T")[0];
  };
  // Documentos no intervalo aplicado (De/Até) — só atualiza ao clicar em Filtrar
  const documentsForSelectedDate = useMemo(() => {
    if (!gridDataDeApplied || !gridDataAteApplied || !allRecords.length) return [];
    const de = gridDataDeApplied.split("T")[0];
    const ate = gridDataAteApplied.split("T")[0];
    return allRecords.filter((r) => {
      const dateStr = normalizeDataDia(r.data_dia || r.data_cabecalho || r.data);
      if (!dateStr) return false;
      return dateStr >= de && dateStr <= ate;
    });
  }, [allRecords, gridDataDeApplied, gridDataAteApplied]);

  // Grid: documentos no período, opcionalmente filtrados por filial e por número de documento
  const gridFilteredDocuments = useMemo(() => {
    let list = documentsForSelectedDate;
    if (gridFilialFilterApplied.trim()) {
      const filialNorm = gridFilialFilterApplied.trim();
      list = list.filter((r) => (r.filial_nome || "").trim() === filialNorm);
    }
    if (!gridFilterNumeroDocApplied.trim()) return list;
    const num = parseInt(gridFilterNumeroDocApplied.trim(), 10);
    if (Number.isNaN(num) || num < 1) return list;
    return list.filter((record) => {
      const globalIndex = allRecords.findIndex(
        (r) => (r.recordKey && record.recordKey && r.recordKey === record.recordKey) || (r.id === record.id && (r.doc_id ?? null) === (record.doc_id ?? null))
      );
      const numeroRegistro = globalIndex >= 0 ? globalIndex + 1 : 0;
      return numeroRegistro === num;
    });
  }, [documentsForSelectedDate, gridFilialFilterApplied, gridFilterNumeroDocApplied, allRecords]);

  // OCTP (Problema, Ação, Responsável, Início, Hora inicial, Hora final, Intervalo, Status)
  const [octpInicio, setOctpInicio] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [octpItems, setOctpItems] = useState<OCTPItem[]>([]);
  /** Quando o usuário altera a hora final manualmente, guardamos o timestamp para contar a partir da hora selecionada até status Concluída */
  const [horaFinalBaseSetAt, setHoraFinalBaseSetAt] = useState<Record<number, number>>({});
  /** Ao editar a hora final (campo digitável), guardamos id e valor temporário para não sobrescrever com o contador */
  const [editingHoraFinalId, setEditingHoraFinalId] = useState<number | null>(null);
  const [editingHoraFinalValue, setEditingHoraFinalValue] = useState("");
  /** Ao editar a hora inicial (campo digitável), guardamos id e valor temporário */
  const [editingHoraInicioId, setEditingHoraInicioId] = useState<number | null>(null);
  const [editingHoraInicioValue, setEditingHoraInicioValue] = useState("");
  const [octpLoading, setOctpLoading] = useState(false);
  /** Dialog e filtros do card Problemas e Ações (OCTP): apenas responsável e descrição do status. Aplicados só ao clicar em Filtrar. */
  const [octpFiltrosDialogOpen, setOctpFiltrosDialogOpen] = useState(false);
  const [octpFilterStatus, setOctpFilterStatus] = useState<string>("");
  const [octpFilterResponsavel, setOctpFilterResponsavel] = useState<string>("");
  const [octpFilterStatusPending, setOctpFilterStatusPending] = useState<string>("");
  const [octpFilterResponsavelPending, setOctpFilterResponsavelPending] = useState<string>("");
  // Filiais (OCTF)
  const [filiais, setFiliais] = useState<Array<{ id: number; codigo: string; nome: string; endereco: string }>>([]);
  const [filiaisLoadError, setFiliaisLoadError] = useState<string | null>(null);
  const [itemCatalogLoadError, setItemCatalogLoadError] = useState<string | null>(null);
  const [filialSelecionada, setFilialSelecionada] = useState<string>("");

  // Resolve filial por valor do Select (código ou id quando código vem vazio do banco)
  const filialSelecionadaObj = useMemo(() => {
    if (!filialSelecionada) return null;
    return filiais.find((f) => (f.codigo && String(f.codigo).trim() === filialSelecionada) || `id:${f.id}` === filialSelecionada) ?? null;
  }, [filiais, filialSelecionada]);

  // Filtros do histórico: intervalo de datas, linha e filial (padrão = data de hoje, permitindo seleção)
  const [historyDataInicio, setHistoryDataInicio] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [historyDataFim, setHistoryDataFim] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [historyLinhaFilter, setHistoryLinhaFilter] = useState<string>("");
  /** IDs das linhas do histórico destacadas em vermelho (botão "Marcar") — persistido por usuário no localStorage */
  const [historicoLinhasVermelhas, setHistoricoLinhasVermelhas] = useState<Set<string>>(new Set());
  const [historyFilialFilter, setHistoryFilialFilter] = useState<string>("todas");

  // Persistir linhas vermelhas do histórico por usuário (localStorage); só desmarque ao clicar em Desmarcar
  const historicoVermelhoStorageKey = user?.id ? `erp_historico_linhas_vermelhas_${user.id}` : null;
  const skipNextHistoricoVermelhoSaveRef = useRef(true); // evita sobrescrever ao carregar
  useEffect(() => {
    if (!historicoVermelhoStorageKey) return;
    try {
      const raw = localStorage.getItem(historicoVermelhoStorageKey);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
          setHistoricoLinhasVermelhas(new Set(arr as string[]));
        }
      }
      skipNextHistoricoVermelhoSaveRef.current = true;
    } catch {
      skipNextHistoricoVermelhoSaveRef.current = false;
    }
  }, [historicoVermelhoStorageKey]);
  useEffect(() => {
    if (!historicoVermelhoStorageKey) return;
    if (skipNextHistoricoVermelhoSaveRef.current) {
      skipNextHistoricoVermelhoSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(historicoVermelhoStorageKey, JSON.stringify(Array.from(historicoLinhasVermelhas)));
    } catch {
      // ignora quota ou localStorage indisponível
    }
  }, [historicoVermelhoStorageKey, historicoLinhasVermelhas]);
  const [exportingAllPng, setExportingAllPng] = useState(false);

  const [items, setItems] = useState<ProductionItem[]>([
    {
      id: 1,
      numero: 1,
      dataDia: new Date().toISOString().split("T")[0],
      op: "",
      codigoItem: "",
      descricaoItem: "",
      linha: "",
      quantidadePlanejada: 0,
      quantidadeRealizada: 0,
      diferenca: 0,
      horasTrabalhadas: "",
      restanteHoras: "",
      horaFinal: "",
      calculo1HorasEditMode: false,
      observacao: "",
    },
  ]);

  // Calcular horas restantes para um item específico
  const calculateRestanteHorasForItem = useCallback((item: ProductionItem) => {
    // Verificar se há valor em Calculo 1 Horas
    const calculo1HorasValue = item.horasTrabalhadas
      ? parseFloat(item.horasTrabalhadas.replace(",", "."))
      : 0;

    if (calculo1HorasValue && calculo1HorasValue > 0) {
      try {
        // Dividir a diferença do item pelo Calculo 1 Horas
        const resultado = item.diferenca / calculo1HorasValue;

        // Formatar o resultado (quando tempo esgotado, exibir 00:00)
        if (resultado < 0) {
          return "00:00";
        } else {
          const hours = Math.floor(Math.abs(resultado));
          const minutes = Math.floor((Math.abs(resultado) - hours) * 60);

          if (hours > 0 || minutes > 0) {
            return `${hours}h ${minutes}m`;
          } else {
            return "0h 0m";
          }
        }
      } catch {
        return "";
      }
    } else {
      return "";
    }
  }, []);

  // Calcular hora final para um item específico (sempre exibir previsão: com tempo restante ou hora atual se 00:00)
  const calculateHoraFinalForItem = useCallback((item: ProductionItem) => {
    const restanteHorasItem = calculateRestanteHorasForItem(item);
    if (!restanteHorasItem || restanteHorasItem === "") return "";
    // Quando restante é 00:00 (tempo esgotado), previsão = hora atual
    if (restanteHorasItem === "00:00") return formatTime(currentTime);
    try {
      const match = restanteHorasItem.match(/(\d+)h\s*(\d+)m/);
      if (match) {
        const horasRestantes = parseInt(match[1], 10);
        const minutosRestantes = parseInt(match[2], 10);
        const horaFinalDate = new Date(currentTime);
        horaFinalDate.setHours(horaFinalDate.getHours() + horasRestantes);
        horaFinalDate.setMinutes(horaFinalDate.getMinutes() + minutosRestantes);
        return formatTime(horaFinalDate);
      }
    } catch {
      return "";
    }
    return "";
  }, [currentTime, calculateRestanteHorasForItem]);

  // Atualizar relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Carregar catálogo de itens (OCTI) — Supabase direto (para código → descrição ao digitar)
  useEffect(() => {
    setItemCatalogLoadError(null);
    getItems()
      .then((data) => {
        const map: Record<string, { nome_item: string }> = {};
        for (const it of data) {
          const code = String((it as { codigo_item?: string }).codigo_item ?? "").trim();
          if (code) {
            map[code] = { nome_item: String((it as { nome_item?: string }).nome_item ?? "") };
            const normalizedCode = code.replace(/^0+/, "") || code;
            if (normalizedCode !== code) map[normalizedCode] = map[code];
          }
        }
        setItemCatalog(map);
      })
      .catch((e) => {
        console.error("Erro ao carregar catálogo de itens (OCTI):", e);
        setItemCatalogLoadError("Catálogo de itens indisponível. Verifique RLS na tabela OCTI.");
        toast({
          title: "Catálogo de itens",
          description: "Não foi possível carregar itens (OCTI). Ao digitar o código, a descrição pode não preencher. Execute o script OCTI_RLS_PERMITIR_LEITURA.sql no Supabase.",
          variant: "destructive",
        });
      });
  }, [toast]);

  // Carregar linhas de produção (OCLP) — Supabase direto
  useEffect(() => {
    getLines()
      .then((data) => setProductionLines(data.map((l) => ({ id: l.id, line_id: l.line_id, code: l.code, name: l.name }))))
      .catch((e) => console.error("Erro ao carregar linhas de produção (OCLP):", e));
  }, []);

  // Carregar filiais (OCTF) — Supabase direto
  useEffect(() => {
    setFiliaisLoadError(null);
    getFiliais()
      .then((data) => setFiliais(data))
      .catch((e) => {
        console.error("Erro ao carregar filiais (OCTF):", e);
        setFiliaisLoadError(e?.message || "Falha ao carregar filiais");
        toast({
          title: "Filiais não carregadas",
          description: "Execute no Supabase o script OCTF_RLS_PERMITIR_LEITURA.sql (RLS) e confira se a tabela OCTF tem dados.",
          variant: "destructive",
        });
      });
  }, [toast]);

  // Atualizar horas restantes e hora final para cada item quando necessário (só preenche hora final se o usuário não tiver definido)
  useEffect(() => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        const restanteHoras = calculateRestanteHorasForItem(item);
        const horaFinalCalculada = calculateHoraFinalForItem({ ...item, restanteHoras });
        const horaFinal = (item.horaFinal != null && String(item.horaFinal).trim() !== "") ? item.horaFinal : horaFinalCalculada;
        if (item.restanteHoras !== restanteHoras || item.horaFinal !== horaFinal) {
          return {
            ...item,
            restanteHoras,
            horaFinal,
          };
        }
        return item;
      })
    );
  }, [currentTime, calculateRestanteHorasForItem, calculateHoraFinalForItem]);

  // Formatar hora atual
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  /** Hora final OCTP: se status conclui (Concluída / Concluída com atraso / Não Concluída) mostra valor fixo; senão, se o usuário definiu uma base, conta a partir dela; senão mostra hora atual (contando). Exibição em HH:MM:SS. */
  const getDisplayHoraFinalOCTP = useCallback((item: OCTPItem): string => {
    if (isOCTPStatusRelogioParado(item.descricao_status)) {
      const h = (item.horaFinal ?? "").trim();
      if (!h) return "—";
      return h.length <= 5 ? `${h}:00` : h; // "10:00" → "10:00:00"
    }
    if ((item.horaFinal ?? "").trim() !== "" && horaFinalBaseSetAt[item.id]) {
      const [hh, mm] = [item.horaFinal!.slice(0, 2), item.horaFinal!.slice(3, 5)];
      const base = new Date();
      base.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
      const elapsed = Date.now() - horaFinalBaseSetAt[item.id];
      return formatTime(new Date(base.getTime() + elapsed));
    }
    return formatTime(currentTime);
  }, [currentTime, horaFinalBaseSetAt]);

  /** Parseia "10" → "10:00", "1030" → "10:30", "9:30"/"09:30" etc e retorna "HH:MM" (armazenado); exibição usa HH:MM:SS */
  const parseHoraFinalInput = (s: string): string | null => {
    const t = (s ?? "").trim();
    if (!t) return null;
    const parts = t.split(/[:\s]/).map((x) => parseInt(x, 10));
    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && parts[0] >= 0 && parts[0] <= 23 && parts[1] >= 0 && parts[1] <= 59) {
      return `${String(parts[0]).padStart(2, "0")}:${String(parts[1]).padStart(2, "0")}`;
    }
    if (parts.length === 1 && !Number.isNaN(parts[0])) {
      const n = parts[0];
      if (n >= 0 && n <= 23) return `${String(n).padStart(2, "0")}:00`; // "10" → "10:00", "9" → "09:00"
      const str = String(parts[0]);
      if (str.length === 3) {
        const h = Math.floor(n / 100);
        const m = n % 100;
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; // "930" → "09:30"
      }
      if (str.length === 4) {
        const h = Math.floor(n / 100);
        const m = n % 100;
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; // "1030" → "10:30"
      }
    }
    return null;
  };

  // Formatar data atual
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Converter string de data (YYYY-MM-DD) para Date sem problemas de timezone
  const parseDateString = (dateString: string): Date => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month é 0-indexed no JavaScript
  };

  // Data no formato curto para tabelas (ex: 04/03/2026)
  const formatDateShort = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    const d = parseDateString(dateString);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  // Formatar hora_final (TIMESTAMPTZ) para exibição (HH:MM ou HH:MM:SS)
  const formatHoraFinal = (isoString: string | null | undefined): string => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "-";
    }
  };


  // Funções da calculadora
  const calculate = (prev: number, current: number, op: string): number => {
    switch (op) {
      case "+":
        return prev + current;
      case "-":
        return prev - current;
      case "*":
        return prev * current;
      case "/":
        return current !== 0 ? prev / current : 0;
      default:
        return current;
    }
  };

  const getOperationSymbol = (op: string): string => {
    switch (op) {
      case "+": return "+";
      case "-": return "−";
      case "*": return "×";
      case "/": return "÷";
      default: return op;
    }
  };

  const handleCalculatorNumber = (num: string) => {
    let newDisplay: string;
    if (calculatorShouldReset || calculatorDisplay === "0") {
      newDisplay = num;
      setCalculatorDisplay(newDisplay);
      setCalculatorShouldReset(false);
    } else {
      newDisplay = calculatorDisplay + num;
      setCalculatorDisplay(newDisplay);
    }

    // Se há uma operação pendente, atualiza a expressão
    if (calculatorOperation && calculatorPreviousValue !== null) {
      setCalculatorExpression(`${calculatorPreviousValue} ${getOperationSymbol(calculatorOperation)} ${newDisplay}`);
    } else {
      setCalculatorExpression("");
    }
  };

  const handleCalculatorOperation = (op: string) => {
    const currentValue = parseFloat(calculatorDisplay.replace(",", "."));

    if (calculatorPreviousValue === null) {
      // Primeira operação - salva o valor atual
      setCalculatorPreviousValue(currentValue);
      setCalculatorOperation(op);
      setCalculatorShouldReset(true);
      setCalculatorExpression(`${calculatorDisplay} ${getOperationSymbol(op)}`);
    } else if (calculatorOperation) {
      // Já existe uma operação pendente, calcula primeiro
      const result = calculate(calculatorPreviousValue, currentValue, calculatorOperation);
      const resultStr = result.toString().replace(".", ",");
      setCalculatorPreviousValue(result);
      setCalculatorDisplay(resultStr);
      setCalculatorOperation(op);
      setCalculatorShouldReset(true);
      setCalculatorExpression(`${resultStr} ${getOperationSymbol(op)}`);
    } else {
      // Apenas atualiza a operação (caso tenha clicado em = antes)
      setCalculatorPreviousValue(currentValue);
      setCalculatorOperation(op);
      setCalculatorShouldReset(true);
      setCalculatorExpression(`${calculatorDisplay} ${getOperationSymbol(op)}`);
    }
  };

  const handleCalculatorEquals = () => {
    if (calculatorPreviousValue !== null && calculatorOperation) {
      const currentValue = parseFloat(calculatorDisplay.replace(",", "."));
      const result = calculate(calculatorPreviousValue, currentValue, calculatorOperation);
      const resultStr = result.toString().replace(".", ",");
      setCalculatorDisplay(resultStr);
      setCalculatorPreviousValue(result);
      setCalculatorOperation(null);
      setCalculatorShouldReset(true);
      setCalculatorExpression("");
    }
  };

  const handleCalculatorClear = () => {
    setCalculatorDisplay("0");
    setCalculatorPreviousValue(null);
    setCalculatorOperation(null);
    setCalculatorShouldReset(false);
    setCalculatorExpression("");
  };

  const handleCalculatorDecimal = () => {
    let newDisplay: string;
    if (calculatorShouldReset) {
      newDisplay = "0,";
      setCalculatorDisplay(newDisplay);
      setCalculatorShouldReset(false);
    } else if (!calculatorDisplay.includes(",")) {
      newDisplay = calculatorDisplay + ",";
      setCalculatorDisplay(newDisplay);
    } else {
      return; // Já tem vírgula, não faz nada
    }

    // Se há uma operação pendente, atualiza a expressão
    if (calculatorOperation && calculatorPreviousValue !== null) {
      setCalculatorExpression(`${calculatorPreviousValue} ${getOperationSymbol(calculatorOperation)} ${newDisplay}`);
    }
  };

  const handleCalculatorBackspace = () => {
    if (calculatorDisplay.length > 1) {
      const newDisplay = calculatorDisplay.slice(0, -1);
      setCalculatorDisplay(newDisplay);
      setCalculatorShouldReset(false);
      // Atualiza a expressão se houver operação pendente
      if (calculatorOperation && calculatorPreviousValue !== null) {
        setCalculatorExpression(`${calculatorPreviousValue} ${getOperationSymbol(calculatorOperation)} ${newDisplay}`);
      }
    } else {
      setCalculatorDisplay("0");
      setCalculatorShouldReset(false);
      setCalculatorExpression("");
    }
  };

  const handleCalculatorUseResult = () => {
    const result = calculatorDisplay;
    if (calculatorTargetItemId != null) {
      if (calculatorTargetType === "reprocesso") {
        updateReprocesso(calculatorTargetItemId, "quantidade", result);
      } else {
        updateItem(calculatorTargetItemId, "horasTrabalhadas", result);
        setHorasTrabalhadas(result.replace(",", "."));
        setCalculo1HorasEditMode(false);
      }
    }
    setCalculatorOpen(false);
    setCalculatorDisplay("0");
    setCalculatorPreviousValue(null);
    setCalculatorOperation(null);
    setCalculatorShouldReset(false);
    setCalculatorTargetType(null);
    setCalculatorTargetItemId(null);
  };

  // Resetar calculadora quando abrir
  const handleCalculatorOpen = (open: boolean) => {
    setCalculatorOpen(open);
    if (open) {
      setCalculatorDisplay("0");
      setCalculatorPreviousValue(null);
      setCalculatorOperation(null);
      setCalculatorShouldReset(false);
      setCalculatorExpression("");
    } else {
      setCalculatorTargetItemId(null);
      setCalculatorTargetType(null);
    }
  };

  // Adicionar nova linha
  const addItem = () => {
    const newNumero = items.length > 0 ? Math.max(...items.map((i) => i.numero)) + 1 : 1;
    const newItem: ProductionItem = {
      id: Date.now(),
      numero: newNumero,
      dataDia: new Date().toISOString().split("T")[0],
      op: "",
      codigoItem: "",
      descricaoItem: "",
      linha: "",
      quantidadePlanejada: 0,
      quantidadeRealizada: 0,
      diferenca: 0,
      horasTrabalhadas: "",
      restanteHoras: "",
      horaFinal: "",
      calculo1HorasEditMode: false,
      observacao: "",
    };
    setItems((prevItems) => [...prevItems, newItem]);
  };

  // Adicionar novo reprocesso
  const addReprocesso = () => {
    const newNumero = reprocessos.length > 0 ? Math.max(...reprocessos.map((r) => r.numero)) + 1 : 1;
    const newReprocesso: ReprocessoItem = {
      id: Date.now(),
      numero: newNumero,
      tipo: "Cortado",
      linha: "",
      grupo: "Reprocesso",
      codigo: "",
      descricao: "",
      quantidade: "",
    };
    setReprocessos([...reprocessos, newReprocesso]);
  };

  // Atualizar reprocesso
  const updateReprocesso = (id: number, field: keyof ReprocessoItem, value: any) => {
    setReprocessos(
      reprocessos.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };

          // Se mudar o código do reprocesso, tentar preencher (ou limpar) a descrição automaticamente a partir da OCTI
          if (field === "codigo" && typeof value === "string") {
            const code = value.trim();

            // Se o código foi apagado, limpar também a descrição
            if (!code) {
              updated.descricao = "";
            } else {
              // Tentar busca exata / normalizada no catálogo em memória
              let catalogItem = itemCatalog[code];
              if (!catalogItem) {
                const normalizedCode = code.replace(/^0+/, "") || code;
                catalogItem = itemCatalog[normalizedCode];
              }
              if (catalogItem && catalogItem.nome_item) {
                updated.descricao = catalogItem.nome_item;
              } else {
                (async () => {
                  try {
                    const result = await getItemByCode(code);
                    if (result && result.nome_item) {
                      const nome = result.nome_item as string;
                      const codigoBanco = String(result.codigo_item || code).trim();
                      setItemCatalog((prev) => ({
                        ...prev,
                        [codigoBanco]: { nome_item: nome },
                        [codigoBanco.replace(/^0+/, "") || codigoBanco]: { nome_item: nome },
                      }));
                      setReprocessos((prevReprocessos) =>
                        prevReprocessos.map((rep) =>
                          rep.id === id
                            ? {
                              ...rep,
                              descricao: nome,
                            }
                            : rep
                        )
                      );
                    }
                  } catch (e) {
                    console.error("Erro ao buscar item por código no backend (reprocesso):", e);
                  }
                })();
              }
            }
          }

          return updated;
        }
        return r;
      })
    );
  };

  // Remover reprocesso
  const removeReprocesso = (id: number) => {
    setReprocessos(reprocessos.filter((r) => r.id !== id));
  };

  // Carregar OCTP por data (início) + documento (dataCabecalhoSelecionada + filial)
  const loadOCTP = useCallback(async () => {
    const dataDocumento = dataCabecalhoSelecionada || new Date().toISOString().split("T")[0];
    const filialNome = filialSelecionadaObj?.nome ?? null;

    setOctpLoading(true);
    try {
      const rows = await getOCTPByInicio(
        octpInicio,
        dataDocumento,
        filialNome || undefined
      );
      setOctpItems(
        rows.map((r: OCTPRow) => ({
          id: r.id,
          numero: r.numero,
          problema: r.problema ?? "",
          acao: r.acao ?? "",
          responsavel: r.responsavel ?? "",
          hora: r.hora ?? null,
          inicio: r.inicio ?? octpInicio,
          horaInicio: r.hora_inicio != null ? String(r.hora_inicio).slice(0, 5) : "",
          horaFinal: r.hora_final != null ? String(r.hora_final).slice(0, 5) : "",
          duracaoMinutos: r.duracao_minutos ?? null,
          descricao_status: r.descricao_status ?? "",
        }))
      );
    } catch (e) {
      console.error("Erro ao carregar OCTP:", e);
      toast({ title: "Erro", description: "Não foi possível carregar os registros OCTP.", variant: "destructive" });
      setOctpItems([]);
    } finally {
      setOctpLoading(false);
    }
  }, [octpInicio, dataCabecalhoSelecionada, filialSelecionada, filiais, toast]);


  useEffect(() => {
    if (currentView === "cadastro") loadOCTP();
  }, [currentView, loadOCTP]);

  /** Formata minutos totais como "HH:MM" (ex.: 90 → "01:30") */
  const formatMinutosToHHMM = (totalMinutos: number) => {
    const h = Math.floor(totalMinutos / 60);
    const m = Math.round(totalMinutos % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  /** Calcula o intervalo entre hora inicial e hora final e retorna "HH:MM" ou "—" */
  const formatOCTPIntervalo = (horaInicio: string, horaFinal: string) => {
    const parse = (s: string) => {
      if (!s || !s.trim()) return null;
      const parts = s.trim().split(/[:\s]/).map(Number);
      if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        return parts[0] * 60 + parts[1] + (parts[2] != null && !Number.isNaN(parts[2]) ? parts[2] / 60 : 0);
      }
      return null;
    };
    const minIni = parse(horaInicio);
    const minFim = parse(horaFinal);
    if (minIni == null || minFim == null) return "—";
    let diff = minFim - minIni;
    if (diff < 0) diff += 24 * 60; // passa da meia-noite
    return formatMinutosToHHMM(diff);
  };

  const formatDuracaoMinutos = (min: number | null | undefined) => {
    if (min == null || min < 0) return "—";
    return formatMinutosToHHMM(min);
  };

  /** Retorna a duração em minutos de um item OCTP (para soma do total). Usa a mesma hora final exibida (contagem ao vivo ou base definida pelo usuário). */
  const getOCTPItemMinutos = useCallback(
    (item: OCTPItem): number => {
      const parse = (s: string) => {
        if (!s || !s.trim()) return null;
        const parts = s.trim().split(/[:\s]/).map(Number);
        if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
          return parts[0] * 60 + parts[1] + (parts[2] != null && !Number.isNaN(parts[2]) ? parts[2] / 60 : 0);
        }
        return null;
      };
      if (isOCTPStatusRelogioParado(item.descricao_status)) {
        if (item.horaInicio && item.horaFinal) {
          const minIni = parse(item.horaInicio);
          const minFim = parse(item.horaFinal);
          if (minIni != null && minFim != null) {
            let diff = minFim - minIni;
            if (diff < 0) diff += 24 * 60;
            return diff;
          }
        }
        if (item.duracaoMinutos != null && item.duracaoMinutos >= 0) return item.duracaoMinutos;
        return 0;
      }
      if (item.horaInicio) {
        const minIni = parse(item.horaInicio);
        const horaFimDisplay = getDisplayHoraFinalOCTP(item);
        const minFim = parse(horaFimDisplay);
        if (minIni != null && minFim != null) {
          let diff = minFim - minIni;
          if (diff < 0) diff += 24 * 60;
          return diff;
        }
      }
      return 0;
    },
    [getDisplayHoraFinalOCTP]
  );

  /** Total de minutos de intervalo (soma de todos os itens OCTP). */
  const octpTotalIntervaloMinutos = useMemo(
    () => octpItems.reduce((acc, item) => acc + getOCTPItemMinutos(item), 0),
    [octpItems, getOCTPItemMinutos]
  );

  const addOCTPItem = async () => {
    const dataDocumento = dataCabecalhoSelecionada || new Date().toISOString().split("T")[0];
    const filialNome = filialSelecionadaObj?.nome ?? null;

    const newNumero = octpItems.length > 0 ? Math.max(...octpItems.map((o) => o.numero)) + 1 : 1;
    try {
      const inserted = await insertOCTP({
        numero: newNumero,
        problema: "",
        acao: "",
        responsavel: "",
        inicio: octpInicio,
        descricao_status: "",
        dataDia: dataDocumento,
        filialNome: filialNome,
      });
      setOctpItems((prev) => [
        ...prev,
        {
          id: inserted.id,
          numero: inserted.numero,
          problema: inserted.problema ?? "",
          acao: inserted.acao ?? "",
          responsavel: inserted.responsavel ?? "",
          hora: inserted.hora ?? null,
          inicio: inserted.inicio ?? octpInicio,
          horaInicio: inserted.hora_inicio != null ? String(inserted.hora_inicio).slice(0, 5) : "",
          horaFinal: inserted.hora_final != null ? String(inserted.hora_final).slice(0, 5) : "",
          duracaoMinutos: inserted.duracao_minutos ?? null,
          descricao_status: inserted.descricao_status ?? "",
        },
      ]);
    } catch (e) {
      console.error("Erro ao adicionar OCTP:", e);
      toast({ title: "Erro", description: "Não foi possível adicionar o registro.", variant: "destructive" });
    }
  };

  const updateOCTPItem = (id: number, field: keyof OCTPItem, value: string | number) => {
    const item = octpItems.find((o) => o.id === id);
    if (!item) return;
    let updated = { ...item, [field]: value };
    // Ao marcar status como Concluída / Concluída com atraso / Não Concluída, congela a hora final no valor que estava sendo exibido (contando)
    if (field === "descricao_status" && isOCTPStatusRelogioParado(value as string)) {
      const horaFinalCongelada = getDisplayHoraFinalOCTP(item).slice(0, 8); // HH:MM:SS (ou HH:MM se menor)
      updated = { ...updated, horaFinal: horaFinalCongelada.length >= 8 ? horaFinalCongelada : horaFinalCongelada + ":00" };
    }
    setOctpItems(octpItems.map((o) => (o.id === id ? updated : o)));
    const payload: Record<string, unknown> = {
      dataDia: dataCabecalhoSelecionada || new Date().toISOString().split("T")[0],
      filialNome: filialSelecionadaObj?.nome ?? null,
    };
    if (field === "numero") payload.numero = value as number;
    else if (field === "problema") payload.problema = value as string;
    else if (field === "acao") payload.acao = value as string;
    else if (field === "responsavel") payload.responsavel = value as string;
    else if (field === "inicio") payload.inicio = value as string;
    else if (field === "horaInicio") payload.hora_inicio = value as string;
    else if (field === "horaFinal") payload.hora_final = value as string;
    else if (field === "descricao_status") {
      payload.descricao_status = value as string;
      if (isOCTPStatusRelogioParado(value as string)) payload.hora_final = updated.horaFinal;
    }
    if (field === "horaInicio" || field === "horaFinal" || (field === "descricao_status" && isOCTPStatusRelogioParado(value as string))) {
      const mins = computeDuracaoMinutos(updated.horaInicio, updated.horaFinal);
      if (mins !== null) payload.duracao_minutos = mins;
    }
    if (Object.keys(payload).length > 0) {
      updateOCTP(id, payload as Parameters<typeof updateOCTP>[1]).catch((e) => {
        console.error("Erro ao atualizar OCTP:", e);
        toast({ title: "Erro", description: "Não foi possível salvar a alteração.", variant: "destructive" });
      });
    }
  };

  const removeOCTPItem = async (id: number) => {
    try {
      await deleteOCTP(id);
      setOctpItems(octpItems.filter((o) => o.id !== id));
    } catch (e) {
      console.error("Erro ao remover OCTP:", e);
      toast({ title: "Erro", description: "Não foi possível remover o registro.", variant: "destructive" });
    }
  };

  /** Responsáveis já cadastrados no documento (únicos, ordenados) — para o filtro por responsável */
  const octpResponsaveisList = useMemo(() => {
    const set = new Set<string>();
    octpItems.forEach((item) => {
      const r = (item.responsavel ?? "").trim();
      if (r) set.add(r);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [octpItems]);

  /** Lista de itens OCTP filtrada por descrição do status e por responsável (valores aplicados ao clicar em Filtrar) */
  const octpItemsFiltered = useMemo(() => {
    let list = octpItems;
    if (octpFilterStatus) {
      const statusNorm = octpFilterStatus.trim();
      list = list.filter((item) => (item.descricao_status?.trim() || "") === statusNorm);
    }
    if (octpFilterResponsavel) {
      const respNorm = octpFilterResponsavel.trim();
      list = list.filter((item) => (item.responsavel ?? "").trim() === respNorm);
    }
    return list;
  }, [octpItems, octpFilterStatus, octpFilterResponsavel]);

  // Ao abrir o dialog de filtros OCTP, copiar valores aplicados para os campos pendentes
  useEffect(() => {
    if (octpFiltrosDialogOpen) {
      setOctpFilterStatusPending(octpFilterStatus);
      setOctpFilterResponsavelPending(octpFilterResponsavel);
    }
  }, [octpFiltrosDialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- sync only when opening

  /** Aplica os filtros do dialog de Problemas e Ações e fecha o dialog */
  const applyOctpFiltrosDialog = useCallback(() => {
    setOctpFilterStatus(octpFilterStatusPending);
    setOctpFilterResponsavel(octpFilterResponsavelPending);
    setOctpFiltrosDialogOpen(false);
  }, [octpFilterStatusPending, octpFilterResponsavelPending]);

  /** Dados do gráfico de pizza: porcentagem por status (OCTP) — usa lista filtrada */
  const octpStatusPieData = useMemo(() => {
    const countBy: Record<string, number> = {};
    OCTP_STATUS_OPTIONS.forEach((o) => { countBy[o.id] = 0; });
    octpItemsFiltered.forEach((item) => {
      const k = item.descricao_status?.trim() || "";
      if (k && OCTP_STATUS_OPTIONS.some((o) => o.id === k)) countBy[k]++;
      else if (k) countBy[k] = (countBy[k] || 0) + 1;
    });
    const total = octpItemsFiltered.length;
    return OCTP_STATUS_OPTIONS.map((o) => ({
      name: o.label,
      value: total > 0 ? Math.round(((countBy[o.id] ?? 0) / total) * 100) : 0,
      count: countBy[o.id] ?? 0,
      color: o.color,
    })).filter((d) => d.count > 0);
  }, [octpItemsFiltered]);

  /** Total de minutos de intervalo dos itens filtrados (exibido na tabela). */
  const octpTotalIntervaloMinutosFiltered = useMemo(
    () => octpItemsFiltered.reduce((acc, item) => acc + getOCTPItemMinutos(item), 0),
    [octpItemsFiltered, getOCTPItemMinutos]
  );

  // Remover linha (só estado local)
  const removeItem = (id: number) => {
    if (items.length > 1) {
      const newItems = items.filter((item) => item.id !== id);
      const renumberedItems = newItems.map((item, index) => ({
        ...item,
        numero: index + 1,
      }));
      setItems(renumberedItems);
    }
  };

  // Excluir linha: faz DELETE no banco pelo id da OCPD (ocpdId é preenchido ao carregar ou após salvar)
  const handleExcluirLinha = async (item: ProductionItem) => {
    if (items.length <= 1) return;
    const idBanco = item.ocpdId ?? (typeof item.id === "number" && item.id > 100 ? item.id : null);
    if (idBanco != null) {
      try {
        await deleteProducaoRecord(idBanco);
      } catch (err) {
        console.error("Erro ao excluir registro OCPD:", err);
        toast({
          title: "Erro ao excluir",
          description: "Não foi possível excluir o registro no banco. Tente novamente.",
          variant: "destructive",
        });
        return;
      }
    }
    removeItem(item.id);
  };



  // Formatar número com separador de milhar
  const formatNumber = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === "" || value === 0) return "";

    // Se for número, formatar diretamente
    if (typeof value === "number") {
      const parts = value.toString().split(".");
      const integerPart = parts[0];
      const decimalPart = parts[1] || "";
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
    }

    // Se for string, limpar e formatar
    const cleaned = value.replace(/\./g, "").replace(",", ".");
    const numValue = parseFloat(cleaned);
    if (isNaN(numValue) || numValue === 0) return "";

    const parts = numValue.toString().split(".");
    const integerPart = parts[0];
    const decimalPart = parts[1] || "";
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
  };

  // Remover formatação e converter para número (aceita string com vírgula ou número)
  const parseFormattedNumber = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number" && !isNaN(value)) return value;
    const s = String(value).trim();
    if (!s) return 0;
    // Remove pontos (separador de milhar) e substitui vírgula por ponto
    const cleaned = s.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Formatar número para totais (sempre 2 casas decimais)
  const formatTotal = (value: number): string => {
    const numValue = value || 0;
    const parts = numValue.toFixed(2).split(".");
    const integerPart = parts[0];
    const decimalPart = parts[1] || "00";
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formattedInteger},${decimalPart}`;
  };

  // Calcular totais da produção
  const calcularTotaisProducao = () => {
    const totalPlanejada = items.reduce((sum, item) => sum + parseFormattedNumber(item.quantidadePlanejada), 0);
    const totalRealizada = items.reduce((sum, item) => sum + parseFormattedNumber(item.quantidadeRealizada), 0);
    const diferencaTotal = totalPlanejada - totalRealizada;
    return { totalPlanejada, totalRealizada, diferencaTotal };
  };

  // Atualizar automaticamente o percentual da meta com base nos totais (realizada / planejada)
  useEffect(() => {
    const { totalPlanejada, totalRealizada } = calcularTotaisProducao();
    if (totalPlanejada > 0) {
      const perc = (totalRealizada / totalPlanejada) * 100;
      // Armazenar como string com vírgula, para reaproveitar formatação existente
      setPercentualMeta(perc.toFixed(2).replace(".", ","));
    } else {
      setPercentualMeta("");
    }
  }, [items]);

  // Atualizar item
  const updateItem = (id: number, field: keyof ProductionItem, value: string | number | boolean) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          // Quantidades: guardar como string para permitir digitar vírgula (ex: 1,5)
          const isQtyField = field === "quantidadePlanejada" || field === "quantidadeRealizada";
          const numValue = isQtyField && typeof value === "string" ? value : value;
          const updated = { ...item, [field]: numValue };

          // Se mudar o código do item, tentar preencher (ou limpar) a descrição automaticamente a partir da OCTI
          if (field === "codigoItem" && typeof numValue === "string") {
            const code = numValue.trim();

            // Se o código foi apagado, limpar também a descrição
            if (!code) {
              updated.descricaoItem = "";
            } else {
              // Tentar busca exata / normalizada no catálogo em memória
              let catalogItem = itemCatalog[code];
              if (!catalogItem) {
                const normalizedCode = code.replace(/^0+/, "") || code;
                catalogItem = itemCatalog[normalizedCode];
              }
              if (catalogItem && catalogItem.nome_item) {
                updated.descricaoItem = catalogItem.nome_item;
              } else {
                (async () => {
                  try {
                    const result = await getItemByCode(code);
                    if (result && result.nome_item) {
                      const nome = result.nome_item as string;
                      const codigoBanco = String(result.codigo_item || code).trim();
                      setItemCatalog((prev) => ({
                        ...prev,
                        [codigoBanco]: { nome_item: nome },
                        [codigoBanco.replace(/^0+/, "") || codigoBanco]: { nome_item: nome },
                      }));
                      setItems((prevItems) =>
                        prevItems.map((it) =>
                          it.id === id
                            ? {
                              ...it,
                              descricaoItem: nome,
                            }
                            : it
                        )
                      );
                    }
                  } catch (e) {
                    console.error("Erro ao buscar item por código (OCTI):", e);
                    toast({
                      title: "Descrição não encontrada",
                      description: "Não foi possível buscar o item pelo código. Verifique a tabela OCTI e a política RLS (OCTI_RLS_PERMITIR_LEITURA.sql).",
                      variant: "destructive",
                    });
                  }
                })();
              }
            }
          }
          // Calcular diferença automaticamente
          if (field === "quantidadePlanejada" || field === "quantidadeRealizada") {
            const planejada = parseFormattedNumber(updated.quantidadePlanejada);
            const realizada = parseFormattedNumber(updated.quantidadeRealizada);
            updated.diferenca = planejada - realizada;
          }
          // Recalcular horas restantes e hora final quando necessário
          if (field === "horasTrabalhadas" || field === "quantidadePlanejada" || field === "quantidadeRealizada" || field === "diferenca") {
            updated.restanteHoras = calculateRestanteHorasForItem(updated);
            updated.horaFinal = calculateHoraFinalForItem({ ...updated, restanteHoras: updated.restanteHoras });
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Função para salvar dados no Supabase
  const saveToDatabase = async () => {
    if (items.length === 0) {
      setSaveStatus({ success: false, message: "Não há dados para salvar" });
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    // Validar se filial foi selecionada (resolvida por código ou id quando código vem vazio)
    if (!filialSelecionadaObj || !filialSelecionadaObj.nome) {
      setSaveStatus({ success: false, message: "Por favor, selecione uma filial antes de salvar" });
      setSaving(false);
      return;
    }

    const filialNomeCompleto = filialSelecionadaObj.nome;

    try {
      const result = await saveProducao({
        dataDia: dataCabecalhoSelecionada || new Date().toISOString().split("T")[0],
        filialNome: filialNomeCompleto,
        docId: currentDocId,
        items: items.map((i) => ({
          ...i,
          quantidadePlanejada: parseFormattedNumber(i.quantidadePlanejada),
          quantidadeRealizada: parseFormattedNumber(i.quantidadeRealizada),
        })),
        existingIds: items.map((i) => (i.ocpdId != null ? i.ocpdId : null)),
        reprocessos: reprocessos.map((r) => ({
          ...r,
          quantidade: parseFormattedNumber(r.quantidade),
        })),
        latasPrevista: parseFormattedNumber(latasPrevista),
        latasRealizadas: parseFormattedNumber(latasRealizadas),
        latasBatidas: parseFormattedNumber(latasBatidas),
        totalCortado: parseFormattedNumber(totalCortado),
        percentualMeta: parseFormattedNumber(percentualMeta),
        totalReprocesso: parseFormattedNumber(totalReprocesso),
      });

      const wasUpdate = (result.updated ?? 0) > 0;
      const savedDate = dataCabecalhoSelecionada || new Date().toISOString().split("T")[0];
      setAvailableDates(prev => new Set([...prev, savedDate]));

      if (wasUpdate) {
        setSaveStatus({
          success: true,
          message: result.inserted > 0
            ? `${result.updated} item(ns) atualizado(s) e ${result.inserted} novo(s) salvo(s)!`
            : `${result.updated} item(ns) atualizado(s) com sucesso!`,
        });
        toast({
          title: "Registro atualizado!",
          description: "As alterações foram salvas. Você pode continuar editando ou voltar ao menu.",
          variant: "default",
        });
      } else {
        setSaveStatus({
          success: true,
          message: `${result.inserted} item(ns) cadastrado(s) com sucesso!`,
        });
        toast({
          title: "Programação cadastrada com sucesso!",
          description: "Planilha resetada. Preencha um novo cadastro ou vá ao Histórico para visualizar.",
          variant: "default",
        });
      }

      const listAfterSave = await loadAllRecords();

      // Evitar que o useEffect recarregue do banco e sobrescreva os itens (ex.: observação por linha)
      if (wasUpdate) skipNextDataLoadRef.current = true;

      // Se era novo documento salvo, abrir esse documento na lista (setas) e não resetar
      if (!wasUpdate && currentDocId && Array.isArray(listAfterSave)) {
        const idx = listAfterSave.findIndex((r: any) => (r.doc_id ?? null) === currentDocId);
        if (idx >= 0) {
          loadRecordByIndex(idx);
        } else {
          // documento novo salvo mas não encontrado na lista (ex.: filtro filial) — reseta
          const hoje = new Date().toISOString().split("T")[0];
          setDataCabecalhoSelecionada(hoje);
          setCurrentDocId(null);
          setItems([{ id: 1, numero: 1, dataDia: hoje, op: "", codigoItem: "", descricaoItem: "", linha: "", quantidadePlanejada: 0, quantidadeRealizada: 0, diferenca: 0, horasTrabalhadas: "", restanteHoras: "", horaFinal: "", calculo1HorasEditMode: false, observacao: "" }]);
          setLatasPrevista(""); setLatasRealizadas(""); setLatasBatidas(""); setTotalCortado(""); setPercentualMeta(""); setTotalReprocesso(""); setObservacao(""); setReprocessos([]);
        }
      } else if (!wasUpdate) {
        // Insert sem doc_id (legado): reseta para novo cadastro
        const hoje = new Date().toISOString().split("T")[0];
        setDataCabecalhoSelecionada(hoje);
        setCurrentDocId(null);
        setItems([
          { id: 1, numero: 1, dataDia: hoje, op: "", codigoItem: "", descricaoItem: "", linha: "", quantidadePlanejada: 0, quantidadeRealizada: 0, diferenca: 0, horasTrabalhadas: "", restanteHoras: "", horaFinal: "", calculo1HorasEditMode: false, observacao: "" },
        ]);
        setLatasPrevista(""); setLatasRealizadas(""); setLatasBatidas(""); setTotalCortado(""); setPercentualMeta(""); setTotalReprocesso(""); setObservacao(""); setReprocessos([]);
      }

      // Sempre atualizar ocpdId nos itens inseridos (para o botão Excluir fazer DELETE no banco)
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const newIds = result.data.map((r: { id: number }) => r.id);
        setItems(prev => {
          let idx = 0;
          return prev.map(item => {
            if (item.ocpdId != null) return item;
            const assigned = newIds[idx];
            if (assigned != null) {
              idx++;
              return { ...item, ocpdId: assigned, id: assigned };
            }
            return item;
          });
        });
      }

      setTimeout(() => {
        setSaveStatus(null);
      }, 5000);
    } catch (error: any) {
      console.error("Erro ao salvar produção:", error);
      const msg = error?.message || "Erro ao salvar dados no banco";
      const hintReprocessos = /reprocessos/i.test(msg)
        ? " Execute no Supabase o script OCPD_ADD_COLUMN_REPROCESSOS_JSONB.sql para salvar vários reprocessos."
        : "";
      setSaveStatus({
        success: false,
        message: msg + hintReprocessos,
      });
      toast({
        title: "Falha ao salvar",
        description: msg.includes("RLS") || msg.includes("Nenhum registro foi gravado")
          ? `${msg} Em Relatórios ou no Histórico não aparecerá nada até corrigir.`
          : msg.includes("reprocessos")
            ? `Coluna "reprocessos" não existe no banco. Execute no Supabase o script OCPD_ADD_COLUMN_REPROCESSOS_JSONB.sql e tente salvar de novo.`
            : msg + hintReprocessos,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  saveToDatabaseRef.current = saveToDatabase;

  // Função para carregar dados do Supabase (docId: null = documento legado, string = documento com doc_id; docOrdemGlobal: quando docId é null, identifica qual doc legado carregar)
  const loadFromDatabase = async (data?: string, filialNomeOverride?: string, docId?: string | null, docOrdemGlobal?: number | null) => {
    setLoading(true);
    setSaveStatus(null);

    try {
      const dataToLoad = data || dataCabecalhoSelecionada || new Date().toISOString().split("T")[0];
      const filialNomeToUse = filialNomeOverride ?? filialSelecionadaObj?.nome;
      const result = await loadProducao({ data: dataToLoad, filialNome: filialNomeToUse, docId, docOrdemGlobal });

      if (result.data && result.data.length > 0) {
        // Converter dados do banco (tabela OCPD) para o formato da interface
        const loadedItems: ProductionItem[] = result.data.map((dbItem: any, index: number) => {
          // Converter hora_final de timestamp para string HH:MM:SS
          let horaFinal = "";
          if (dbItem.hora_final) {
            try {
              const date = new Date(dbItem.hora_final);
              horaFinal = formatTime(date);
            } catch (e) {
              horaFinal = "";
            }
          }
          // Data do dia: usar data_dia do banco (evita mostrar data errada ao navegar entre documentos)
          let dataDiaStr = dataToLoad;
          if (dbItem.data_dia) {
            dataDiaStr = typeof dbItem.data_dia === "string"
              ? dbItem.data_dia.split("T")[0]
              : new Date(dbItem.data_dia).toISOString().split("T")[0];
          }

          return {
            id: dbItem.id ?? index + 1,
            ocpdId: dbItem.id != null ? Number(dbItem.id) : undefined,
            numero: dbItem.id ?? index + 1, // número de linha no documento
            dataDia: dataDiaStr,
            op: dbItem.op || "",
            codigoItem: dbItem.codigo_item || "",
            descricaoItem: dbItem.descricao_item || "",
            linha: dbItem.linha || "",
            quantidadePlanejada: parseFloat(dbItem.qtd_planejada) || 0,
            quantidadeRealizada: parseFloat(dbItem.qtd_realizada) || 0,
            diferenca: parseFloat(dbItem.diferenca) || 0,
            horasTrabalhadas: dbItem.calculo_1_horas
              ? dbItem.calculo_1_horas.toString().replace(".", ",")
              : "",
            restanteHoras: dbItem.restante_horas || "",
            horaFinal: horaFinal,
            calculo1HorasEditMode: false,
            observacao: dbItem.observacao ?? "",
          };
        });

        // Carregar a filial do primeiro registro (todos devem ter a mesma filial)
        if (result.data.length > 0 && result.data[0].filial_nome) {
          const filialEncontrada = filiais.find(f => f.nome === result.data[0].filial_nome);
          if (filialEncontrada) {
            setFilialSelecionada(filialEncontrada.codigo?.trim() ? filialEncontrada.codigo.trim() : `id:${filialEncontrada.id}`);
          }
        }

        setItems(loadedItems);
        setCurrentDocId(result.data[0]?.doc_id ?? null);

        // Controle de Latas: preencher do primeiro registro OCPD
        if (result.data.length > 0) {
          const first = result.data[0] as Record<string, unknown>;
          if (first.estim_latas_previstas != null) setLatasPrevista(String(first.estim_latas_previstas).replace(".", ","));
          if (first.estim_latas_realizadas != null) setLatasRealizadas(String(first.estim_latas_realizadas).replace(".", ","));
          if (first.latas_ja_batidas != null) setLatasBatidas(String(first.latas_ja_batidas).replace(".", ","));
          if (first.total_ja_cortado != null) setTotalCortado(String(first.total_ja_cortado).replace(".", ","));
          if (first.percentual_meta != null) setPercentualMeta(String(first.percentual_meta).replace(".", ","));
        }

        // Carregar reprocessos: preferir array da OCPR (múltiplos); senão usar campos do primeiro registro OCPD
        const loadedReprocessos: ReprocessoItem[] = [];
        const grupoPadrao: GrupoReprocesso = "Reprocesso";
        const parseGrupo = (v: unknown): GrupoReprocesso => {
          if (v === "Matéria Prima Açaí" || v === "Matéria Prima Fruto") return v;
          return "Reprocesso";
        };
        if (result.reprocessos && Array.isArray(result.reprocessos) && result.reprocessos.length > 0) {
          result.reprocessos.forEach((r: any, idx: number) => {
            loadedReprocessos.push({
              id: Date.now() + idx,
              numero: r.numero ?? idx + 1,
              tipo: (r.tipo === "Usado" ? "Usado" : "Cortado") as "Cortado" | "Usado",
              linha: r.linha || "",
              grupo: parseGrupo(r.grupo) || grupoPadrao,
              codigo: r.codigo || "",
              descricao: r.descricao || "",
              quantidade: r.quantidade != null ? String(r.quantidade).replace(".", ",") : "",
            });
          });
        } else if (result.data && result.data.length > 0) {
          const firstRecord = result.data[0];
          if (firstRecord.reprocesso_numero || firstRecord.reprocesso_codigo || firstRecord.reprocesso_descricao) {
            const grupoFromJson = (firstRecord as any).reprocessos?.[0]?.grupo;
            loadedReprocessos.push({
              id: Date.now(),
              numero: firstRecord.reprocesso_numero || 1,
              tipo: (firstRecord.reprocesso_tipo as "Cortado" | "Usado") || "Cortado",
              linha: (firstRecord as any).reprocesso_linha || "",
              grupo: parseGrupo(grupoFromJson) || grupoPadrao,
              codigo: firstRecord.reprocesso_codigo || "",
              descricao: firstRecord.reprocesso_descricao || "",
              quantidade: firstRecord.reprocesso_quantidade ? firstRecord.reprocesso_quantidade.toString().replace(".", ",") : "",
            });
          }
        }
        setReprocessos(loadedReprocessos);

        // Adicionar a data ao conjunto de datas disponíveis
        setAvailableDates(prev => new Set([...prev, dataToLoad]));
        toast({
          title: "Dados carregados",
          description: `${result.count} item(ns) carregado(s) do banco!`,
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Erro ao carregar produção:", error);
      toast({
        title: "Erro ao carregar",
        description: error.message || "Erro ao carregar dados do banco",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar rascunho da Produção (estado deixado pelo mesmo usuário em outra sessão/turno)
  const loadDraftProducao = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const result = await getDraft(user.id, DRAFT_SCREEN);
      if (result.data == null) return false;
      const d = result.data as Record<string, unknown>;
      if (d.dataCabecalhoSelecionada) setDataCabecalhoSelecionada(String(d.dataCabecalhoSelecionada));
      if (d.filialSelecionada != null) setFilialSelecionada(String(d.filialSelecionada));
      if (d.currentDocId != null) setCurrentDocId(String(d.currentDocId));
      if (Array.isArray(d.items) && d.items.length > 0) {
        setItems(d.items as ProductionItem[]);
      }
      if (Array.isArray(d.reprocessos)) {
        setReprocessos(d.reprocessos as ReprocessoItem[]);
      }
      if (d.latasPrevista != null) setLatasPrevista(String(d.latasPrevista));
      if (d.latasRealizadas != null) setLatasRealizadas(String(d.latasRealizadas));
      if (d.latasBatidas != null) setLatasBatidas(String(d.latasBatidas));
      if (d.totalCortado != null) setTotalCortado(String(d.totalCortado));
      if (d.percentualMeta != null) setPercentualMeta(String(d.percentualMeta));
      if (d.totalReprocesso != null) setTotalReprocesso(String(d.totalReprocesso));
      if (d.observacao != null) setObservacao(String(d.observacao));
      return true;
    } catch {
      return false;
    }
  }, [user?.id]);

  // Salvar rascunho da Produção (auto-salvo para o mesmo usuário ver em outro turno)
  const saveDraftProducao = useCallback(async () => {
    if (!user?.id) return;
    try {
      const payload = {
        dataCabecalhoSelecionada,
        filialSelecionada,
        currentDocId,
        items,
        reprocessos,
        latasPrevista,
        latasRealizadas,
        latasBatidas,
        totalCortado,
        percentualMeta,
        totalReprocesso,
        observacao,
      };
      await saveDraft(user.id, DRAFT_SCREEN, payload);
    } catch (e) {
      console.warn("Erro ao salvar rascunho:", e);
    }
  }, [
    user?.id,
    dataCabecalhoSelecionada,
    filialSelecionada,
    items,
    reprocessos,
    latasPrevista,
    latasRealizadas,
    latasBatidas,
    totalCortado,
    percentualMeta,
    totalReprocesso,
    observacao,
  ]);

  // Função para carregar histórico de produção (intervalo de datas, filtro por linha e filial)
  const loadHistory = async (opts?: { data?: string; dataInicio?: string; dataFim?: string; linha?: string; filialCodigo?: string }) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      // Intervalo de datas (prioridade)
      const dataInicio = opts?.dataInicio ?? historyDataInicio;
      const dataFim = opts?.dataFim ?? historyDataFim;
      const linha = opts?.linha ?? historyLinhaFilter;
      const filialCodigo = opts?.filialCodigo ?? historyFilialFilter;
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      if (linha && linha.trim() !== "") params.set("linha", linha.trim());
      // Data única (legado, quando não usa intervalo)
      if (!dataInicio && !dataFim && opts?.data) params.set("data", opts.data);
      // Filial: só envia filtro quando o usuário escolheu uma filial específica no histórico; "todas" = não filtra
      if (filialCodigo && filialCodigo !== "todas") {
        const filial = filiais.find(f => (f.codigo && String(f.codigo).trim() === filialCodigo) || `id:${f.id}` === filialCodigo);
        if (filial?.nome) params.set("filialNome", filial.nome);
      }
      const result = await getProducaoHistory({
        limit: params.get("limit") ? Number(params.get("limit")) : 500,
        dataInicio: params.get("dataInicio") ?? undefined,
        dataFim: params.get("dataFim") ?? undefined,
        linha: params.get("linha") ?? undefined,
        filialNome: params.get("filialNome") ?? undefined,
      });

      setHistoryData(Array.isArray(result) ? result : []);
    } catch (error: any) {
      console.error("Erro ao carregar histórico:", error);
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Busca documentos de uma data específica e mescla em allRecords/availableDates (resolve "nenhum registro" em 12/03 etc.)
  const loadDocumentsForDate = useCallback(async (date: string) => {
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) return;
    try {
      const result = await getProducaoHistory({
        dataInicio: date,
        dataFim: date,
        limit: 2000,
      });
      if (!Array.isArray(result) || result.length === 0) return;
      setAllRecords((prev) => {
        const recordsMap = new Map<string, any>();
        prev.forEach((r) => {
          const key = r.recordKey ?? `${normalizeDataDia(r.data_dia || r.data_cabecalho)}_${(r.filial_nome || "").trim()}_${r.doc_id ?? "legacy"}`;
          recordsMap.set(key, { ...r, recordKey: key });
        });
        result.forEach((item: any) => {
          const dateStr = normalizeDataDia(item.data_dia || item.data_cabecalho || item.data);
          if (!dateStr) return;
          const filialNome = (item.filial_nome || "").trim();
          const docId = item.doc_id ?? null;
          const recordKey = `${dateStr}_${filialNome}_${docId ?? "legacy"}`;
          if (!recordsMap.has(recordKey)) {
            recordsMap.set(recordKey, {
              ...item,
              doc_id: docId,
              recordDate: dateStr,
              recordKey,
            });
          }
        });
        const merged = Array.from(recordsMap.values()).sort((a, b) => {
          const dateA = parseDateString(a.recordDate || "");
          const dateB = parseDateString(b.recordDate || "");
          if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
          const cmpFilial = (a.filial_nome || "").localeCompare(b.filial_nome || "");
          if (cmpFilial !== 0) return cmpFilial;
          return (a.id || 0) - (b.id || 0);
        });
        return merged;
      });
      setAvailableDates((prev) => new Set([...prev, date]));
    } catch (e) {
      console.error("Erro ao carregar documentos da data:", e);
    }
  }, []);

  // Busca documentos de um intervalo (De/Até) e mescla em allRecords (para grid com filtro por período)
  const loadDocumentsForDateRange = useCallback(async (de: string, ate: string, codigoItem?: string, linha?: string) => {
    const deNorm = de?.split("T")[0];
    const ateNorm = ate?.split("T")[0];
    if (!deNorm || !ateNorm || !/^\d{4}-\d{2}-\d{2}$/.test(deNorm) || !/^\d{4}-\d{2}-\d{2}$/.test(ateNorm)) return;
    if (deNorm > ateNorm) return;
    try {
      const result = await getProducaoHistory({
        dataInicio: deNorm,
        dataFim: ateNorm,
        limit: 2000,
        ...(codigoItem != null && String(codigoItem).trim() !== "" ? { codigoItem: String(codigoItem).trim() } : {}),
        ...(linha != null && String(linha).trim() !== "" ? { linha: String(linha).trim() } : {}),
      });
      if (!Array.isArray(result) || result.length === 0) return;
      setAllRecords((prev) => {
        const recordsMap = new Map<string, any>();
        prev.forEach((r) => {
          const key = r.recordKey ?? `${normalizeDataDia(r.data_dia || r.data_cabecalho)}_${(r.filial_nome || "").trim()}_${r.doc_id ?? "legacy"}`;
          recordsMap.set(key, { ...r, recordKey: key });
        });
        result.forEach((item: any) => {
          const dateStr = normalizeDataDia(item.data_dia || item.data_cabecalho || item.data);
          if (!dateStr) return;
          const filialNome = (item.filial_nome || "").trim();
          const docId = item.doc_id ?? null;
          const recordKey = `${dateStr}_${filialNome}_${docId ?? "legacy"}`;
          if (!recordsMap.has(recordKey)) {
            recordsMap.set(recordKey, {
              ...item,
              doc_id: docId,
              recordDate: dateStr,
              recordKey,
            });
          }
        });
        const merged = Array.from(recordsMap.values()).sort((a, b) => {
          const dateA = parseDateString(a.recordDate || "");
          const dateB = parseDateString(b.recordDate || "");
          if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
          const cmpFilial = (a.filial_nome || "").localeCompare(b.filial_nome || "");
          if (cmpFilial !== 0) return cmpFilial;
          return (a.id || 0) - (b.id || 0);
        });
        return merged;
      });
      const newDates = new Set<string>();
      result.forEach((item: any) => {
        const dateStr = normalizeDataDia(item.data_dia || item.data_cabecalho || item.data);
        if (dateStr) newDates.add(dateStr);
      });
      if (newDates.size > 0) setAvailableDates((prev) => new Set([...prev, ...newDates]));
    } catch (e) {
      console.error("Erro ao carregar documentos do período:", e);
    }
  }, []);

  // Função para carregar todos os registros ordenados (um registro = um documento: data_dia + filial + doc_id)
  // Sem filtro de filial para o grid mostrar todos os documentos da data (BELA, Petruz, etc.)
  const loadAllRecords = async (): Promise<any[]> => {
    try {
      const result = await getProducaoHistory({ limit: 3000 });

      if (Array.isArray(result) && result.length > 0) {
        const recordsMap = new Map<string, any>();
        const dates = new Set<string>();

        result.forEach((item: any) => {
          const dateStr = normalizeDataDia(item.data_dia || item.data_cabecalho || item.data);
          if (dateStr) {
            dates.add(dateStr);

            const filialNome = (item.filial_nome || '').trim();
            const docId = item.doc_id ?? null;
            const recordKey = `${dateStr}_${filialNome}_${docId ?? 'legacy'}`;

            if (!recordsMap.has(recordKey)) {
              recordsMap.set(recordKey, {
                ...item,
                doc_id: docId,
                recordDate: dateStr,
                recordKey,
              });
            }
          }
        });

        const allRecordsSorted = Array.from(recordsMap.values()).sort((a, b) => {
          const dateA = parseDateString(a.recordDate);
          const dateB = parseDateString(b.recordDate);
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }
          const cmpFilial = (a.filial_nome || '').localeCompare(b.filial_nome || '');
          if (cmpFilial !== 0) return cmpFilial;
          return (a.id || 0) - (b.id || 0);
        });

        setAllRecords(allRecordsSorted);
        setAvailableDates(dates);
        return allRecordsSorted;
      }
      return [];
    } catch (error: any) {
      console.error("Erro ao carregar registros:", error);
      return [];
    }
  };

  // Função para verificar se existe cadastro em uma data específica
  const hasCadastroForDate = (date: string): boolean => {
    return availableDates.has(date);
  };

  // Função para verificar se há registro anterior (ou se está em "novo" e existe algum documento para voltar)
  const hasPreviousRecord = (): boolean => {
    const currentIndex = currentRecordIndex >= 0 ? currentRecordIndex : findCurrentRecordIndex();
    if (currentIndex > 0) return true;
    if (currentIndex === -1 && allRecords.length > 0) return true; // formulário vazio: seta "voltar" leva ao último doc
    return false;
  };

  // Função para verificar se há próximo registro (ou se está em "novo" e existe algum documento para acessar)
  const hasNextRecord = (): boolean => {
    const currentIndex = currentRecordIndex >= 0 ? currentRecordIndex : findCurrentRecordIndex();
    if (currentIndex >= 0 && currentIndex < allRecords.length - 1) return true;
    if (currentIndex === -1 && allRecords.length > 0) return true; // formulário vazio: seta "próximo" leva ao primeiro doc
    return false;
  };

  // Função para encontrar o índice do registro atual (documento = data + filial)
  const findCurrentRecordIndex = (): number => {
    if (allRecords.length === 0) return -1;

    if (currentRecordId !== null) {
      const index = allRecords.findIndex(r => r.id === currentRecordId);
      if (index >= 0) return index;
    }

    const currentDate = dataCabecalhoSelecionada;
    const currentFilialNome = filialSelecionadaObj?.nome ?? '';
    const index = allRecords.findIndex(r => {
      const recordDate = r.data_dia || r.data_cabecalho || r.data;
      const dateStr = typeof recordDate === 'string'
        ? recordDate.split('T')[0]
        : new Date(recordDate).toISOString().split('T')[0];
      const recordFilial = (r.filial_nome || '').trim();
      const sameDoc = (r.doc_id ?? null) === (currentDocId ?? null);
      return dateStr === currentDate && recordFilial === (currentFilialNome || '').trim() && sameDoc;
    });

    return index >= 0 ? index : -1;
  };

  // Função para carregar um registro específico pelo índice (um documento = data + filial + doc_id)
  const loadRecordByIndex = async (index: number) => {
    if (index < 0 || index >= allRecords.length) return;

    isNewDocumentRef.current = false;
    setShowDocumentGridForDate(false);
    justLoadedByIndexRef.current = true; // evita que o useEffect sobrescreva os dados ao mudar dataCabecalhoSelecionada
    const record = allRecords[index];
    const recordDate = record.data_dia || record.data_cabecalho || record.data;
    const dateStr = typeof recordDate === 'string'
      ? recordDate.split('T')[0]
      : new Date(recordDate).toISOString().split('T')[0];

    setDataCabecalhoSelecionada(dateStr);
    setCurrentRecordIndex(index);
    setCurrentRecordId(record.id);
    setCurrentDocId(record.doc_id ?? null);
    const recordFilialNome = (record.filial_nome || '').trim();
    if (recordFilialNome) {
      const filialEncontrada = filiais.find(f => (f.nome || '').trim() === recordFilialNome);
      if (filialEncontrada) setFilialSelecionada(filialEncontrada.codigo?.trim() ? filialEncontrada.codigo.trim() : `id:${filialEncontrada.id}`);
    }

    await loadFromDatabase(dateStr, recordFilialNome || undefined, record.doc_id ?? undefined);
  };

  // Função para navegar para registro anterior
  const navigateToPreviousRecord = () => {
    const currentIndex = currentRecordIndex >= 0 ? currentRecordIndex : findCurrentRecordIndex();

    if (currentIndex > 0) {
      loadRecordByIndex(currentIndex - 1);
    } else if (currentIndex === -1 && allRecords.length > 0) {
      loadRecordByIndex(allRecords.length - 1); // formulário vazio: voltar = ir ao último documento
    }
  };

  // Função para navegar para próximo registro
  const navigateToNextRecord = () => {
    const currentIndex = currentRecordIndex >= 0 ? currentRecordIndex : findCurrentRecordIndex();

    if (currentIndex >= 0 && currentIndex < allRecords.length - 1) {
      loadRecordByIndex(currentIndex + 1);
    } else if (currentIndex === -1 && allRecords.length > 0) {
      loadRecordByIndex(0); // formulário vazio: próximo = ir ao primeiro documento
    }
  };

  // Função para navegar para data anterior (apenas se houver cadastro) - mantida para compatibilidade
  const navigateToPreviousDate = () => {
    navigateToPreviousRecord();
  };

  // Função para navegar para próxima data (apenas se houver cadastro) - mantida para compatibilidade
  const navigateToNextDate = () => {
    navigateToNextRecord();
  };

  // Função para criar novo cadastro (limpar tudo); gera novo doc_id para não misturar com outros no mesmo dia
  const createNewCadastro = () => {
    isNewDocumentRef.current = true;
    setShowDocumentGridForDate(false);
    setCurrentRecordIndex(-1);
    setCurrentRecordId(null);
    setCurrentDocId(crypto.randomUUID());
    const hoje = new Date().toISOString().split("T")[0];
    setDataCabecalhoSelecionada(hoje);
    setItems([
      {
        id: 1,
        numero: 1,
        dataDia: hoje,
        op: "",
        codigoItem: "",
        descricaoItem: "",
        linha: "",
        quantidadePlanejada: 0,
        quantidadeRealizada: 0,
        diferenca: 0,
        horasTrabalhadas: "",
        restanteHoras: "",
        horaFinal: "",
        calculo1HorasEditMode: false,
        observacao: "",
      },
    ]);
    setReprocessos([]);
    setLatasPrevista("");
    setLatasRealizadas("");
    setLatasBatidas("");
    setTotalCortado("");
    setPercentualMeta("");
    setTotalReprocesso("");
    setObservacao("");
    setFilialSelecionada("");
    setSaveStatus(null);
  };

  // Carregar dados ao montar: se houver rascunho do usuário, restaurar; senão carregar do banco
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user?.id) {
        const restored = await loadDraftProducao();
        if (cancelled) return;
        if (restored) {
          skipNextDataLoadRef.current = true;
          setTimeout(() => {
            loadHistory();
            loadAllRecords();
          }, 150);
          return;
        }
      }
      loadFromDatabase();
      loadHistory();
      loadAllRecords();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando o usuário seleciona uma data que ainda não está na lista (ex.: 12/03), buscar documentos dessa data
  // para que "Nenhum documento nesta data" não apareça indevidamente e o histórico mostre BELA e PETRUZ corretamente
  useEffect(() => {
    const date = dataCabecalhoSelecionada?.trim();
    if (!date || availableDates.has(date)) return;
    if (availableDates.size === 0) return; // evita disparar antes de loadAllRecords ter rodado
    loadDocumentsForDate(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataCabecalhoSelecionada, availableDates]);

  // Quando o grid está visível e o usuário clicou em Filtrar (intervalo aplicado), carregar documentos do período
  useEffect(() => {
    if (!showDocumentGridForDate || !gridDataDeApplied || !gridDataAteApplied) return;
    loadDocumentsForDateRange(
      gridDataDeApplied,
      gridDataAteApplied,
      gridCodigoItemApplied || undefined,
      gridLinhaFilterApplied || undefined
    );
  }, [showDocumentGridForDate, gridDataDeApplied, gridDataAteApplied, gridCodigoItemApplied, gridLinhaFilterApplied, loadDocumentsForDateRange]);

  // Ao abrir o dialog de filtros do grid, copiar valores aplicados para os campos pendentes
  useEffect(() => {
    if (gridFiltrosDialogOpen) {
      setGridDataDePending(gridDataDeApplied);
      setGridDataAtePending(gridDataAteApplied);
      setGridCodigoItemPending(gridCodigoItemApplied);
      setGridLinhaPending(gridLinhaFilterApplied);
    }
  }, [gridFiltrosDialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- sync only when opening

  /** Aplica os filtros do dialog (Data, Código, Linha), mostra o grid e carrega os documentos */
  const applyGridFiltrosDialog = useCallback(() => {
    setGridDataDe(gridDataDePending);
    setGridDataAte(gridDataAtePending);
    setGridDataDeApplied(gridDataDePending);
    setGridDataAteApplied(gridDataAtePending);
    setGridCodigoItem(gridCodigoItemPending);
    setGridCodigoItemApplied(gridCodigoItemPending);
    setGridLinhaFilter(gridLinhaPending);
    setGridLinhaFilterApplied(gridLinhaPending);
    setShowDocumentGridForDate(true);
    setGridFiltrosDialogOpen(false);
    loadDocumentsForDateRange(
      gridDataDePending,
      gridDataAtePending,
      gridCodigoItemPending.trim() || undefined,
      gridLinhaPending.trim() || undefined
    );
  }, [gridDataDePending, gridDataAtePending, gridCodigoItemPending, gridLinhaPending, loadDocumentsForDateRange]);

  // Sincronizar data e filial com o Painel de Controle (dashboard) para acompanhar o diário
  useEffect(() => {
    try {
      const data = dataCabecalhoSelecionada || new Date().toISOString().split("T")[0];
      localStorage.setItem("dashboard_producao_data_dia", data);
      const filialNome = filialSelecionadaObj?.nome ?? "";
      if (filialNome) localStorage.setItem("dashboard_producao_filial_nome", filialNome);
    } catch {}
  }, [dataCabecalhoSelecionada, filialSelecionada, filiais]);

  // Abrir documento vindo de Relatórios (navigate com state: loadData, loadFilialNome, loadDocId?, loadDocOrdemGlobal?)
  useEffect(() => {
    const state = location.state as { loadData?: string; loadFilialNome?: string; loadDocId?: string | null; loadDocOrdemGlobal?: number | null } | null;
    if (!state?.loadData || !state?.loadFilialNome || openedFromStateRef.current || filiais.length === 0) return;
    openedFromStateRef.current = true;
    reportDocumentLoadedRef.current = false;
    setDataCabecalhoSelecionada(state.loadData);
    const filial = filiais.find((f) => (f.nome || "").trim() === (state.loadFilialNome || "").trim());
    if (filial) setFilialSelecionada(filial.codigo?.trim() ? filial.codigo.trim() : `id:${filial.id}`);
    setCurrentView("cadastro");
    loadFromDatabase(state.loadData, state.loadFilialNome, state.loadDocId ?? undefined, state.loadDocOrdemGlobal ?? undefined).finally(() => {
      reportDocumentLoadedRef.current = true;
    });
  }, [location.state, filiais]);

  // Carregar dados quando a data mudar (apenas na view de cadastro)
  useEffect(() => {
    if (currentView === "cadastro") {
      if (skipNextDataLoadRef.current) {
        skipNextDataLoadRef.current = false;
        return; // Acabou de restaurar do rascunho; não sobrescrever.
      }
      if (isNewDocumentRef.current) {
        isNewDocumentRef.current = false;
        return; // Manter formulário vazio após "Novo documento"; setas permitem voltar ao doc.
      }
      if (justLoadedByIndexRef.current) {
        justLoadedByIndexRef.current = false;
        return; // Acabou de carregar pela seta (data+filial corretos); não sobrescrever com load que poderia usar filial desatualizada.
      }
      loadFromDatabase(dataCabecalhoSelecionada, undefined, currentDocId ?? undefined);
      const index = findCurrentRecordIndex();
      if (index >= 0) {
        setCurrentRecordIndex(index);
        if (allRecords[index]) {
          setCurrentRecordId(allRecords[index].id);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataCabecalhoSelecionada, currentView, allRecords, currentDocId]);

  // Manter ref atualizado para salvar ao sair da página ou ao trocar de aba do navegador
  useEffect(() => {
    if (!user?.id) {
      latestDraftRef.current = null;
      return;
    }
    latestDraftRef.current = {
      user_id: user.id,
      payload: {
        dataCabecalhoSelecionada,
        filialSelecionada,
        currentDocId,
        items,
        reprocessos,
        latasPrevista,
        latasRealizadas,
        latasBatidas,
        totalCortado,
        percentualMeta,
        totalReprocesso,
        observacao,
      },
    };
  }, [
    user?.id,
    dataCabecalhoSelecionada,
    filialSelecionada,
    currentDocId,
    items,
    reprocessos,
    latasPrevista,
    latasRealizadas,
    latasBatidas,
    totalCortado,
    percentualMeta,
    totalReprocesso,
    observacao,
  ]);

  // Salvar rascunho ao sair da página (trocar de menu/rota) — evita perder dados
  useEffect(() => {
    return () => {
      const cur = latestDraftRef.current;
      if (!cur?.user_id || !cur.payload) return;
      saveDraft(cur.user_id, DRAFT_SCREEN, cur.payload).catch(() => {});
    };
  }, []);

  // Salvar rascunho ao trocar de aba do navegador (fica salvo mesmo sem clicar em nada)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        const cur = latestDraftRef.current;
        if (!cur?.user_id || !cur.payload) return;
        saveDraft(cur.user_id, DRAFT_SCREEN, cur.payload).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Auto-salvar rascunho enquanto edita — debounce 1s
  useEffect(() => {
    if (!user?.id) return;
    const t = setTimeout(() => {
      saveDraftProducao();
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [
    user?.id,
    dataCabecalhoSelecionada,
    filialSelecionada,
    currentDocId,
    items,
    reprocessos,
    latasPrevista,
    latasRealizadas,
    latasBatidas,
    totalCortado,
    percentualMeta,
    totalReprocesso,
    observacao,
    saveDraftProducao,
  ]);

  // Histórico só carrega ao clicar em Filtrar (não ao abrir a aba)

  // Registrar navegação entre documentos no header (setas + novo doc) - sempre oferecer "Novo documento" nesta página
  useEffect(() => {
    const isCadastroView = currentView === "cadastro";
    const curIdx = currentRecordIndex >= 0 ? currentRecordIndex : findCurrentRecordIndex();
    const total = allRecords.length;

    setDocumentNav({
      showNav: isCadastroView && total > 0,
      canGoPrev: isCadastroView && hasPreviousRecord(),
      canGoNext: isCadastroView && hasNextRecord(),
      onPrev: navigateToPreviousRecord,
      onNext: navigateToNextRecord,
      onNewDocument: () => {
        setCurrentView("cadastro");
        createNewCadastro();
      },
      navLabel: isCadastroView && total > 0 ? (curIdx >= 0 ? `${curIdx + 1} de ${total}` : `Novo · ${total} doc.`) : undefined,
      saving,
      canSave: items.length > 0,
      onSave: () => {
        if (saving || items.length === 0) return;
        void saveToDatabaseRef.current?.();
      },
    });
    return () => setDocumentNav(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, currentRecordIndex, currentRecordId, allRecords.length, dataCabecalhoSelecionada, saving, items.length, filialSelecionada]);

  // Exporta os 4 blocos (Status de Produção, Planejado vs Realizado, Reprocesso, Histórico) como PNGs separados,
  // com dados filtrados pela filial e data do documento aberto. No mobile oferece compartilhar (ex.: WhatsApp).
  const exportAllProducaoAsPNG = async () => {
    const dataDoc = dataCabecalhoSelecionada || new Date().toISOString().split("T")[0];
    const filialDoc = filialSelecionada || "";

    setExportingAllPng(true);
    let switchedToHistoricoForExport = false;
    try {
      // Ajustar filtros do histórico para a filial e data do documento e recarregar (para o PNG do histórico refletir o documento)
      setHistoryDataInicio(dataDoc);
      setHistoryDataFim(dataDoc);
      setHistoryFilialFilter(filialDoc || "todas");
      await loadHistory({
        dataInicio: dataDoc,
        dataFim: dataDoc,
        filialCodigo: filialDoc || undefined,
      });
      await new Promise((r) => setTimeout(r, 400));

      const targetsCadastro: Array<{
        ref: React.RefObject<HTMLElement | null>;
        filenamePrefix: string;
        expandScrollable: boolean;
        onBeforeCapture?: () => void | Promise<void>;
        onAfterCapture?: () => void | Promise<void>;
      }> = [
        { ref: chartStatusProducaoRef, filenamePrefix: "status-producao", expandScrollable: false },
        {
          ref: chartPlanejadoRealizadoRef,
          filenamePrefix: "planejado-realizado",
          expandScrollable: false,
          onBeforeCapture: () => {
            chartPlanejadoRealizadoRef.current?.scrollIntoView({ behavior: "instant", block: "center" });
          },
        },
        {
          ref: reprocessoCardRef,
          filenamePrefix: "reprocesso",
          expandScrollable: true,
          onBeforeCapture: () => {
            const card = reprocessoCardRef.current;
            if (!card) return;
            reprocessoExportRestoreRef.current = [];
            const cells = card.querySelectorAll("table tbody tr td:nth-child(5)");
            cells.forEach((cell) => {
              const input = cell.querySelector("input");
              if (!input) return;
              const el = input as HTMLInputElement;
              const value = el.value ?? "";
              const wrapper = document.createElement("div");
              wrapper.setAttribute("data-export-descricao", "true");
              wrapper.className = "min-h-9 px-3 py-2 rounded-md border border-input bg-background text-sm whitespace-normal break-words w-full min-w-[200px]";
              wrapper.textContent = value || "—";
              el.style.display = "none";
              cell.appendChild(wrapper);
              reprocessoExportRestoreRef.current.push({ input: el, wrapper });
            });
          },
          onAfterCapture: () => {
            reprocessoExportRestoreRef.current.forEach(({ input, wrapper }) => {
              wrapper.remove();
              input.style.display = "";
            });
            reprocessoExportRestoreRef.current = [];
          },
        },
      ];

      const targetHistorico = { ref: historicoCardRef, filenamePrefix: "historico-producao", expandScrollable: true };

      const filesToShare: File[] = [];

      const captureOne = async (t: typeof targetsCadastro[0]) => {
        const el = t.ref.current;
        if (!el) return;
        await new Promise((r) => setTimeout(r, 200));
        const { blob, fileName } = await captureElementToPngBlob(el, {
          expandScrollable: t.expandScrollable,
          onBeforeCapture: t.onBeforeCapture,
          onAfterCapture: t.onAfterCapture,
          filenamePrefix: t.filenamePrefix,
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = fileName;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 300);
        filesToShare.push(new File([blob], fileName, { type: "image/png" }));
      };

      // 1) Capturar os 3 blocos do cadastro enquanto ainda estamos na view cadastro (refs no DOM)
      for (const t of targetsCadastro) {
        try {
          await captureOne(t);
        } catch (err) {
          console.error(`Export PNG failed for ${t.filenamePrefix}:`, err);
        }
      }

      // 2) Se precisar do histórico, trocar para a view histórico, capturar, e voltar
      if (currentView === "cadastro" && !historicoCardRef.current) {
        setCurrentView("historico");
        switchedToHistoricoForExport = true;
        await new Promise((r) => setTimeout(r, 700));
        try {
          await captureOne(targetHistorico);
        } catch (err) {
          console.error(`Export PNG failed for ${targetHistorico.filenamePrefix}:`, err);
        }
        setCurrentView("cadastro");
      } else if (historicoCardRef.current) {
        try {
          await captureOne(targetHistorico);
        } catch (err) {
          console.error(`Export PNG failed for ${targetHistorico.filenamePrefix}:`, err);
        }
      }

      // Compartilhamento (WhatsApp etc.): funciona no celular (Android/iPhone). No computador só baixa as imagens.
      const hasShare = typeof navigator !== "undefined" && navigator.share;
      const canShareFiles = hasShare && (navigator.canShare == null || navigator.canShare({ files: filesToShare, title: "Produção" }));

      if (filesToShare.length > 0 && canShareFiles) {
        try {
          await navigator.share({
            files: filesToShare,
            title: "Produção",
            text: `Produção - ${dataDoc}${filialDoc ? ` - ${filiais.find((f) => f.codigo === filialDoc)?.nome ?? ""}` : ""}`,
          });
          toast({ title: "Compartilhado!", description: "As 4 imagens foram enviadas." });
        } catch (shareErr: unknown) {
          if ((shareErr as Error)?.name !== "AbortError") {
            console.error("Share failed:", shareErr);
          }
          toast({
            title: "4 imagens baixadas",
            description: "Toque em 'Exportar PNG' de novo para abrir o compartilhamento (WhatsApp, etc.).",
          });
        }
      } else if (filesToShare.length > 0) {
        const isMobile = /Android|iPhone|iPad|iPod|webOS|Mobile/i.test(navigator.userAgent);
        toast({
          title: "4 imagens baixadas",
          description: isMobile
            ? "Se a opção de compartilhar não abriu, use os arquivos na pasta Downloads ou tente de novo."
            : "No celular (Android/iPhone), use 'Exportar PNG' para ver a opção de enviar no WhatsApp.",
        });
      }
    } catch (error) {
      console.error("Erro ao exportar PNGs:", error);
      if (switchedToHistoricoForExport) {
        setCurrentView("cadastro");
      }
      if (typeof window !== "undefined" && "toast" in window) {
        (window as unknown as { toast: { error: (m: string) => void } }).toast?.error?.(
          "Não foi possível exportar as imagens. Tente novamente."
        );
      }
    } finally {
      setExportingAllPng(false);
    }
  };

  // Renderizar conteúdo baseado na view atual
  const renderContent = () => {
    // Tela de menu inicial
    if (currentView === "menu") {
      return (
        <div className="space-y-6 pt-6 sm:pt-8">
          {/* Header compacto */}
          <div className="text-center mb-6 space-y-2">
            <div className="inline-flex items-center justify-center mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/15 blur-lg rounded-full animate-pulse" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 via-primary/20 to-primary/10 border border-primary/30 backdrop-blur-sm">
                  <Factory className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent tracking-tight">
              Análise de Produção
            </h1>
            <p className="text-sm text-muted-foreground/70 max-w-xl mx-auto">
              Selecione uma opção para continuar
            </p>
          </div>

          {/* Cards compactos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto w-full">
            {/* Card: Cadastro */}
            <div
              onClick={() => setCurrentView("cadastro")}
              className="group/card relative rounded-2xl border border-border/50 bg-gradient-to-br from-card/95 via-card/90 to-card/85 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.2)] transition-all duration-500 overflow-hidden cursor-pointer transform hover:-translate-y-1 hover:scale-[1.01]"
            >
              {/* Efeitos de fundo animados */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-primary/8 to-primary/3 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 group-hover/card:opacity-100 transition-opacity duration-500" />

              {/* Partículas de brilho */}
              <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-primary/30 rounded-full blur-sm opacity-0 group-hover/card:opacity-100 group-hover/card:animate-ping transition-opacity duration-500" />

              <div className="relative z-10 p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  {/* Ícone compacto */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/15 blur-xl rounded-full scale-125 opacity-0 group-hover/card:opacity-100 group-hover/card:scale-100 transition-all duration-500" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 group-hover/card:scale-105 group-hover/card:rotate-2 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/15 via-white/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                      <Factory className="relative h-8 w-8 text-primary group-hover/card:scale-110 transition-transform duration-500" />
                      <Sparkles className="absolute -top-0.5 -right-0.5 h-4 w-4 text-primary/50 opacity-0 group-hover/card:opacity-100 group-hover/card:animate-spin transition-opacity duration-300" />
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="space-y-2">
                    <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-foreground via-foreground/95 to-foreground/90 bg-clip-text text-transparent group-hover/card:from-primary group-hover/card:via-primary/90 group-hover/card:to-primary/80 transition-all duration-500">
                      Acompanhamento diário da produção
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground/70 leading-relaxed">
                      Registre e gerencie a produção do dia
                    </p>
                  </div>

                  {/* Badge e seta */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] sm:text-xs font-medium group-hover/card:bg-primary/15 group-hover/card:border-primary/35 transition-colors duration-300">
                      <Zap className="h-2.5 w-2.5" />
                      Ativo
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover/card:text-primary group-hover/card:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Planejamento de produção */}
            <div
              onClick={() => navigate("/planejamento-pcp")}
              className="group/card relative rounded-2xl border border-border/50 bg-gradient-to-br from-card/95 via-card/90 to-card/85 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.2)] transition-all duration-500 overflow-hidden cursor-pointer transform hover:-translate-y-1 hover:scale-[1.01]"
            >
              {/* Efeitos de fundo animados */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-primary/8 to-primary/3 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 group-hover/card:opacity-100 transition-opacity duration-500" />

              {/* Partículas de brilho */}
              <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-primary/30 rounded-full blur-sm opacity-0 group-hover/card:opacity-100 group-hover/card:animate-ping transition-opacity duration-500" />

              <div className="relative z-10 p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  {/* Ícone compacto */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/15 blur-xl rounded-full scale-125 opacity-0 group-hover/card:opacity-100 group-hover/card:scale-100 transition-all duration-500" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 group-hover/card:scale-105 group-hover/card:rotate-2 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/15 via-white/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                      <CalendarCheck className="relative h-8 w-8 text-primary group-hover/card:scale-110 transition-transform duration-500" />
                      <Sparkles className="absolute -top-0.5 -right-0.5 h-4 w-4 text-primary/50 opacity-0 group-hover/card:opacity-100 group-hover/card:animate-spin transition-opacity duration-300" />
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="space-y-2">
                    <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-foreground via-foreground/95 to-foreground/90 bg-clip-text text-transparent group-hover/card:from-primary group-hover/card:via-primary/90 group-hover/card:to-primary/80 transition-all duration-500">
                      Planejamento de produção
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground/70 leading-relaxed">
                      Planeje e controle a produção (PCP)
                    </p>
                  </div>

                  {/* Badge e seta */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] sm:text-xs font-medium group-hover/card:bg-primary/15 group-hover/card:border-primary/35 transition-colors duration-300">
                      <CalendarCheck className="h-2.5 w-2.5" />
                      PCP
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover/card:text-primary group-hover/card:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Conteúdo do cadastro (key evita reconciliação com a view histórico = sem animações estranhas na troca de aba)
    if (currentView === "cadastro") {
      const stateFromReport = location.state as { loadData?: string; loadFilialNome?: string } | null;
      const openingFromReport = Boolean(stateFromReport?.loadData && stateFromReport?.loadFilialNome);
      const waitingForReportDocument = openingFromReport && !reportDocumentLoadedRef.current;

      if (waitingForReportDocument) {
        return (
          <div key="cadastro" className="space-y-6 min-w-0">
            <div className="mt-2 mb-2 flex items-center justify-between gap-2 flex-shrink-0 min-h-[3.5rem]">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleVoltar}
                className="size-11 min-h-[44px] min-w-[44px] rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-accent hover:border-primary/30 hover:shadow-md shrink-0"
                aria-label="Voltar ao menu"
                title="Voltar ao menu"
              >
                <ArrowLeft className="size-5 text-foreground shrink-0" strokeWidth={2.5} />
              </Button>
            </div>
            <div className="flex flex-col items-center justify-center min-h-[50vh] py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando documento...</p>
            </div>
          </div>
        );
      }

      return (
        <div key="cadastro" className="space-y-6 min-w-0">
          {/* Voltar — mesma estrutura que na view Histórico para altura consistente */}
          <div className="mt-2 mb-2 flex items-center justify-between gap-2 flex-shrink-0 min-h-[3.5rem]">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVoltar}
              className="size-11 min-h-[44px] min-w-[44px] rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-accent hover:border-primary/30 hover:shadow-md shrink-0"
              aria-label="Voltar ao menu"
              title="Voltar ao menu"
            >
              <ArrowLeft className="size-5 text-foreground shrink-0" strokeWidth={2.5} />
            </Button>
          </div>

          {/* Abas internas: altura fixa para não mudar ao trocar de aba */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex h-12 min-h-12 items-stretch rounded-xl border border-border/60 bg-muted/40 p-1 gap-0.5 flex-shrink-0" role="tablist" aria-label="Navegação da análise de produção">
              <Button
                variant="ghost"
                size="sm"
                role="tab"
                aria-selected={true}
                className="rounded-lg px-4 py-2 h-full min-h-0 text-xs sm:text-sm font-semibold bg-primary/10 text-primary border border-primary/25 shadow-sm hover:bg-primary/15 whitespace-nowrap"
              >
                <span className="sm:hidden">Acompanhamento</span>
                <span className="hidden sm:inline">Acompanhamento diário</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                role="tab"
                aria-selected={false}
                className="rounded-lg px-4 py-2 h-full min-h-0 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 whitespace-nowrap"
                onClick={() => setCurrentView("historico")}
              >
                <span className="sm:hidden">Histórico</span>
                <span className="hidden sm:inline">Histórico de análise</span>
              </Button>
            </div>
          </div>

          {/* Card: Acompanhamento diário da produção */}
          <div ref={producaoCardRef} data-export-target className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] overflow-hidden">
            {/* Efeito de brilho removido no hover para não deixar área branca */}
            {/* Borda superior com gradiente */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

            <div className="relative z-10">
            <div
              className="relative w-full flex flex-col gap-4 p-4 sm:p-6 lg:p-8 transition-all duration-500 group/button bg-gradient-to-r from-transparent via-primary/2 to-transparent min-[892px]:flex-row min-[892px]:items-center min-[892px]:justify-between"
            >
                {/* Tablet/celular: coluna centralizada; computador: linha com ícone à esquerda */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-5 min-w-0 order-1 max-[891px]:flex-col max-[891px]:items-center max-[891px]:text-center max-[891px]:gap-4">
                  {/* Ícone com efeito glassmorphism melhorado */}
                  <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                    <Factory className="relative h-7 w-7 text-primary drop-shadow-lg" />
                  </div>

                  <div className="text-left space-y-2 min-w-0 flex-1 w-full max-[891px]:text-center">
                    <div className="relative rounded-2xl min-h-[2.5rem] flex items-center justify-center">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500 pointer-events-none" />
                      <h2 className="relative z-10 text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500 text-center">
                        Acompanhamento diário da produção
                      </h2>
                    </div>
                    <p className="text-sm text-muted-foreground/80 font-medium">
                      Registre e gerencie a produção do dia
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1 max-[891px]:items-center max-[891px]:justify-center">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary/70" />
                        <span className="text-sm sm:text-base font-mono font-semibold text-primary">
                          {formatTime(currentTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DatePicker
                          value={dataCabecalhoSelecionada}
                          onChange={(v) => {
                            setDataCabecalhoSelecionada(v);
                            setShowDocumentGridForDate(true);
                            const dataNorm = (v || "").split("T")[0];
                            if (dataNorm) {
                              setGridDataDe(dataNorm);
                              setGridDataAte(dataNorm);
                              setGridDataDeApplied(dataNorm);
                              setGridDataAteApplied(dataNorm);
                            }
                          }}
                          placeholder="Data"
                          triggerClassName="border-transparent group-hover:border-primary/30 bg-transparent hover:bg-muted/60 px-2 py-1 min-h-0 h-auto text-sm sm:text-base text-muted-foreground/90 font-medium"
                          className="min-w-[140px]"
                        />
                        <Dialog open={gridFiltrosDialogOpen} onOpenChange={setGridFiltrosDialogOpen}>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium border border-input bg-background hover:bg-muted/50 shrink-0"
                              aria-label="Abrir filtros de produção"
                            >
                              <Filter className="h-4 w-4 shrink-0" />
                              <span>Filtros</span>
                            </button>
                          </DialogTrigger>
                          <DialogContent className="w-[340px] sm:w-[380px] max-w-[95vw] p-4 rounded-lg" onClick={(e) => e.stopPropagation()}>
                            <DialogHeader>
                              <DialogTitle className="text-base">Filtros de produção</DialogTitle>
                              <DialogDescription className="text-sm text-muted-foreground">
                                Defina data, código do item e linha. Ao clicar em Filtrar, o grid de documentos será exibido.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-3 py-2">
                              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                                <Label htmlFor="grid-dialog-de" className="text-xs text-muted-foreground">De</Label>
                                <DatePicker
                                  id="grid-dialog-de"
                                  value={gridDataDePending}
                                  onChange={(v) => v && setGridDataDePending(v)}
                                  placeholder="Data"
                                  className="min-w-0"
                                  triggerClassName="h-9 rounded-md border border-input bg-background px-2 text-sm w-full"
                                />
                              </div>
                              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                                <Label htmlFor="grid-dialog-ate" className="text-xs text-muted-foreground">Até</Label>
                                <DatePicker
                                  id="grid-dialog-ate"
                                  value={gridDataAtePending}
                                  onChange={(v) => v && setGridDataAtePending(v)}
                                  placeholder="Data"
                                  className="min-w-0"
                                  triggerClassName="h-9 rounded-md border border-input bg-background px-2 text-sm w-full"
                                />
                              </div>
                              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                                <Label htmlFor="grid-dialog-codigo" className="text-xs text-muted-foreground">Código do item</Label>
                                <Input
                                  id="grid-dialog-codigo"
                                  value={gridCodigoItemPending}
                                  onChange={(e) => setGridCodigoItemPending(e.target.value)}
                                  placeholder="Código"
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                                <Label htmlFor="grid-dialog-linha" className="text-xs text-muted-foreground">Linha</Label>
                                <Select value={gridLinhaPending || "__todas__"} onValueChange={(v) => setGridLinhaPending(v === "__todas__" ? "" : v)}>
                                  <SelectTrigger id="grid-dialog-linha" className="h-9 text-sm">
                                    <SelectValue placeholder="Todas as linhas" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__todas__">Todas as linhas</SelectItem>
                                    {productionLines.map((line) => (
                                      <SelectItem key={line.id} value={String(line.code || line.name || line.id).trim() || `line-${line.id}`}>
                                        {line.name || line.code || `Linha ${line.id}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button type="button" onClick={applyGridFiltrosDialog} className="w-full h-9 bg-primary text-primary-foreground hover:bg-primary/90">
                              Filtrar
                            </Button>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    {/* Abaixo de 892px: botões logo abaixo da hora/data, empilhados e centralizados */}
                    <div className="flex flex-col gap-2 w-full min-[892px]:hidden pt-2 items-center max-w-sm mx-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          documentNav?.onNewDocument?.() ?? navigate("/analise-producao");
                        }}
                        className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary z-20 relative backdrop-blur-sm w-full"
                        title="Novo documento"
                        aria-label="Novo documento"
                      >
                        <FilePlus className="h-4 w-4 shrink-0" />
                        <span>Novo documento</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          saveToDatabase();
                        }}
                        disabled={saving || items.length === 0}
                        className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success z-20 relative backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed w-full"
                        title="Salvar no banco de dados"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        ) : (
                          <Save className="h-4 w-4 shrink-0" />
                        )}
                        <span>{saving ? "Salvando..." : "Salvar"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* A partir de 892px: botões à direita do cabeçalho */}
                <div className="hidden min-[892px]:flex flex-wrap items-center gap-2 sm:gap-2 order-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      documentNav?.onNewDocument?.() ?? navigate("/analise-producao");
                    }}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary z-20 relative backdrop-blur-sm max-[891px]:w-full"
                    title="Novo documento"
                    aria-label="Novo documento"
                  >
                    <FilePlus className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Novo documento</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      saveToDatabase();
                    }}
                    disabled={saving || items.length === 0}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success z-20 relative backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed max-[891px]:w-full"
                    title="Salvar no banco de dados"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : (
                      <Save className="h-4 w-4 shrink-0" />
                    )}
                    <span className="hidden sm:inline">{saving ? "Salvando..." : "Salvar"}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      exportAllProducaoAsPNG();
                    }}
                    disabled={exportingAllPng}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary z-20 relative backdrop-blur-sm max-[891px]:w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Baixa 4 imagens. No celular (Android/iPhone) abre opção de enviar no WhatsApp."
                  >
                    {exportingAllPng ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 shrink-0" />
                    )}
                    <span className="hidden min-[791px]:inline">{exportingAllPng ? "Exportando…" : "Exportar PNG"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-4 sm:p-5 lg:p-7 space-y-5 sm:space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Status de salvamento/carregamento (apenas para Salvar; Carregar usa toast para não deslocar os cards) */}
              {saveStatus && (
                <div
                  className={`flex items-center gap-3 p-4 rounded-lg border ${saveStatus.success
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}
                >
                  {saveStatus.success ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0" />
                  )}
                  <p className="text-sm font-medium">{saveStatus.message}</p>
                </div>
              )}

              {showDocumentGridForDate ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Documentos no período: {formatDateShort(gridDataDeApplied)} até {formatDateShort(gridDataAteApplied)}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 sm:gap-3">
                    <div className="flex flex-col gap-1.5 w-full sm:min-w-[120px] sm:w-auto">
                      <Label className="text-xs font-medium text-muted-foreground">De</Label>
                      <DatePicker
                        value={gridDataDe}
                        onChange={(v) => v && setGridDataDe(v)}
                        size="sm"
                        triggerClassName="h-9 w-full min-w-0 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full sm:min-w-[120px] sm:w-auto">
                      <Label className="text-xs font-medium text-muted-foreground">Até</Label>
                      <DatePicker
                        value={gridDataAte}
                        onChange={(v) => v && setGridDataAte(v)}
                        size="sm"
                        triggerClassName="h-9 w-full min-w-0 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full sm:min-w-[140px] sm:max-w-[180px]">
                      <Label className="text-xs font-medium text-muted-foreground">Filial</Label>
                      <Select
                        value={gridFilialFilter || "__todos__"}
                        onValueChange={(v) => setGridFilialFilter(v === "__todos__" ? "" : v)}
                      >
                        <SelectTrigger className="h-9 w-full text-sm">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__todos__">Todos</SelectItem>
                          {filiais.map((f) => (
                            <SelectItem key={f.id} value={(f.nome || "").trim()}>
                              {(f.nome || "").trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full sm:min-w-[120px] sm:w-auto">
                      <Label htmlFor="grid-filter-numero" className="text-xs font-medium text-muted-foreground">
                        N° documento
                      </Label>
                      <Input
                        id="grid-filter-numero"
                        type="number"
                        min={1}
                        max={allRecords.length || 999}
                        placeholder="Todos"
                        value={gridFilterNumeroDoc}
                        onChange={(e) => setGridFilterNumeroDoc(e.target.value)}
                        className="h-9 w-full sm:w-[100px] text-sm tabular-nums"
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 gap-2 w-full sm:w-auto"
                        onClick={() => {
                          setGridDataDeApplied(gridDataDe);
                          setGridDataAteApplied(gridDataAte);
                          setGridFilialFilterApplied(gridFilialFilter);
                          setGridFilterNumeroDocApplied(gridFilterNumeroDoc.trim());
                        }}
                      >
                        <Filter className="h-4 w-4" />
                        Filtrar
                      </Button>
                      {(gridFilterNumeroDocApplied || gridFilialFilterApplied || gridCodigoItemApplied || gridLinhaFilterApplied) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 w-full sm:w-auto text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setGridFilterNumeroDoc("");
                            setGridFilterNumeroDocApplied("");
                            setGridFilialFilter("");
                            setGridFilialFilterApplied("");
                            setGridCodigoItem("");
                            setGridCodigoItemApplied("");
                            setGridLinhaFilter("");
                            setGridLinhaFilterApplied("");
                          }}
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gridFilteredDocuments.map((record, index) => {
                      const globalIndex = allRecords.findIndex(
                        (r) => (r.recordKey && record.recordKey && r.recordKey === record.recordKey) || (r.id === record.id && (r.doc_id ?? null) === (record.doc_id ?? null))
                      );
                      const recordDate = record.data_dia || record.data_cabecalho || record.data;
                      const dateStr = recordDate ? (typeof recordDate === "string" ? recordDate.split("T")[0] : new Date(recordDate).toISOString().split("T")[0]) : "";
                      return (
                        <div
                          key={record.recordKey ?? `${record.id}-${record.doc_id ?? "legacy"}`}
                          onClick={() => {
                            if (globalIndex >= 0) {
                              loadRecordByIndex(globalIndex);
                              setShowDocumentGridForDate(false);
                            }
                          }}
                          className="group relative rounded-xl border border-border/50 bg-card/95 hover:border-primary/40 hover:bg-muted/60 hover:shadow-md transition-all duration-300 p-4 sm:p-5 cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex min-w-[3.5rem] sm:min-w-[4rem] shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary py-1.5">
                              <span className="text-[10px] font-bold leading-tight">N°</span>
                              <span className="text-sm font-bold tabular-nums">{globalIndex >= 0 ? globalIndex + 1 : index + 1}</span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">de {allRecords.length}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate">
                                {(record.filial_nome || "").trim() || "Sem filial"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {dateStr ? formatDate(parseDateString(dateStr)) : ""}
                              </p>
                              {(record.doc_numero != null || record.doc_id) && (
                                <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono truncate">
                                  Doc. {record.doc_numero != null ? record.doc_numero : String(record.doc_id).slice(0, 8) + "…"}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                          </div>
                        </div>
                      );
                    })}
                    <div
                      onClick={() => {
                        documentNav?.onNewDocument?.();
                        setShowDocumentGridForDate(false);
                      }}
                      className="group relative rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-muted/60 hover:border-primary/60 transition-all duration-300 p-4 sm:p-5 cursor-pointer flex flex-col items-center justify-center min-h-[100px]"
                    >
                      <FilePlus className="h-8 w-8 text-primary mb-2" />
                      <span className="text-sm font-semibold text-primary">Novo documento</span>
                    </div>
                  </div>
                  {documentsForSelectedDate.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum documento nesta data. Clique em &quot;Novo documento&quot; para criar.
                    </p>
                  )}
                  {documentsForSelectedDate.length > 0 && (gridFilterNumeroDocApplied || gridFilialFilterApplied || gridCodigoItemApplied || gridLinhaFilterApplied) && gridFilteredDocuments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum documento encontrado com os filtros aplicados. Use &quot;Limpar&quot; para ver todos.
                    </p>
                  )}
                </div>
              ) : (
                <>
              {/* Campo de seleção de filial */}
              <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <Label htmlFor="filial-select" className="text-sm font-semibold text-card-foreground whitespace-nowrap">
                    Filial:
                  </Label>
                  <Select
                    value={filialSelecionada || "__nenhuma__"}
                    onValueChange={(v) => setFilialSelecionada(v === "__nenhuma__" ? "" : v)}
                  >
                    <SelectTrigger id="filial-select" className="w-full sm:w-[400px]">
                      <SelectValue placeholder="Selecione uma filial" />
                    </SelectTrigger>
                    <SelectContent>
                      {filiais.length === 0 ? (
                        <SelectItem value="__nenhuma__" disabled>
                          Nenhuma filial disponível
                        </SelectItem>
                      ) : (
                        filiais.map((filial) => (
                          <SelectItem key={filial.id} value={filial.codigo?.trim() ? filial.codigo.trim() : `id:${filial.id}`}>
                            {filial.nome}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {(filiais.length === 0 || filiaisLoadError) && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {filiaisLoadError
                        ? "Erro ao carregar. No Supabase: execute OCTF_RLS_PERMITIR_LEITURA.sql e confira se a tabela OCTF tem dados."
                        : "Cadastre filiais na tabela OCTF no Supabase ou execute OCTF_INSERT_DATA.sql."}
                    </p>
                  )}
                </div>
              </div>

              {/* Seção: Produção */}
              <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                {itemCatalogLoadError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                    {itemCatalogLoadError} Execute OCTI_RLS_PERMITIR_LEITURA.sql no Supabase para o código preencher a descrição ao digitar.
                  </p>
                )}
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                      <Factory className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-card-foreground">Produção</h3>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        Gerencie sua produção
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      addItem();
                    }}
                    size="sm"
                    className="w-full sm:w-auto shrink-0 gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all duration-300 z-10 relative"
                    type="button"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate">Adicionar Linha</span>
                  </Button>
                </div>

                <div className="overflow-x-auto -mx-2 sm:mx-0 rounded-lg border border-border/40 [&::-webkit-scrollbar]:h-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="inline-block min-w-full align-middle">
                    <Table className="min-w-[800px] sm:min-w-0">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 sm:w-16 text-center text-xs sm:text-sm">N°</TableHead>
                          <TableHead className="min-w-[120px] sm:min-w-[140px] text-xs sm:text-sm">Data</TableHead>
                          <TableHead className="min-w-[100px] sm:min-w-[120px] text-xs sm:text-sm">OP</TableHead>
                          <TableHead className="min-w-[120px] sm:min-w-[140px] text-xs sm:text-sm">Código</TableHead>
                          <TableHead className="min-w-[480px] sm:min-w-[520px] text-xs sm:text-sm">Descrição</TableHead>
                          <TableHead className="min-w-[120px] sm:min-w-[140px] text-xs sm:text-sm">Linha</TableHead>
                          <TableHead className="min-w-[140px] sm:min-w-[160px] text-xs sm:text-sm">Qtd. Planejada</TableHead>
                          <TableHead className="min-w-[140px] sm:min-w-[160px] text-xs sm:text-sm">Qtd. Realizada</TableHead>
                          <TableHead className="min-w-[120px] sm:min-w-[140px] text-xs sm:text-sm">Diferença</TableHead>
                          <TableHead className="min-w-[160px] sm:min-w-[200px] text-xs sm:text-sm">Observações</TableHead>
                          <TableHead className="w-12 sm:w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center font-medium text-xs sm:text-sm">{item.numero}</TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <DatePicker
                                value={item.dataDia || new Date().toISOString().split("T")[0]}
                                onChange={(v) => updateItem(item.id, "dataDia", v)}
                                size="sm"
                                triggerClassName="h-8 sm:h-9 text-xs sm:text-sm"
                              />
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <Input
                                value={item.op}
                                onChange={(e) => updateItem(item.id, "op", e.target.value)}
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                                placeholder="OP"
                              />
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <Input
                                value={item.codigoItem}
                                onChange={(e) => updateItem(item.id, "codigoItem", e.target.value)}
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                                placeholder="Código"
                              />
                            </TableCell>
                            <TableCell className="p-2 sm:p-4 min-w-[480px] sm:min-w-[520px]">
                              <Input
                                value={item.descricaoItem}
                                onChange={(e) => updateItem(item.id, "descricaoItem", e.target.value)}
                                className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                                placeholder="Descrição"
                                title={item.descricaoItem || undefined}
                              />
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              {productionLines.length > 0 ? (
                                <div className="max-w-[220px]">
                                  <Select
                                    value={item.linha ? String(item.linha) : "__vazio__"}
                                    onValueChange={(value) => updateItem(item.id, "linha", value === "__vazio__" ? "" : value)}
                                  >
                                    <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                                      <SelectValue placeholder="Linha" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-72 text-xs sm:text-sm">
                                      <SelectItem value="__vazio__">—</SelectItem>
                                      {productionLines.map((line) => (
                                        <SelectItem key={line.id} value={line.code ? String(line.code) : `line-${line.id}`}>
                                          {line.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <Input
                                  value={item.linha}
                                  onChange={(e) => updateItem(item.id, "linha", e.target.value)}
                                  className="h-8 sm:h-9 text-xs sm:text-sm max-w-[140px]"
                                  placeholder="Linha"
                                />
                              )}
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <Input
                                type="text"
                                value={typeof item.quantidadePlanejada === "string" ? item.quantidadePlanejada : (item.quantidadePlanejada ? formatNumber(item.quantidadePlanejada) : "")}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "" || /^[\d.,]*$/.test(value)) {
                                    updateItem(item.id, "quantidadePlanejada", value);
                                  }
                                }}
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                                placeholder="0 ou 0,00"
                              />
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <Input
                                type="text"
                                value={typeof item.quantidadeRealizada === "string" ? item.quantidadeRealizada : (item.quantidadeRealizada ? formatNumber(item.quantidadeRealizada) : "")}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === "" || /^[\d.,]*$/.test(value)) {
                                    updateItem(item.id, "quantidadeRealizada", value);
                                  }
                                }}
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                                placeholder="0 ou 0,00"
                              />
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <div
                                className={`flex h-8 sm:h-9 items-center rounded-md border border-input bg-muted/50 px-2 sm:px-3 text-xs sm:text-sm font-medium ${item.diferenca > 0
                                  ? "text-destructive"
                                  : "text-success"
                                  }`}
                              >
                                <Calculator className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                <span className="truncate">{Math.abs(item.diferenca).toFixed(2)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <Input
                                value={item.observacao || ""}
                                onChange={(e) => updateItem(item.id, "observacao", e.target.value)}
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                                placeholder="Anotações, ocorrências..."
                              />
                            </TableCell>
                            <TableCell className="p-2 sm:p-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleExcluirLinha(item)}
                                className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:text-destructive"
                                disabled={items.length === 1}
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}

                        {/* Linha de totais */}
                        {items.length > 0 && (() => {
                          const totais = calcularTotaisProducao();
                          return (
                            <TableRow className="bg-muted/50 hover:bg-muted/50 font-bold border-t-2 border-border/70">
                              <TableCell colSpan={6} className="text-right text-xs sm:text-sm font-bold pr-4">
                                Total
                              </TableCell>
                              <TableCell className="p-2 sm:p-4">
                                <div className="flex h-8 sm:h-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                                  {formatTotal(totais.totalPlanejada)}
                                </div>
                              </TableCell>
                              <TableCell className="p-2 sm:p-4">
                                <div className="flex h-8 sm:h-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                                  {formatTotal(totais.totalRealizada)}
                                </div>
                              </TableCell>
                              <TableCell className="p-2 sm:p-4">
                                <div
                                  className={`flex h-8 sm:h-9 items-center justify-center rounded-md border px-2 text-xs sm:text-sm font-bold ${totais.diferencaTotal > 0
                                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                                    : "border-success/30 bg-success/10 text-success"
                                    }`}
                                >
                                  {formatTotal(Math.abs(totais.diferencaTotal))}
                                </div>
                              </TableCell>
                              <TableCell className="p-2 sm:p-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground whitespace-nowrap">
                                    Total de Reprocesso Usado:
                                  </span>
                                  <Input
                                    type="text"
                                    value={totalReprocesso}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === "" || /^[\d.,]*$/.test(value)) {
                                        setTotalReprocesso(value);
                                      }
                                    }}
                                    className="h-8 sm:h-9 text-xs sm:text-sm text-center font-semibold flex-1 min-w-[80px]"
                                    placeholder="0,00"
                                  />
                                </div>
                              </TableCell>
                              <TableCell colSpan={1} />
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Seção: Controle de Tempo - Um para cada linha */}
              <div className="space-y-3 sm:space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-4 sm:p-5 lg:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                    <div className="mb-4 sm:mb-5 flex items-center gap-3">
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm shrink-0">
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base lg:text-lg font-bold text-card-foreground truncate">
                          Controle de Tempo - Linha {item.numero}
                        </h2>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          Acompanhamento em tempo real
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`calculo1Horas - ${item.id} `} className="text-xs sm:text-sm">Calculo 1 Horas</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 sm:h-6 sm:w-6 shrink-0"
                            onClick={() => {
                              setCalculatorTargetType("item");
                              setCalculatorTargetItemId(item.id);
                              setCalculatorDisplay("0");
                              setCalculatorOpen(true);
                            }}
                            title="Abrir calculadora"
                          >
                            <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                        {!item.calculo1HorasEditMode && item.horasTrabalhadas && item.horasTrabalhadas.trim() ? (
                          <div
                            className="flex h-9 sm:h-10 items-center justify-between rounded-md border border-input bg-success/10 px-2 sm:px-3 font-medium text-success cursor-pointer text-xs sm:text-sm"
                            onClick={() => {
                              updateItem(item.id, "calculo1HorasEditMode", true);
                            }}
                          >
                            <span className="truncate">{item.horasTrabalhadas}</span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0 ml-2">Clique para editar</span>
                          </div>
                        ) : (
                          <Input
                            id={`calculo1Horas - ${item.id} `}
                            type="text"
                            value={item.horasTrabalhadas}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || /^[\d.,]*$/.test(value)) updateItem(item.id, "horasTrabalhadas", value);
                            }}
                            onBlur={() => {
                              if (item.horasTrabalhadas && item.horasTrabalhadas.trim()) {
                                updateItem(item.id, "calculo1HorasEditMode", false);
                              } else {
                                updateItem(item.id, "horasTrabalhadas", "");
                                updateItem(item.id, "calculo1HorasEditMode", true);
                              }
                            }}
                            onFocus={() => {
                              updateItem(item.id, "calculo1HorasEditMode", true);
                            }}
                            placeholder="Digite o valor"
                            className="h-9 sm:h-10 text-xs sm:text-sm"
                            autoFocus={item.calculo1HorasEditMode}
                          />
                        )}
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor={`restanteHoras - ${item.id} `} className="text-xs sm:text-sm">Restante de Horas</Label>
                        <div
                          className={`flex h-9 sm:h-10 items-center rounded-md border border-input px-2 sm:px-3 font-medium text-xs sm:text-sm ${item.restanteHoras === "00:00"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-success/10 text-success"
                            } `}
                        >
                          <span className="truncate">{item.restanteHoras || "---"}</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Cálculo automático</p>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor={`horaAtual - ${item.id} `} className="text-xs sm:text-sm">Hora Atual</Label>
                        <div className="flex h-9 sm:h-10 items-center rounded-md border border-input bg-primary/10 px-2 sm:px-3 text-xs sm:text-sm font-mono font-semibold text-primary">
                          {formatTime(currentTime)}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Atualização automática</p>
                      </div>

                      <div className="space-y-1.5 sm:space-y-2">
                        <Label htmlFor={`horaFinal - ${item.id} `} className="text-xs sm:text-sm">Hora Final (Previsão)</Label>
                        <Input
                          id={`horaFinal - ${item.id} `}
                          type="time"
                          value={(item.horaFinal != null && String(item.horaFinal).trim() !== "")
                            ? String(item.horaFinal).slice(0, 5)
                            : calculateHoraFinalForItem(item).slice(0, 5)}
                          onChange={(e) => updateItem(item.id, "horaFinal", e.target.value)}
                          className="h-9 sm:h-10 text-xs sm:text-sm font-mono font-semibold bg-primary/10 border-input text-primary"
                          title="Hora atual em tempo real quando vazio; altere se quiser definir outra hora"
                        />
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Hora atual em tempo real; pode alterar se quiser</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Seção: Controle de Latas (layout padrão, similar ao Controle de Tempo) */}
              <div className="space-y-3 sm:space-y-4">
                <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-4 sm:p-5 lg:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                  <div className="mb-4 sm:mb-5 flex items-center gap-3">
                    <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm shrink-0">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base lg:text-lg font-bold text-card-foreground truncate">
                        Controle de Latas
                      </h2>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        Estimativas e totais de produção de açaí
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                    {/* Estimativa de Latas de Açaí Prevista */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="latasPrevista" className="text-xs sm:text-sm">Estimativa de Latas de Açaí Prevista</Label>
                      <Input
                        id="latasPrevista"
                        type="text"
                        value={latasPrevista}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^[\d.,]*$/.test(value)) setLatasPrevista(value);
                        }}
                        className="h-9 sm:h-10 text-xs sm:text-sm"
                        placeholder="0 ou 0,00"
                      />
                    </div>

                    {/* Estimativa de Latas de Açaí Realizadas */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="latasRealizadas" className="text-xs sm:text-sm">Estimativa de Latas de Açaí Realizadas</Label>
                      <Input
                        id="latasRealizadas"
                        type="text"
                        value={latasRealizadas}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^[\d.,]*$/.test(value)) setLatasRealizadas(value);
                        }}
                        className="h-9 sm:h-10 text-xs sm:text-sm"
                        placeholder="0 ou 0,00"
                      />
                    </div>

                    {/* Latas já Batidas */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label htmlFor="latasBatidas" className="text-xs sm:text-sm">Latas Já Batidas</Label>
                      <Input
                        id="latasBatidas"
                        type="text"
                        value={latasBatidas}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^[\d.,]*$/.test(value)) setLatasBatidas(value);
                        }}
                        className="h-9 sm:h-10 text-xs sm:text-sm"
                        placeholder="0 ou 0,00"
                      />
                    </div>
                  </div>

                  {/* Percentual Meta dentro do mesmo card */}
                  <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-border/40">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-center">
                      <div>
                        <p className="text-sm sm:text-base font-semibold text-card-foreground">
                          Percentual Meta
                        </p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                          Calculado automaticamente: Total Realizado ÷ Total Planejado
                        </p>
                      </div>
                      <div className="flex items-center justify-start lg:justify-end">
                        <div className="w-20 sm:w-24 h-8 sm:h-9 flex items-center justify-center rounded-md bg-green-700 text-white font-bold text-xs sm:text-sm">
                          {percentualMeta ? `${parseFloat(percentualMeta.replace(",", ".") || "0").toFixed(2).replace(".", ",")}%` : "0,00%"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção: Reprocesso */}
                <div
                  ref={reprocessoCardRef}
                  className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]"
                >
                  <div className="mb-5 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                          <Factory className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-card-foreground">Reprocesso</h3>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Gerencie os reprocessos
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                      <Dialog open={reprocessoFiltrosDialogOpen} onOpenChange={setReprocessoFiltrosDialogOpen}>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium border border-input bg-background hover:bg-muted/50 shrink-0"
                            aria-label="Abrir filtros de reprocesso"
                          >
                            <Filter className="h-4 w-4 shrink-0" />
                            <span>Filtros</span>
                          </button>
                        </DialogTrigger>
                        <DialogContent className="w-[340px] sm:w-[380px] max-w-[95vw] p-4 rounded-lg" onClick={(e) => e.stopPropagation()}>
                          <DialogHeader>
                            <DialogTitle className="text-base">Filtros de reprocesso</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                              Tipo, linha, grupo e código. Os filtros são aplicados ao clicar em Filtrar.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3 py-2">
                            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                              <Label htmlFor="reprocesso-dialog-tipo" className="text-xs text-muted-foreground">Tipo do reprocesso</Label>
                              <Select value={reprocessoFiltroTipoPending || "todos"} onValueChange={(v) => setReprocessoFiltroTipoPending(v === "todos" ? "" : (v as "Cortado" | "Usado"))}>
                                <SelectTrigger id="reprocesso-dialog-tipo" className="h-9 text-sm">
                                  <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todos">Todos</SelectItem>
                                  <SelectItem value="Cortado">Cortado</SelectItem>
                                  <SelectItem value="Usado">Usado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                              <Label htmlFor="reprocesso-dialog-linha" className="text-xs text-muted-foreground">Linha</Label>
                              <Select value={reprocessoFiltroLinhaPending || "todas"} onValueChange={(v) => setReprocessoFiltroLinhaPending(v === "todas" ? "" : v)}>
                                <SelectTrigger id="reprocesso-dialog-linha" className="h-9 text-sm">
                                  <SelectValue placeholder="Todas as linhas" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todas">Todas as linhas</SelectItem>
                                  {productionLines.map((line) => (
                                    <SelectItem key={line.id} value={line.code ? String(line.code) : `line-${line.id}`}>
                                      {line.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                              <Label htmlFor="reprocesso-dialog-grupo" className="text-xs text-muted-foreground">Grupo</Label>
                              <Select value={reprocessoFiltroGrupoPending || "todos"} onValueChange={(v) => setReprocessoFiltroGrupoPending(v === "todos" ? "" : (v as GrupoReprocesso))}>
                                <SelectTrigger id="reprocesso-dialog-grupo" className="h-9 text-sm">
                                  <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todos">Todos</SelectItem>
                                  <SelectItem value="Reprocesso">Reprocesso</SelectItem>
                                  <SelectItem value="Matéria Prima Açaí">Matéria Prima Açaí</SelectItem>
                                  <SelectItem value="Matéria Prima Fruto">Matéria Prima Fruto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                              <Label htmlFor="reprocesso-dialog-codigo" className="text-xs text-muted-foreground">Código do reprocesso</Label>
                              <Input
                                id="reprocesso-dialog-codigo"
                                value={reprocessoFiltroCodigoPending}
                                onChange={(e) => setReprocessoFiltroCodigoPending(e.target.value)}
                                placeholder="Código"
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                          <Button type="button" onClick={applyReprocessoFiltrosDialog} className="w-full h-9 bg-primary text-primary-foreground hover:bg-primary/90">
                            Filtrar
                          </Button>
                        </DialogContent>
                      </Dialog>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.nativeEvent.stopImmediatePropagation();
                          addReprocesso();
                        }}
                        size="sm"
                        className="w-full sm:w-auto shrink-0 gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all duration-300 z-10 relative"
                        type="button"
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        <span className="truncate">Adicionar Reprocesso</span>
                      </Button>
                      <ExportToPng
                        targetRef={reprocessoCardRef}
                        filenamePrefix="reprocesso"
                        expandScrollable={true}
                        onBeforeCapture={() => {
                          const card = reprocessoCardRef.current;
                          if (!card) return;
                          reprocessoExportRestoreRef.current = [];
                          const cells = card.querySelectorAll("table tbody tr td:nth-child(5)");
                          cells.forEach((cell) => {
                            const input = cell.querySelector("input");
                            if (!input) return;
                            const el = input as HTMLInputElement;
                            const value = el.value ?? "";
                            const wrapper = document.createElement("div");
                            wrapper.setAttribute("data-export-descricao", "true");
                            wrapper.className = "min-h-9 px-3 py-2 rounded-md border border-input bg-background text-sm whitespace-normal break-words w-full min-w-[200px]";
                            wrapper.textContent = value || "—";
                            el.style.display = "none";
                            cell.appendChild(wrapper);
                            reprocessoExportRestoreRef.current.push({ input: el, wrapper });
                          });
                        }}
                        onAfterCapture={() => {
                          reprocessoExportRestoreRef.current.forEach(({ input, wrapper }) => {
                            wrapper.remove();
                            input.style.display = "";
                          });
                          reprocessoExportRestoreRef.current = [];
                        }}
                        className="inline-flex h-9 rounded-md px-3 w-full sm:w-auto shrink-0"
                        label="Exportar PNG"
                      />
                    </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-border/40">
                      {(reprocessoAppliedTipo || reprocessoAppliedLinha || reprocessoAppliedGrupo || reprocessoAppliedCodigo) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setReprocessoFiltroTipo("");
                            setReprocessoAppliedTipo("");
                            setReprocessoFiltroLinha("");
                            setReprocessoAppliedLinha("");
                            setReprocessoFiltroGrupo("");
                            setReprocessoAppliedGrupo("");
                            setReprocessoFiltroCodigo("");
                            setReprocessoAppliedCodigo("");
                            setReprocessoFiltroTipoPending("");
                            setReprocessoFiltroLinhaPending("");
                            setReprocessoFiltroGrupoPending("");
                            setReprocessoFiltroCodigoPending("");
                          }}
                        >
                          Limpar filtros
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 sm:w-16 text-center text-xs sm:text-sm">N°</TableHead>
                            <TableHead className="min-w-[140px] sm:min-w-[160px] text-xs sm:text-sm">Tipo do Reprocesso</TableHead>
                            <TableHead className="min-w-[120px] sm:min-w-[160px] text-xs sm:text-sm">Linha</TableHead>
                            <TableHead className="min-w-[160px] sm:min-w-[180px] text-xs sm:text-sm">Grupo</TableHead>
                            <TableHead className="min-w-[120px] sm:min-w-[140px] text-xs sm:text-sm">Código do reprocesso</TableHead>
                            <TableHead className="min-w-[480px] sm:min-w-[520px] text-xs sm:text-sm">Descrição do reprocesso</TableHead>
                            <TableHead className="min-w-[140px] sm:min-w-[160px] text-xs sm:text-sm">Quantidade</TableHead>
                            <TableHead className="w-12 sm:w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reprocessosFiltrados.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                                {reprocessos.length === 0
                                  ? "Nenhum reprocesso cadastrado. Clique em \"Adicionar Reprocesso\" para começar."
                                  : "Nenhum reprocesso corresponde aos filtros selecionados."}
                              </TableCell>
                            </TableRow>
                          ) : (
                            reprocessosFiltrados.map((reprocesso) => (
                              <TableRow key={reprocesso.id}>
                                <TableCell className="text-center font-medium text-xs sm:text-sm">{reprocesso.numero}</TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Select
                                    value={reprocesso.tipo}
                                    onValueChange={(value: "Cortado" | "Usado") => updateReprocesso(reprocesso.id, "tipo", value)}
                                  >
                                    <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs sm:text-sm">
                                      <SelectItem value="Cortado">Cortado</SelectItem>
                                      <SelectItem value="Usado">Usado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  {productionLines.length > 0 ? (
                                    <Select
                                      value={reprocesso.linha ? String(reprocesso.linha) : "__vazio__"}
                                      onValueChange={(value) => updateReprocesso(reprocesso.id, "linha", value === "__vazio__" ? "" : value)}
                                    >
                                      <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm min-w-[100px]">
                                        <SelectValue placeholder="Linha" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-72 text-xs sm:text-sm">
                                        <SelectItem value="__vazio__">—</SelectItem>
                                        {productionLines.map((line) => (
                                          <SelectItem key={line.id} value={line.code ? String(line.code) : `line-${line.id}`}>
                                            {line.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      value={reprocesso.linha}
                                      onChange={(e) => updateReprocesso(reprocesso.id, "linha", e.target.value)}
                                      className="h-8 sm:h-9 text-xs sm:text-sm min-w-[100px]"
                                      placeholder="Linha"
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Select
                                    value={reprocesso.grupo}
                                    onValueChange={(value: GrupoReprocesso) => updateReprocesso(reprocesso.id, "grupo", value)}
                                  >
                                    <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm min-w-[120px]">
                                      <SelectValue placeholder="Grupo" />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs sm:text-sm">
                                      <SelectItem value="Reprocesso">Reprocesso</SelectItem>
                                      <SelectItem value="Matéria Prima Açaí">Matéria Prima Açaí</SelectItem>
                                      <SelectItem value="Matéria Prima Fruto">Matéria Prima Fruto</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Input
                                    value={reprocesso.codigo}
                                    onChange={(e) => updateReprocesso(reprocesso.id, "codigo", e.target.value)}
                                    className="h-8 sm:h-9 text-xs sm:text-sm"
                                    placeholder="Código"
                                  />
                                </TableCell>
                                <TableCell className="p-2 sm:p-4 min-w-[480px] sm:min-w-[520px]">
                                  <Input
                                    value={reprocesso.descricao}
                                    onChange={(e) => updateReprocesso(reprocesso.id, "descricao", e.target.value)}
                                    className="h-8 sm:h-9 text-xs sm:text-sm w-full min-w-0"
                                    placeholder="Descrição"
                                    title={reprocesso.descricao || undefined}
                                  />
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      type="text"
                                      value={reprocesso.quantidade}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === "" || /^[\d.,]*$/.test(value)) {
                                          updateReprocesso(reprocesso.id, "quantidade", value);
                                        }
                                      }}
                                      className="h-8 sm:h-9 text-xs sm:text-sm text-center flex-1 min-w-0"
                                      placeholder="0,00"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 sm:h-6 sm:w-6 shrink-0"
                                      onClick={() => {
                                        setCalculatorTargetType("reprocesso");
                                        setCalculatorTargetItemId(reprocesso.id);
                                        setCalculatorDisplay(reprocesso.quantidade?.trim() && /^[\d.,]+$/.test(reprocesso.quantidade) ? reprocesso.quantidade : "0");
                                        setCalculatorOpen(true);
                                      }}
                                      title="Abrir calculadora"
                                    >
                                      <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeReprocesso(reprocesso.id)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Linha de Totais */}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                        <span className="text-sm font-medium text-muted-foreground">Total Reprocesso Cortado:</span>
                        <span className="text-base font-bold text-foreground">
                          {reprocessosFiltrados
                            .filter((r) => r.tipo === "Cortado")
                            .reduce((sum, r) => {
                              const qtd = parseFloat(r.quantidade.replace(",", ".")) || 0;
                              const codigoNum = parseFloat(String(r.codigo || "").trim().replace(",", "."));
                              const qtdToAdd = (r.codigo && !Number.isNaN(codigoNum) && Math.abs(qtd - codigoNum) < 0.01) ? 0 : qtd;
                              return sum + qtdToAdd;
                            }, 0)
                            .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                        <span className="text-sm font-medium text-muted-foreground">Total Reprocesso Usado:</span>
                        <span className="text-base font-bold text-foreground">
                          {reprocessosFiltrados
                            .filter((r) => r.tipo === "Usado")
                            .reduce((sum, r) => {
                              const qtd = parseFloat(r.quantidade.replace(",", ".")) || 0;
                              const codigoNum = parseFloat(String(r.codigo || "").trim().replace(",", "."));
                              const qtdToAdd = (r.codigo && !Number.isNaN(codigoNum) && Math.abs(qtd - codigoNum) < 0.01) ? 0 : qtd;
                              return sum + qtdToAdd;
                            }, 0)
                            .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção: OCTP (Problema, Ação, Responsável, Início, Hora inicial, Hora final, Intervalo, Status) */}
                <div
                  ref={octpCardRef}
                  className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]"
                >
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                        <ClipboardList className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-card-foreground">Problemas e Ações</h3>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          Registro de problema, ação, responsável, hora inicial/final, intervalo e status
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                      <Dialog open={octpFiltrosDialogOpen} onOpenChange={setOctpFiltrosDialogOpen}>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium border border-input bg-background hover:bg-muted/50 shrink-0"
                            aria-label="Abrir filtros de problemas e ações"
                            aria-haspopup="dialog"
                          >
                            <Filter className="h-4 w-4 shrink-0" />
                            <span>Filtros</span>
                          </button>
                        </DialogTrigger>
                        <DialogContent className="w-[340px] sm:w-[380px] max-w-[95vw] p-4 rounded-lg" onClick={(e) => e.stopPropagation()}>
                          <DialogHeader>
                            <DialogTitle className="text-base">Filtros — Problemas e Ações</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                              Defina responsável e descrição do status. Os filtros são aplicados ao clicar em Filtrar.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3 py-2">
                            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                              <Label htmlFor="octp-dialog-responsavel" className="text-xs text-muted-foreground">Responsável</Label>
                              <Select value={octpFilterResponsavelPending || "__todos__"} onValueChange={(v) => setOctpFilterResponsavelPending(v === "__todos__" ? "" : v)}>
                                <SelectTrigger id="octp-dialog-responsavel" className="h-9 text-sm">
                                  <SelectValue placeholder="Todos os responsáveis" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__todos__">Todos os responsáveis</SelectItem>
                                  {octpResponsaveisList.map((nome) => (
                                    <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                              <Label htmlFor="octp-dialog-status" className="text-xs text-muted-foreground">Descrição do status</Label>
                              <Select value={octpFilterStatusPending || "__todos__"} onValueChange={(v) => setOctpFilterStatusPending(v === "__todos__" ? "" : v)}>
                                <SelectTrigger id="octp-dialog-status" className="h-9 text-sm">
                                  <SelectValue placeholder="Todos os status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__todos__">Todos os status</SelectItem>
                                  {OCTP_STATUS_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
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
                                setOctpFilterStatusPending("");
                                setOctpFilterResponsavelPending("");
                              }}
                            >
                              Limpar
                            </Button>
                            <Button type="button" onClick={applyOctpFiltrosDialog} className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90">
                              Filtrar
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          addOCTPItem();
                        }}
                        disabled={octpLoading}
                        size="sm"
                        className="w-full sm:w-auto shrink-0 gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all duration-300 z-10 relative"
                        type="button"
                      >
                        {octpLoading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
                        <span className="truncate">Adicionar registro</span>
                      </Button>
                      <ExportToPng
                        targetRef={octpCardRef}
                        filenamePrefix="octp-problemas-acoes"
                        className="w-full sm:w-auto shrink-0 gap-2"
                        label="Exportar PNG"
                        onBeforeCapture={() => {
                          const card = octpCardRef.current;
                          if (!card) return;
                          octpExportRestoreRef.current = [];
                          const rows = card.querySelectorAll("table tbody tr");
                          rows.forEach((row, rowIndex) => {
                            // Colunas 2, 3, 4: inputs (Problema, Ação, Responsável)
                            [2, 3, 4].forEach((colNum) => {
                              const cell = row.querySelector(`td:nth-child(${colNum})`);
                              if (!cell) return;
                              const input = cell.querySelector("input");
                              if (!input) return;
                              const el = input as HTMLInputElement;
                              const value = el.value ?? "";
                              const wrapper = document.createElement("div");
                              wrapper.setAttribute("data-export-octp", "true");
                              wrapper.className = "min-h-9 px-3 py-2 rounded-md border border-input bg-background text-sm whitespace-normal break-words w-full min-w-[120px]";
                              wrapper.textContent = value || "—";
                              el.style.display = "none";
                              cell.appendChild(wrapper);
                              octpExportRestoreRef.current.push({ el, wrapper });
                            });
                            // Coluna 9: Status (Select) — exibir label com bolinha colorida
                            const cell7 = row.querySelector("td:nth-child(9)");
                            if (!cell7 || rowIndex >= octpItemsFiltered.length) return;
                            const item = octpItemsFiltered[rowIndex];
                            const statusKey = item.descricao_status?.trim() || "";
                            const statusOpt = OCTP_STATUS_OPTIONS.find((o) => o.id === statusKey);
                            const label = statusOpt ? statusOpt.label : (statusKey || "—");
                            const color = statusOpt ? statusOpt.color : "#6b7280";
                            const firstChild = cell7.firstElementChild as HTMLElement | null;
                            if (!firstChild) return;
                            const wrapper = document.createElement("div");
                            wrapper.setAttribute("data-export-octp", "true");
                            wrapper.className = "min-h-9 px-3 py-2 rounded-md border border-input bg-background text-sm whitespace-normal break-words w-full min-w-[120px] flex items-center gap-2";
                            const dot = document.createElement("span");
                            dot.className = "h-2.5 w-2.5 rounded-full shrink-0";
                            dot.style.backgroundColor = color;
                            const text = document.createElement("span");
                            text.textContent = label;
                            wrapper.appendChild(dot);
                            wrapper.appendChild(text);
                            firstChild.style.display = "none";
                            cell7.appendChild(wrapper);
                            octpExportRestoreRef.current.push({ el: firstChild, wrapper });
                          });
                        }}
                        onAfterCapture={() => {
                          octpExportRestoreRef.current.forEach(({ el, wrapper }) => {
                            wrapper.remove();
                            el.style.display = "";
                          });
                          octpExportRestoreRef.current = [];
                        }}
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 sm:w-16 text-center text-xs sm:text-sm">N°</TableHead>
                            <TableHead className="min-w-[120px] sm:min-w-[160px] text-xs sm:text-sm">Problema</TableHead>
                            <TableHead className="min-w-[120px] sm:min-w-[160px] text-xs sm:text-sm">Ação</TableHead>
                            <TableHead className="min-w-[100px] sm:min-w-[140px] text-xs sm:text-sm">Responsável</TableHead>
                            <TableHead className="min-w-[100px] sm:min-w-[120px] text-xs sm:text-sm">Início</TableHead>
                            <TableHead className="min-w-[90px] sm:min-w-[100px] text-xs sm:text-sm">Hora inicial</TableHead>
                            <TableHead className="min-w-[90px] sm:min-w-[100px] text-xs sm:text-sm">Hora final</TableHead>
                            <TableHead className="min-w-[80px] sm:min-w-[90px] text-xs sm:text-sm text-right">Intervalo</TableHead>
                            <TableHead className="min-w-[150px] sm:min-w-[200px] text-xs sm:text-sm">Descrição do Status</TableHead>
                            <TableHead className="w-12 sm:w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {octpLoading && octpItemsFiltered.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                                Carregando...
                              </TableCell>
                            </TableRow>
                          ) : octpItemsFiltered.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                                Nenhum registro. Selecione a data de início e clique em &quot;Adicionar registro&quot;.
                              </TableCell>
                            </TableRow>
                          ) : (
                            octpItemsFiltered.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-center font-medium text-xs sm:text-sm">{item.numero}</TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Input
                                    value={item.problema}
                                    onChange={(e) => updateOCTPItem(item.id, "problema", e.target.value)}
                                    className="h-8 sm:h-9 text-xs sm:text-sm"
                                    placeholder="Problema"
                                  />
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Input
                                    value={item.acao}
                                    onChange={(e) => updateOCTPItem(item.id, "acao", e.target.value)}
                                    className="h-8 sm:h-9 text-xs sm:text-sm"
                                    placeholder="Ação"
                                  />
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Input
                                    value={item.responsavel}
                                    onChange={(e) => updateOCTPItem(item.id, "responsavel", e.target.value)}
                                    className="h-8 sm:h-9 text-xs sm:text-sm"
                                    placeholder="Responsável"
                                  />
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <DatePicker
                                    value={item.inicio}
                                    onChange={(v) => updateOCTPItem(item.id, "inicio", v)}
                                    size="sm"
                                    triggerClassName="h-8 sm:h-9 text-xs sm:text-sm"
                                  />
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="HH:MM"
                                    value={editingHoraInicioId === item.id ? editingHoraInicioValue : item.horaInicio}
                                    onFocus={() => {
                                      setEditingHoraInicioId(item.id);
                                      setEditingHoraInicioValue(item.horaInicio || "");
                                    }}
                                    onChange={(e) => setEditingHoraInicioValue(e.target.value)}
                                    onBlur={(e) => {
                                      const raw = (e.target as HTMLInputElement).value.trim();
                                      const parsed = parseHoraFinalInput(raw);
                                      if (parsed != null) {
                                        updateOCTPItem(item.id, "horaInicio", parsed);
                                      }
                                      setEditingHoraInicioId(null);
                                    }}
                                    className="h-8 sm:h-9 text-xs sm:text-sm font-mono"
                                    title="Digite a hora (ex: 10 ou 0930 para 09:30)"
                                  />
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  {isOCTPStatusRelogioParado(item.descricao_status) ? (
                                    <div className="flex h-8 sm:h-9 items-center rounded-md border border-input bg-primary/10 px-2 sm:px-3 text-xs sm:text-sm font-mono font-semibold text-primary min-w-[4.5rem]">
                                      {getDisplayHoraFinalOCTP(item)}
                                    </div>
                                  ) : editingHoraFinalId === item.id ? (
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="HH:MM:SS"
                                      value={editingHoraFinalValue}
                                      autoFocus
                                      onChange={(e) => setEditingHoraFinalValue(e.target.value)}
                                      onBlur={(e) => {
                                        const raw = (e.target as HTMLInputElement).value.trim();
                                        const parsed = parseHoraFinalInput(raw);
                                        if (parsed != null) {
                                          updateOCTPItem(item.id, "horaFinal", parsed);
                                          setHoraFinalBaseSetAt((prev) => ({ ...prev, [item.id]: Date.now() }));
                                        }
                                        setEditingHoraFinalId(null);
                                      }}
                                      className="h-8 sm:h-9 w-full min-w-[5.5rem] text-xs sm:text-sm font-mono font-semibold bg-primary/10 border-input text-primary"
                                      title="Digite a hora (ex: 10 ou 10:00:00) e clique fora para salvar"
                                    />
                                  ) : (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => {
                                        setEditingHoraFinalId(item.id);
                                        setEditingHoraFinalValue(getDisplayHoraFinalOCTP(item));
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          setEditingHoraFinalId(item.id);
                                          setEditingHoraFinalValue(getDisplayHoraFinalOCTP(item));
                                        }
                                      }}
                                      className="flex h-8 sm:h-9 w-full min-w-[5.5rem] cursor-text items-center rounded-md border border-input bg-primary/10 px-3 py-2 text-xs sm:text-sm font-mono font-semibold text-primary ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-primary/50"
                                      title="Hora final: contando em tempo real; clique para alterar (ex: 09:00)"
                                    >
                                      {getDisplayHoraFinalOCTP(item)}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="p-2 sm:p-4 text-xs sm:text-sm text-muted-foreground font-mono text-right min-w-[80px] sm:min-w-[90px]">
                                  {isOCTPStatusRelogioParado(item.descricao_status)
                                    ? (item.horaInicio || item.horaFinal
                                        ? formatOCTPIntervalo(item.horaInicio, item.horaFinal)
                                        : formatDuracaoMinutos(item.duracaoMinutos))
                                    : item.horaInicio
                                      ? formatOCTPIntervalo(item.horaInicio, getDisplayHoraFinalOCTP(item))
                                      : formatDuracaoMinutos(item.duracaoMinutos)}
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Select
                                    value={item.descricao_status || "__vazio__"}
                                    onValueChange={(v) => updateOCTPItem(item.id, "descricao_status", v === "__vazio__" ? "" : v)}
                                  >
                                    <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm min-w-[160px]">
                                      <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__vazio__">
                                        <span className="flex items-center gap-2">
                                          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50 shrink-0" />
                                          —
                                        </span>
                                      </SelectItem>
                                      {OCTP_STATUS_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.id} value={opt.id}>
                                          <span className="flex items-center gap-2">
                                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                                            {opt.label}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeOCTPItem(item.id)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                          {octpItemsFiltered.length > 0 && (
                            <TableRow className="bg-muted/50 hover:bg-muted/50 border-t-2 border-border font-semibold">
                              <TableCell colSpan={7} className="p-2 sm:p-4 text-xs sm:text-sm text-right">
                                Total (intervalo)
                              </TableCell>
                              <TableCell className="p-2 sm:p-4 text-xs sm:text-sm font-mono font-semibold text-foreground text-right min-w-[80px] sm:min-w-[90px]">
                                {formatMinutosToHHMM(octpTotalIntervaloMinutosFiltered)}
                              </TableCell>
                              <TableCell colSpan={2} className="p-2 sm:p-4" />
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Gráfico de pizza: porcentagem por status — no desktop, descrições ao lado */}
                  <div className="mt-6 pt-5 border-t border-border/50 flex flex-col items-center">
                    <div className="w-full max-w-[360px] sm:max-w-none mx-auto rounded-2xl border border-border/50 bg-gradient-to-b from-muted/20 to-muted/5 p-5 sm:p-6 shadow-sm">
                      <h4 className="text-sm font-semibold text-foreground/90 tracking-tight mb-5 w-full text-center sm:text-left">Status (porcentagens)</h4>
                      {octpStatusPieData.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center rounded-xl bg-muted/20 border border-dashed border-border/60">Selecione os status nos registros acima para ver o gráfico.</p>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-center sm:items-stretch sm:justify-center w-full gap-6 sm:gap-8">
                          <div className="octp-pie-chart-wrapper w-full max-w-[340px] sm:max-w-[320px] min-w-[260px] h-[280px] sm:h-[320px] shrink-0 flex items-center justify-center mx-auto sm:mx-0 rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/98 p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] [filter:drop-shadow(0_4px_20px_rgba(0,0,0,0.06))]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <defs>
                                  {octpStatusPieData.map((entry, i) => {
                                    const stops = OCTP_PIE_GRADIENTS[entry.color] ?? { light: entry.color, dark: entry.color };
                                    return (
                                      <radialGradient key={entry.name} id={`octp-pie-grad-${i}`} cx="0.35" cy="0.35" r="0.65">
                                        <stop offset="0%" stopColor={stops.light} stopOpacity={1} />
                                        <stop offset="70%" stopColor={entry.color} stopOpacity={1} />
                                        <stop offset="100%" stopColor={stops.dark} stopOpacity={0.95} />
                                      </radialGradient>
                                    );
                                  })}
                                </defs>
                                <Pie
                                  data={octpStatusPieData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={92}
                                  paddingAngle={4}
                                  label={({ value }) => `${value}%`}
                                  labelLine={{ strokeWidth: 1.5, stroke: "hsl(var(--foreground) / 0.35)" }}
                                  stroke="hsl(var(--card))"
                                  strokeWidth={2.5}
                                  className="[&_.recharts-pie-sector]:outline-none"
                                  isAnimationActive
                                  animationDuration={700}
                                  animationEasing="ease-out"
                                >
                                  {octpStatusPieData.map((entry, i) => (
                                    <Cell key={entry.name} fill={`url(#octp-pie-grad-${i})`} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value: number, name: string, props: { payload?: { count?: number } }) => [`${value}% (${props?.payload?.count ?? 0} registro(s))`, name]}
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--card) / 0.98)",
                                    backdropFilter: "blur(12px)",
                                    WebkitBackdropFilter: "blur(12px)",
                                    border: "1px solid hsl(var(--border) / 0.8)",
                                    borderRadius: "14px",
                                    padding: "16px 20px",
                                    boxShadow: "0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                  }}
                                  itemStyle={{ fontWeight: 600, paddingTop: "4px" }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <ul className="flex flex-wrap gap-2.5 justify-center sm:justify-start sm:flex-col sm:gap-1.5 sm:shrink-0">
                            {octpStatusPieData.map((d) => (
                              <li
                                key={d.name}
                                className="inline-flex items-center gap-2 rounded-full sm:rounded-md px-3 py-1.5 sm:px-2.5 sm:py-1 text-sm bg-muted/40 border border-border/50 shadow-sm hover:bg-muted/60 hover:border-border/70 transition-colors"
                              >
                                <span className="h-3 w-3 rounded-full shrink-0 ring-2 ring-background/80" style={{ backgroundColor: d.color }} />
                                <span className="text-muted-foreground">{d.name}</span>
                                <span className="font-semibold text-foreground tabular-nums shrink-0">{d.value}%</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seção: Análise Gráfica — otimizada para desktop */}
                <div className="space-y-6 lg:space-y-8">
                  {/* No PC: Planejado vs Realizado e Status de Produção lado a lado */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                  {/* Gráfico 1: Planejado vs Realizado */}
                  <div ref={chartPlanejadoRealizadoRef} className="chart-card rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/98 pl-3 pr-4 py-5 sm:p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] lg:shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden min-w-0">
                    <div className="mb-5 lg:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 via-primary/15 to-primary/10 border border-primary/25 shadow-lg shadow-primary/10">
                          <Target className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-card-foreground">Planejado vs Realizado</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground/90 mt-0.5">Comparação por item de produção</p>
                        </div>
                      </div>
                      <ExportToPng targetRef={chartPlanejadoRealizadoRef} filenamePrefix="grafico-planejado-realizado" expandScrollable={false} className="shrink-0" />
                    </div>
                    <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
                      <div
                        className="dashboard-linha-chart dashboard-linha-chart-wrap rounded-2xl p-4 sm:p-5 w-full min-w-0"
                        style={{ height: Math.min(720, Math.max(200, items.length * (linhaBarSize * 2 + chartRowHeightExtra))) }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={[...items]
                              .sort((a, b) => parseFormattedNumber(b.quantidadeRealizada) - parseFormattedNumber(a.quantidadeRealizada))
                              .map((item) => ({
                                name: item.descricaoItem || item.codigoItem || item.op || `Item ${item.numero}`,
                                planejado: parseFormattedNumber(item.quantidadePlanejada),
                                realizado: parseFormattedNumber(item.quantidadeRealizada),
                                diferenca: item.diferenca,
                              }))}
                            margin={{ top: 8, right: chartMarginRight, left: 8, bottom: 8 }}
                            barCategoryGap={chartBarCategoryGap}
                            barGap={chartBarGap}
                          >
                            <defs>
                              <linearGradient id="producao-linha-primary" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="hsl(217 71% 32%)" stopOpacity={0.95} />
                                <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                                <stop offset="100%" stopColor="hsl(217 71% 65%)" stopOpacity={1} />
                              </linearGradient>
                              <linearGradient id="producao-linha-success" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="hsl(160 84% 28%)" stopOpacity={0.95} />
                                <stop offset="50%" stopColor="hsl(var(--success))" stopOpacity={1} />
                                <stop offset="100%" stopColor="hsl(160 84% 52%)" stopOpacity={1} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" strokeOpacity={0.2} horizontal={false} />
                            <XAxis type="number" tickLine={false} axisLine={false} tick={() => null} ticks={[]} />
                            <YAxis type="category" dataKey="name" width={chartYAxisWidth} tickLine={false} axisLine={false} tick={makeYAxisTickMultiLine(chartTickMaxChars, chartTickMaxLines)} />
                            <Tooltip
                              cursor={{ fill: "hsl(var(--primary) / 0.06)", radius: 6 }}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card) / 0.98)",
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                                border: "1px solid hsl(var(--border) / 0.8)",
                                borderRadius: "14px",
                                padding: "16px 20px",
                                boxShadow: "0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
                                fontSize: "13px",
                                fontWeight: 500,
                              }}
                              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700, marginBottom: 8 }}
                              formatter={(value: number) => [formatNumber(value), ""]}
                              itemStyle={{ fontWeight: 600 }}
                            />
                            <Legend wrapperStyle={{ paddingTop: 18 }} align="center" layout="horizontal" iconType="circle" iconSize={10} formatter={(value) => <span style={{ color: "hsl(var(--foreground) / 0.9)", fontWeight: 600, marginLeft: 6, letterSpacing: "0.02em" }}>{value}</span>} />
                            <Bar dataKey="planejado" fill="url(#producao-linha-primary)" radius={[0, 8, 8, 0]} name="Planejado" barSize={linhaBarSize} isAnimationActive animationDuration={600} animationEasing="ease-out">
                              <LabelList dataKey="planejado" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                            </Bar>
                            <Bar dataKey="realizado" fill="url(#producao-linha-success)" radius={[0, 8, 8, 0]} name="Realizado" barSize={linhaBarSize} isAnimationActive animationDuration={600} animationEasing="ease-out">
                              <LabelList dataKey="realizado" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Status de Produção — no PC fica ao lado do Planejado vs Realizado */}
                  <div ref={chartStatusProducaoRef} className="chart-card rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/98 p-5 sm:p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] lg:shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden min-w-0">
                    <div className="mb-4 lg:mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-success/25 via-success/15 to-success/10 border border-success/25 shadow-lg shadow-success/10">
                          <Factory className="h-6 w-6 lg:h-7 lg:w-7 text-success" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-card-foreground">Status de Produção</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground/90 mt-0.5">Mesmo percentual do quadro "Percentual Meta" (total realizado ÷ total planejado)</p>
                        </div>
                      </div>
                      <ExportToPng targetRef={chartStatusProducaoRef} filenamePrefix="grafico-status-producao" expandScrollable={false} className="shrink-0" />
                    </div>
                    <div className="dashboard-pie-chart dashboard-pie-chart-wrap h-[240px] sm:h-[260px] lg:h-[300px] w-full flex items-center justify-center p-4 sm:p-5">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          {(() => {
                            const { totalPlanejada, totalRealizada } = calcularTotaisProducao();
                            const perc = totalPlanejada > 0 ? (totalRealizada / totalPlanejada) * 100 : 0;
                            const successFill = "url(#producao-pie-success)";
                            const dangerFill = "url(#producao-pie-danger)";
                            const mutedColor = "hsl(var(--muted-foreground))";
                            const statusData =
                              totalPlanejada === 0
                                ? [{ name: "Sem meta definida", value: 100, color: mutedColor, fill: mutedColor }]
                                : perc >= 100
                                  ? [{ name: "Meta atingida (≥100%)", value: 100, color: "hsl(var(--success))", fill: successFill }]
                                  : [
                                      { name: `Meta atingida (${perc.toFixed(1).replace(".", ",")}%)`, value: perc, color: "hsl(var(--success))", fill: successFill },
                                      { name: `Faltando (${(100 - perc).toFixed(1).replace(".", ",")}%)`, value: 100 - perc, color: "hsl(var(--destructive))", fill: dangerFill },
                                    ];
                            return (
                              <>
                                <defs>
                                  <radialGradient id="producao-pie-success" cx="0.35" cy="0.35" r="0.65">
                                    <stop offset="0%" stopColor="hsl(160 84% 52%)" stopOpacity={1} />
                                    <stop offset="70%" stopColor="hsl(var(--success))" stopOpacity={1} />
                                    <stop offset="100%" stopColor="hsl(160 84% 28%)" stopOpacity={0.95} />
                                  </radialGradient>
                                  <radialGradient id="producao-pie-danger" cx="0.35" cy="0.35" r="0.65">
                                    <stop offset="0%" stopColor="hsl(0 72% 58%)" stopOpacity={1} />
                                    <stop offset="70%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
                                    <stop offset="100%" stopColor="hsl(0 62% 28%)" stopOpacity={0.95} />
                                  </radialGradient>
                                </defs>
                                <Pie
                                  data={statusData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  outerRadius={pieOuterRadius}
                                  innerRadius={0}
                                  fill="#8884d8"
                                  dataKey="value"
                                  stroke="hsl(var(--card))"
                                  strokeWidth={2.5}
                                  className="[&_.recharts-pie-sector]:outline-none"
                                  isAnimationActive
                                  animationDuration={700}
                                  animationEasing="ease-out"
                                >
                                  {statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill ?? entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--card) / 0.98)",
                                    backdropFilter: "blur(12px)",
                                    WebkitBackdropFilter: "blur(12px)",
                                    border: "1px solid hsl(var(--border) / 0.8)",
                                    borderRadius: "14px",
                                    padding: "16px 20px",
                                    boxShadow: "0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                  }}
                                  formatter={(value: number) => [`${value.toFixed(1).replace(".", ",")}%`, ""]}
                                  itemStyle={{ fontWeight: 600 }}
                                />
                                <Legend
                                  wrapperStyle={{ paddingTop: 18 }}
                                  align="center"
                                  iconType="circle"
                                  iconSize={10}
                                  formatter={(value) => <span style={{ color: "hsl(var(--foreground) / 0.9)", fontWeight: 600, marginLeft: 6, letterSpacing: "0.02em" }}>{value}</span>}
                                />
                              </>
                            );
                          })()}
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  </div>

                  {/* Gráficos em Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {/* Gráfico 2: Diferença por Item - barras horizontais: nome à esquerda, valor à direita */}
                    <div ref={chartDiferencaItemRef} className="chart-card rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/98 p-5 sm:p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] lg:shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
                      <div className="mb-5 lg:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-warning/25 via-warning/15 to-warning/10 border border-warning/25 shadow-lg shadow-warning/10">
                            <TrendingUp className="h-6 w-6 lg:h-7 lg:w-7 text-warning" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-card-foreground">Diferença por Item</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground/90 mt-0.5">Variação entre planejado e realizado (vermelho = faltando, verde = sobra)</p>
                          </div>
                        </div>
                        <ExportToPng targetRef={chartDiferencaItemRef} filenamePrefix="grafico-diferenca-item" expandScrollable={false} className="shrink-0" />
                      </div>
                      <div className="dashboard-linha-chart dashboard-linha-chart-wrap rounded-2xl p-4 sm:p-5 w-full" style={{ height: Math.min(720, Math.max(280, items.length * (linhaBarSize * 2 + 56))) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        {(() => {
                          const diferencaPorItemData = [...items]
                            .map((item) => ({
                              name: item.descricaoItem || item.codigoItem || item.op || `Item ${item.numero}`,
                              diferenca: Math.abs(item.diferenca),
                              isFaltando: item.diferenca > 0,
                            }))
                            .sort((a, b) => b.diferenca - a.diferenca);
                          return (
                            <BarChart
                              layout="vertical"
                              data={diferencaPorItemData}
                              margin={{ top: 12, right: chartMarginRight, left: 12, bottom: 12 }}
                              barCategoryGap={48}
                            >
                              <defs>
                                <linearGradient id="producao-diferenca-danger" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="hsl(0 62% 28%)" stopOpacity={0.95} />
                                  <stop offset="50%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
                                  <stop offset="100%" stopColor="hsl(0 72% 58%)" stopOpacity={1} />
                                </linearGradient>
                                <linearGradient id="producao-diferenca-success" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="hsl(160 84% 28%)" stopOpacity={0.95} />
                                  <stop offset="50%" stopColor="hsl(var(--success))" stopOpacity={1} />
                                  <stop offset="100%" stopColor="hsl(160 84% 52%)" stopOpacity={1} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" strokeOpacity={0.2} horizontal={false} />
                              <XAxis type="number" tickLine={false} axisLine={false} tick={() => null} ticks={[]} />
                              <YAxis type="category" dataKey="name" width={chartYAxisWidth} tickLine={false} axisLine={false} tick={makeYAxisTickMultiLine(chartTickMaxChars, chartTickMaxLines)} />
                              <Tooltip
                                cursor={{ fill: "hsl(var(--warning) / 0.08)", radius: 6 }}
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card) / 0.98)",
                                  backdropFilter: "blur(12px)",
                                  WebkitBackdropFilter: "blur(12px)",
                                  border: "1px solid hsl(var(--border) / 0.8)",
                                  borderRadius: "14px",
                                  padding: "16px 20px",
                                  boxShadow: "0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
                                  fontSize: "13px",
                                  fontWeight: 500,
                                }}
                                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700, marginBottom: 8 }}
                                formatter={(value: number) => [formatNumber(value), "Diferença"]}
                                itemStyle={{ fontWeight: 600 }}
                              />
                              <Bar dataKey="diferenca" name="Diferença" radius={[0, 8, 8, 0]} barSize={linhaBarSize} isAnimationActive animationDuration={600} animationEasing="ease-out">
                                <LabelList dataKey="diferenca" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                                {diferencaPorItemData.map((entry, i) => (
                                  <Cell key={i} fill={entry.isFaltando ? "url(#producao-diferenca-danger)" : "url(#producao-diferenca-success)"} />
                                ))}
                              </Bar>
                            </BarChart>
                          );
                        })()}
                      </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Produção por Linha (lado de Diferença por Item) */}
                    {(() => {
                      const porLinha = items.reduce<Record<string, { valor: number; meta: number }>>((acc, item) => {
                        const linha = (item.linha || "").trim() || "Sem linha";
                        if (!acc[linha]) acc[linha] = { valor: 0, meta: 0 };
                        acc[linha].valor += parseFormattedNumber(item.quantidadeRealizada);
                        acc[linha].meta += parseFormattedNumber(item.quantidadePlanejada);
                        return acc;
                      }, {});
                      const productionDataLinha = Object.entries(porLinha)
                        .map(([key, v]) => ({
                          name: key === "Sem linha" ? key : (productionLines.find(l => l.code === key || (l.name || "").trim() === key)?.name || key),
                          valor: v.valor,
                          meta: v.meta,
                        }))
                        .filter(d => d.valor > 0 || d.meta > 0)
                        .sort((a, b) => b.valor - a.valor);
                      if (productionDataLinha.length === 0) {
                        return (
                          <div className="rounded-xl border border-border/60 bg-card/50 p-5 sm:p-7 flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
                            Nenhum dado por linha para exibir.
                          </div>
                        );
                      }
                      const chartH = Math.min(560, Math.max(200, productionDataLinha.length * (linhaBarSize * 2 + 28)));
                      const TooltipProducaoLinha = ({ active, payload, label }: any) => {
                        if (!active || !payload?.length || !label) return null;
                        const row = payload[0]?.payload;
                        const realizado = row?.valor ?? 0;
                        const meta = row?.meta ?? 0;
                        const pct = meta > 0 ? ((realizado / meta) * 100).toFixed(1).replace(".", ",") : "—";
                        return (
                          <div className="rounded-xl border border-border/80 bg-card/98 backdrop-blur-xl px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] text-xs font-medium">
                            <p className="font-bold text-foreground mb-2 border-b border-border/60 pb-2 text-sm">{label}</p>
                            <p className="tabular-nums"><span className="text-primary font-semibold">Realizado:</span> {formatNumber(realizado)}</p>
                            <p className="tabular-nums"><span className="text-muted-foreground font-medium">Meta:</span> {formatNumber(meta)}</p>
                            <p className="mt-1.5 text-muted-foreground">% da meta: <span className="font-bold text-foreground">{pct}%</span></p>
                          </div>
                        );
                      };
                      return (
                        <div ref={chartProducaoLinhaRef} className="chart-card rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/98 p-5 sm:p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] lg:shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
                          <div className="mb-4 lg:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 via-primary/15 to-primary/10 border border-primary/25 shadow-lg shadow-primary/10 text-primary">
                                <Factory className="h-6 w-6 lg:h-7 lg:w-7" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-card-foreground">Produção por Linha</h3>
                                <p className="text-xs sm:text-sm text-muted-foreground/90 mt-0.5">Compare realizado (azul) com meta (cinza). Ordenado do maior ao menor realizado.</p>
                              </div>
                            </div>
                            <ExportToPng targetRef={chartProducaoLinhaRef} filenamePrefix="grafico-producao-linha" expandScrollable={false} className="shrink-0 w-full sm:w-auto min-h-[44px] sm:min-h-0" />
                          </div>
                          <div className="flex flex-wrap gap-4 mb-4">
                            <span className="inline-flex items-center gap-2 text-xs sm:text-sm">
                              <span className="w-3.5 h-3.5 rounded-md bg-primary shadow-sm ring-2 ring-primary/20" aria-hidden />
                              <span className="text-muted-foreground font-medium">Realizado (produzido)</span>
                            </span>
                            <span className="inline-flex items-center gap-2 text-xs sm:text-sm">
                              <span className="w-3.5 h-3.5 rounded-md bg-muted-foreground/50 shadow-sm ring-2 ring-muted-foreground/20" aria-hidden />
                              <span className="text-muted-foreground font-medium">Meta (planejado)</span>
                            </span>
                          </div>
                          <div className="dashboard-linha-chart dashboard-linha-chart-wrap rounded-2xl p-4 sm:p-5">
                            <ResponsiveContainer width="100%" height={chartH}>
                              <BarChart layout="vertical" data={productionDataLinha} margin={{ top: 8, right: 56, left: 4, bottom: 8 }} barCategoryGap={24} barGap={14}>
                                <defs>
                                  <linearGradient id="producao-linha-valor" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="hsl(217 71% 32%)" stopOpacity={0.95} />
                                    <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                                    <stop offset="100%" stopColor="hsl(217 71% 65%)" stopOpacity={1} />
                                  </linearGradient>
                                  <linearGradient id="producao-linha-meta" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.55} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" strokeOpacity={0.2} horizontal={false} />
                                <XAxis type="number" tickLine={false} axisLine={false} tick={() => null} ticks={[]} />
                                <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                                <Tooltip content={<TooltipProducaoLinha />} cursor={{ fill: "hsl(var(--primary) / 0.06)", radius: 6 }} />
                                <Bar dataKey="valor" fill="url(#producao-linha-valor)" radius={[0, 8, 8, 0]} name="Realizado" barSize={linhaBarSize} isAnimationActive animationDuration={600} animationEasing="ease-out">
                                  <LabelList dataKey="valor" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                                </Bar>
                                <Bar dataKey="meta" fill="url(#producao-linha-meta)" radius={[0, 8, 8, 0]} name="Meta" barSize={linhaBarSize} isAnimationActive animationDuration={600} animationEasing="ease-out">
                                  <LabelList dataKey="meta" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 12, fontWeight: 500, fill: "hsl(var(--muted-foreground))" }} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                </div>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Conteúdo do histórico (key evita reconciliação com a view cadastro = sem animações estranhas na troca de aba)
    if (currentView === "historico") {
      return (
        <div key="historico" className="space-y-6 min-w-0 overflow-x-hidden">
          {/* Voltar — mesma estrutura que na view Cadastro para altura consistente */}
          <div className="mt-2 mb-2 flex items-center justify-between gap-2 flex-shrink-0 min-h-[3.5rem]">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVoltar}
              className="size-11 min-h-[44px] min-w-[44px] rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-accent hover:border-primary/30 hover:shadow-md shrink-0"
              aria-label="Voltar ao menu"
              title="Voltar ao menu"
            >
              <ArrowLeft className="size-5 text-foreground shrink-0" strokeWidth={2.5} />
            </Button>
          </div>

          {/* Abas internas: mesma altura fixa que na view Cadastro */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex h-12 min-h-12 items-stretch rounded-xl border border-border/60 bg-muted/40 p-1 gap-0.5 flex-shrink-0" role="tablist" aria-label="Navegação da análise de produção">
              <Button
                variant="ghost"
                size="sm"
                role="tab"
                aria-selected={false}
                className="rounded-lg px-4 py-2 h-full min-h-0 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 whitespace-nowrap"
                onClick={() => setCurrentView("cadastro")}
              >
                <span className="sm:hidden">Acompanhamento</span>
                <span className="hidden sm:inline">Acompanhamento diário</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                role="tab"
                aria-selected={true}
                className="rounded-lg px-4 py-2 h-full min-h-0 text-xs sm:text-sm font-semibold bg-primary/10 text-primary border border-primary/25 shadow-sm hover:bg-primary/15 whitespace-nowrap"
              >
                <span className="sm:hidden">Histórico</span>
                <span className="hidden sm:inline">Histórico de análise</span>
              </Button>
            </div>
          </div>

          {/* Título e descrição — acima do card; fundo branco e linha azul (sem transition para altura estável) */}
          <div className="relative mb-4 sm:mb-5 rounded-2xl p-4 sm:p-6 lg:p-8 group/button bg-background overflow-hidden border border-border/50 shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0 rounded-t-2xl" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center items-center justify-center gap-3 sm:gap-5 text-center sm:text-left">
              <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                <Database className="relative h-6 w-6 sm:h-7 sm:w-7 text-primary drop-shadow-lg" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                  Histórico de Análise de Produção
                </h2>
                <p className="text-sm text-muted-foreground/80 font-medium">
                  Visualize registros anteriores de produção
                </p>
              </div>
            </div>
          </div>

          {/* Gráfico Produção por Linha (histórico) — realizado vs meta agregado pelo filtro */}
          {(() => {
            const porLinhaHist = (historyData || []).reduce<Record<string, { valor: number; meta: number }>>((acc, record) => {
              const linha = (record.linha != null ? String(record.linha).trim() : "") || "Sem linha";
              if (!acc[linha]) acc[linha] = { valor: 0, meta: 0 };
              const qtdR = parseFloat(String(record.qtd_realizada ?? "0").toString().replace(",", ".")) || 0;
              const qtdP = parseFloat(String(record.qtd_planejada ?? "0").toString().replace(",", ".")) || 0;
              acc[linha].valor += qtdR;
              acc[linha].meta += qtdP;
              return acc;
            }, {});
            const productionDataLinhaHist = Object.entries(porLinhaHist)
              .map(([key, v]) => ({
                name: key === "Sem linha" ? key : (productionLines.find(l => l.code === key || (l.name || "").trim() === key)?.name || key),
                valor: v.valor,
                meta: v.meta,
              }))
              .filter(d => d.valor > 0 || d.meta > 0)
              .sort((a, b) => b.valor - a.valor);
            if (productionDataLinhaHist.length === 0) {
              return (
                <div className="chart-card rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/98 p-5 sm:p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 via-primary/15 to-primary/10 border border-primary/25 text-primary">
                      <Factory className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">Produção por Linha</h3>
                      <p className="text-sm text-muted-foreground">Filtre o histórico para ver realizado vs meta por linha.</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-border/60 bg-card/50 p-5 flex items-center justify-center min-h-[160px] text-muted-foreground text-sm">
                    Nenhum dado por linha no intervalo selecionado.
                  </div>
                </div>
              );
            }
            const chartHHist = Math.min(560, Math.max(200, productionDataLinhaHist.length * (linhaBarSize * 2 + 28)));
            const TooltipProducaoLinhaHist = ({ active, payload, label }: any) => {
              if (!active || !payload?.length || !label) return null;
              const row = payload[0]?.payload;
              const realizado = row?.valor ?? 0;
              const meta = row?.meta ?? 0;
              const pct = meta > 0 ? ((realizado / meta) * 100).toFixed(1).replace(".", ",") : "—";
              return (
                <div className="rounded-xl border border-border/80 bg-card/98 backdrop-blur-xl px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] text-xs font-medium">
                  <p className="font-bold text-foreground mb-2 border-b border-border/60 pb-2 text-sm">{label}</p>
                  <p className="tabular-nums"><span className="text-primary font-semibold">Realizado:</span> {formatNumber(realizado)}</p>
                  <p className="tabular-nums"><span className="text-muted-foreground font-medium">Meta:</span> {formatNumber(meta)}</p>
                  <p className="mt-1.5 text-muted-foreground">% da meta: <span className="font-bold text-foreground">{pct}%</span></p>
                </div>
              );
            };
            return (
              <div ref={historicoProducaoLinhaRef} className="chart-card rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/98 p-5 sm:p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] lg:shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
                <div className="mb-4 lg:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 via-primary/15 to-primary/10 border border-primary/25 shadow-lg shadow-primary/10 text-primary">
                      <Factory className="h-6 w-6 lg:h-7 lg:w-7" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-foreground">Produção por Linha</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground/90 mt-0.5">Compare realizado (azul) com meta (cinza). Ordenado do maior ao menor realizado.</p>
                    </div>
                  </div>
                  <ExportToPng targetRef={historicoProducaoLinhaRef} filenamePrefix="historico-producao-por-linha" expandScrollable={false} className="shrink-0 w-full sm:w-auto min-h-[44px] sm:min-h-0" label="Exportar PNG" />
                </div>
                <div className="flex flex-wrap gap-4 mb-4">
                  <span className="inline-flex items-center gap-2 text-xs sm:text-sm">
                    <span className="w-3.5 h-3.5 rounded-md bg-primary shadow-sm ring-2 ring-primary/20" aria-hidden />
                    <span className="text-muted-foreground font-medium">Realizado (produzido)</span>
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs sm:text-sm">
                    <span className="w-3.5 h-3.5 rounded-md bg-muted-foreground/50 shadow-sm ring-2 ring-muted-foreground/20" aria-hidden />
                    <span className="text-muted-foreground font-medium">Meta (planejado)</span>
                  </span>
                </div>
                <div className="dashboard-linha-chart dashboard-linha-chart-wrap rounded-2xl p-4 sm:p-5">
                  <ResponsiveContainer width="100%" height={chartHHist}>
                    <BarChart layout="vertical" data={productionDataLinhaHist} margin={{ top: 8, right: 56, left: 4, bottom: 8 }} barCategoryGap={24} barGap={14}>
                      <defs>
                        <linearGradient id="historico-linha-valor" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(217 71% 32%)" stopOpacity={0.95} />
                          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(217 71% 65%)" stopOpacity={1} />
                        </linearGradient>
                        <linearGradient id="historico-linha-meta" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" strokeOpacity={0.2} horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={() => null} ticks={[]} />
                      <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                      <Tooltip content={<TooltipProducaoLinhaHist />} cursor={{ fill: "hsl(var(--primary) / 0.06)", radius: 6 }} />
                      <Bar dataKey="valor" fill="url(#historico-linha-valor)" radius={[0, 8, 8, 0]} name="Realizado" barSize={linhaBarSize} isAnimationActive animationDuration={600} animationEasing="ease-out">
                        <LabelList dataKey="valor" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                      </Bar>
                      <Bar dataKey="meta" fill="url(#historico-linha-meta)" radius={[0, 8, 8, 0]} name="Meta" barSize={linhaBarSize} isAnimationActive animationDuration={600} animationEasing="ease-out">
                        <LabelList dataKey="meta" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 12, fontWeight: 500, fill: "hsl(var(--muted-foreground))" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* Card: filtros + tabela (sem transition para altura estável ao trocar de aba) */}
          <div ref={historicoCardRef} className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] overflow-hidden group/card">
            {/* Efeito de brilho sutil */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
            {/* Borda superior com gradiente */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

            <div className="relative z-10">
              {/* Filtros: intervalo de datas, filial e linha — coluna em telas menores, linha apenas em telas grandes (mais espaço com sidebar) */}
              <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between w-full p-4 lg:p-8 lg:pb-5 lg:pt-6 transition-all duration-500 bg-gradient-to-r from-card via-card to-card rounded-t-2xl overflow-visible">
                <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3 overflow-visible">
                  <div className="flex items-center gap-2 w-full min-w-0 lg:flex-1 lg:min-w-[150px] overflow-visible">
                    <Label htmlFor="history-data-inicio" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">De</Label>
                    <DatePicker
                      id="history-data-inicio"
                      value={historyDataInicio}
                      onChange={setHistoryDataInicio}
                      placeholder="Data inicial"
                      className="h-9 flex-1 min-w-[120px] w-full lg:w-[130px] text-sm overflow-visible"
                      triggerClassName="h-9 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full min-w-0 lg:flex-1 lg:min-w-[150px] overflow-visible">
                    <Label htmlFor="history-data-fim" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Até</Label>
                    <DatePicker
                      id="history-data-fim"
                      value={historyDataFim}
                      onChange={setHistoryDataFim}
                      placeholder="Data final"
                      className="h-9 flex-1 min-w-[120px] w-full lg:w-[130px] text-sm overflow-visible"
                      triggerClassName="h-9 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full min-w-0 lg:w-auto">
                    <Label htmlFor="history-filial" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      Filial
                    </Label>
                    <Select
                      value={historyFilialFilter}
                      onValueChange={(v) => setHistoryFilialFilter(v)}
                    >
                      <SelectTrigger
                        id="history-filial"
                        className="h-9 w-full min-w-0 lg:w-[220px] text-sm"
                      >
                        <SelectValue placeholder="Todas as filiais" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as filiais</SelectItem>
                        {filiais.map((filial) => (
                          <SelectItem
                            key={filial.id}
                            value={filial.codigo?.trim() ? filial.codigo.trim() : `id:${filial.id}`}
                          >
                            {filial.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 w-full min-w-0 lg:w-auto">
                    <Label htmlFor="history-linha" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Linha</Label>
                    <Select value={historyLinhaFilter || "todas"} onValueChange={(v) => setHistoryLinhaFilter(v === "todas" ? "" : v)}>
                      <SelectTrigger id="history-linha" className="h-8 flex-1 min-w-0 sm:flex-none sm:w-[130px] text-xs">
                        <SelectValue placeholder="Todas as linhas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as linhas</SelectItem>
                        {productionLines.map((line) => (
                          <SelectItem key={line.id} value={line.code ? String(line.code) : `line-${line.id}`}>
                            {line.name || line.code || `Linha ${line.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      loadHistory();
                    }}
                    disabled={historyLoading}
                    className="w-full min-[791px]:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Filtrar histórico pelo intervalo e linha"
                  >
                    {historyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4" />
                    )}
                    <span>{historyLoading ? "Carregando..." : "Filtrar"}</span>
                  </button>
                  <ExportToPng
                    targetRef={historicoCardRef}
                    filenamePrefix="historico-analise-producao"
                    disabled={historyLoading || historyData.length === 0}
                    className="w-full min-[791px]:w-auto gap-2"
                    label="Exportar PNG"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-5 sm:p-7 min-w-0">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-sm text-muted-foreground">Carregando histórico...</span>
                </div>
              ) : historyData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Database className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">Nenhum registro encontrado</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Confira o intervalo de datas (início e fim) e use &quot;Todas as linhas&quot; e &quot;Todas as filiais&quot; para ver BELA e PETRUZ.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-lg border border-border/40 [&::-webkit-scrollbar]:h-2">
                  <div className="inline-block min-w-full align-middle">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[52px] sm:w-14 text-center px-1" />
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Data</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Hora</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">OP</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Código</TableHead>
                          <TableHead className="text-xs sm:text-sm min-w-[480px] sm:min-w-[520px]">Descrição</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Linha</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Qtd. Planejada</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Qtd. Realizada</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Diferença</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Kg/h</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Restante</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Hora final</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">% Meta</TableHead>
                          <TableHead className="text-xs sm:text-sm text-right w-[100px] whitespace-nowrap">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyData.map((record, index) => {
                          // Data do dia de produção (cadastrada)
                          const dataFormatada = formatDateShort(record.data_dia || record.data_cabecalho);
                          const recordFilialNome = record.filial_nome != null ? String(record.filial_nome).trim() : "";
                          const historicoRowKey = record.recordKey ?? `hist_${record.id ?? index}_${record.doc_id ?? ""}`;
                          const isLinhaVermelha = historicoLinhasVermelhas.has(historicoRowKey);
                          const toggleLinhaVermelha = () => {
                            setHistoricoLinhasVermelhas((prev) => {
                              const next = new Set(prev);
                              if (next.has(historicoRowKey)) next.delete(historicoRowKey);
                              else next.add(historicoRowKey);
                              return next;
                            });
                          };
                          const openDocument = () => {
                            const dataDia = (record.data_dia || record.data_cabecalho) as string;
                            if (dataDia) setDataCabecalhoSelecionada(dataDia);
                            const filial = recordFilialNome ? filiais.find((f) => (f.nome || "").trim() === recordFilialNome) : null;
                            if (filial) setFilialSelecionada(filial.codigo?.trim() ? filial.codigo.trim() : `id:${filial.id}`);
                            setCurrentView("cadastro");
                            loadFromDatabase(dataDia, recordFilialNome || undefined);
                          };
                          // Hora: última modificação (updated_at); se não houver, usa hora_cabecalho; senão created_at
                          const horaReferencia = record.updated_at || record.hora_cabecalho || record.created_at;
                          const horaFormatada = horaReferencia ? formatHoraFinal(horaReferencia) : "-";
                          // Percentual de meta por linha: (qtd_realizada ÷ qtd_planejada) * 100
                          const qtdPlanejadaNum = parseFloat(String(record.qtd_planejada ?? "0").toString().replace(",", "."));
                          const qtdRealizadaNum = parseFloat(String(record.qtd_realizada ?? "0").toString().replace(",", "."));
                          const percentual =
                            qtdPlanejadaNum > 0
                              ? `${((qtdRealizadaNum / qtdPlanejadaNum) * 100).toFixed(2).replace(".", ",")}%`
                              : "-";
                          // Nome da linha (OCLP): exibir nome em vez do número/código
                          const linhaStr = record.linha != null ? String(record.linha).trim() : "";
                          const linhaNome = productionLines.find(
                            (l) => String(l.id) === String(record.line_id) || l.code === linhaStr || l.name === linhaStr
                          )?.name ?? (linhaStr || "-");
                          const kgPorHora = record.calculo_1_horas != null && record.calculo_1_horas !== ""
                            ? String(record.calculo_1_horas).replace(".", ",")
                            : "-";
                          const restante = record.restante_horas || "-";
                          const horaFinalStr = formatHoraFinal(record.hora_final);

                          return (
                            <TableRow
                              key={record.id || index}
                              className={isLinhaVermelha ? "bg-red-100 dark:bg-red-950/50 border-l-4 border-l-red-500" : undefined}
                            >
                              <TableCell className="text-center px-1 align-middle">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="inline-flex h-8 w-8 sm:w-auto sm:min-w-[72px] items-center justify-center gap-1 rounded-md border border-input bg-background px-2 sm:px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
                                  onClick={(e) => { e.stopPropagation(); toggleLinhaVermelha(); }}
                                  title={isLinhaVermelha ? "Remover destaque da linha" : "Destacar linha em vermelho"}
                                >
                                  <span className={`rounded-full border-2 h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0 ${isLinhaVermelha ? "border-red-500 bg-red-500" : "border-muted-foreground/50 bg-transparent"}`} />
                                  <span className="hidden sm:inline">{isLinhaVermelha ? "Desmarcar" : "Marcar"}</span>
                                </Button>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm font-mono">{dataFormatada}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-mono">{horaFormatada}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-semibold">{record.op || "-"}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-mono font-semibold">{record.codigo_item || "-"}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-semibold break-words min-w-[480px] sm:min-w-[520px] max-w-[min(720px,95vw)]" title={record.descricao_item || undefined}>{record.descricao_item || "-"}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-semibold">{linhaNome}</TableCell>
                              <TableCell className="text-xs sm:text-sm text-right">{formatTotal(parseFloat(record.qtd_planejada) || 0)}</TableCell>
                              <TableCell className="text-xs sm:text-sm text-right">{formatTotal(parseFloat(record.qtd_realizada) || 0)}</TableCell>
                              <TableCell className={`text-xs sm:text-sm text-right ${parseFloat(record.diferenca) > 0 ? "text-destructive" : "text-success"}`}>
                                {formatTotal(Math.abs(parseFloat(record.diferenca) || 0))}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm text-right font-mono">{kgPorHora}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-mono">{restante}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-mono">{horaFinalStr}</TableCell>
                              <TableCell className="text-xs sm:text-sm text-right font-semibold">{percentual}</TableCell>
                              <TableCell className="text-xs sm:text-sm text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1"
                                  onClick={(e) => { e.stopPropagation(); openDocument(); }}
                                  title="Abrir documento para editar"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Abrir</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6 min-w-0">
        {renderContent()}

        {/* Calculadora */}
        <Dialog open={calculatorOpen} onOpenChange={handleCalculatorOpen}>
          <DialogContent className="sm:max-w-[320px]">
            <DialogHeader>
              <DialogTitle>Calculadora</DialogTitle>
              <DialogDescription>Use a calculadora para realizar cálculos</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Display */}
              <div className="space-y-1">
                {calculatorExpression && (
                  <div className="flex h-8 items-center justify-end rounded-md border border-input bg-muted/50 px-4 text-sm font-mono text-muted-foreground">
                    {calculatorExpression}
                  </div>
                )}
                <div className="flex h-16 items-center justify-end rounded-md border border-input bg-muted px-4 text-2xl font-mono font-semibold">
                  {calculatorDisplay}
                </div>
              </div>

              {/* Botões */}
              <div className="grid grid-cols-4 gap-2">
                {/* Primeira linha */}
                <Button variant="outline" onClick={handleCalculatorClear} className="col-span-2">
                  C
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorOperation("/")}>
                  ÷
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorOperation("*")}>
                  ×
                </Button>

                {/* Segunda linha */}
                <Button variant="outline" onClick={() => handleCalculatorNumber("7")}>
                  7
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorNumber("8")}>
                  8
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorNumber("9")}>
                  9
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorOperation("-")}>
                  −
                </Button>

                {/* Terceira linha */}
                <Button variant="outline" onClick={() => handleCalculatorNumber("4")}>
                  4
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorNumber("5")}>
                  5
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorNumber("6")}>
                  6
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorOperation("+")}>
                  +
                </Button>

                {/* Quarta linha */}
                <Button variant="outline" onClick={() => handleCalculatorNumber("1")}>
                  1
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorNumber("2")}>
                  2
                </Button>
                <Button variant="outline" onClick={() => handleCalculatorNumber("3")}>
                  3
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCalculatorBackspace}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
                >
                  <Delete className="h-5 w-5" />
                </Button>

                {/* Quinta linha */}
                <Button
                  variant="outline"
                  onClick={() => handleCalculatorNumber("0")}
                  className="col-span-2"
                >
                  0
                </Button>
                <Button variant="outline" onClick={handleCalculatorDecimal}>
                  ,
                </Button>
                <Button
                  variant="default"
                  onClick={handleCalculatorEquals}
                >
                  =
                </Button>
              </div>

              {/* Botão para usar resultado */}
              <Button
                variant="default"
                onClick={handleCalculatorUseResult}
                className="w-full"
              >
                Usar Resultado
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout >
  );
}

export default Producao;
