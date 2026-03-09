import { useState, useEffect, MouseEvent, useCallback, useRef, RefObject } from "react";
import { useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
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
import { Plus, Trash2, Clock, Calculator, Delete, Factory, Download, Calendar, TrendingUp, Target, Save, Database, Loader2, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Sparkles, Zap, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { ExportToPng } from "@/components/ExportToPng";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toPng } from "html-to-image";
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
  getDraft,
  saveDraft,
  getProducaoHistory,
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

interface ReprocessoItem {
  id: number;
  numero: number;
  tipo: "Cortado" | "Usado";
  codigo: string;
  descricao: string;
  quantidade: string;
}

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

export default function Producao() {
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { setDocumentNav } = useDocumentNav();
  const producaoCardRef = useRef<HTMLDivElement>(null);
  const historicoCardRef = useRef<HTMLDivElement>(null);
  const chartPlanejadoRealizadoRef = useRef<HTMLDivElement>(null);
  const chartDiferencaItemRef = useRef<HTMLDivElement>(null);
  const chartStatusProducaoRef = useRef<HTMLDivElement>(null);
  const chartProducaoLinhaRef = useRef<HTMLDivElement>(null);
  const openedFromStateRef = useRef(false);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const isNewDocumentRef = useRef(false); // true após "Novo documento" para não recarregar do DB e manter setas habilitadas
  const justLoadedByIndexRef = useRef(false); // true após carregar doc pela seta, para o useEffect não sobrescrever com load sem filial
  const skipNextDataLoadRef = useRef(false); // true após restaurar rascunho, para não sobrescrever com loadFromDatabase
  const latestDraftRef = useRef<{ user_id: number; payload: Record<string, unknown> } | null>(null); // para salvar ao sair/aba
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
  const [currentView, setCurrentView] = useState<"menu" | "cadastro" | "historico">("menu");
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [allRecords, setAllRecords] = useState<any[]>([]); // Todos os registros ordenados
  const [currentRecordIndex, setCurrentRecordIndex] = useState<number>(-1); // Índice do registro atual
  const [currentRecordId, setCurrentRecordId] = useState<number | null>(null); // ID do registro atual

  // Catálogo de itens vindo da OCTI (mapeado por código)
  const [itemCatalog, setItemCatalog] = useState<Record<string, { nome_item: string }>>({});
  // Linhas de produção (OCLP)
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  // Reprocessos
  const [reprocessos, setReprocessos] = useState<ReprocessoItem[]>([]);
  // Filiais (OCTF)
  const [filiais, setFiliais] = useState<Array<{ id: number; codigo: string; nome: string; endereco: string }>>([]);
  const [filiaisLoadError, setFiliaisLoadError] = useState<string | null>(null);
  const [itemCatalogLoadError, setItemCatalogLoadError] = useState<string | null>(null);
  const [filialSelecionada, setFilialSelecionada] = useState<string>("");
  // Filtros do histórico: intervalo de datas e linha
  const [historyDataInicio, setHistoryDataInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [historyDataFim, setHistoryDataFim] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [historyLinhaFilter, setHistoryLinhaFilter] = useState<string>("");

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

  // Atualizar horas restantes e hora final para cada item quando necessário
  useEffect(() => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        const restanteHoras = calculateRestanteHorasForItem(item);
        const horaFinal = calculateHoraFinalForItem({ ...item, restanteHoras });
        // Só atualiza se os valores mudaram para evitar loops
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
    // Atualiza o campo \"Calculo 1 Horas\" do item que abriu a calculadora
    if (calculatorTargetItemId != null) {
      updateItem(calculatorTargetItemId, "horasTrabalhadas", result);
    }
    // Mantém também no estado geral (caso algum fluxo legado ainda use)
    setHorasTrabalhadas(result.replace(",", "."));
    setCalculatorOpen(false);
    setCalculatorDisplay("0");
    setCalculatorPreviousValue(null);
    setCalculatorOperation(null);
    setCalculatorShouldReset(false);
    setCalculo1HorasEditMode(false);
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
      // Ao fechar, limpa o alvo para evitar aplicar em item errado depois
      setCalculatorTargetItemId(null);
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

  // Remover linha
  const removeItem = (id: number) => {
    if (items.length > 1) {
      const newItems = items.filter((item) => item.id !== id);
      // Renumerar itens
      const renumberedItems = newItems.map((item, index) => ({
        ...item,
        numero: index + 1,
      }));
      setItems(renumberedItems);
    }
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

    // Validar se filial foi selecionada
    if (!filialSelecionada) {
      setSaveStatus({ success: false, message: "Por favor, selecione uma filial antes de salvar" });
      setSaving(false);
      return;
    }

    // Buscar o nome completo da filial (ex: "BELA IACA POLPAS DE FRUTAS INDUSTRIA E COMERCIO LTDA" ou "PETRUZ FRUITY INDUSTRIA, COMERCIO E DISTRIBUIDORA LTDA - PA")
    const filialSelecionadaObj = filiais.find(f => f.codigo === filialSelecionada);
    if (!filialSelecionadaObj || !filialSelecionadaObj.nome) {
      setSaveStatus({ success: false, message: "Filial selecionada não encontrada" });
      setSaving(false);
      return;
    }

    const filialNomeCompleto = filialSelecionadaObj.nome;

    try {
      const result = await saveProducao({
        dataDia: dataCabecalhoSelecionada || new Date().toISOString().split("T")[0],
        filialNome: filialNomeCompleto,
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

      await loadAllRecords();

      // Evitar que o useEffect recarregue do banco e sobrescreva os itens (ex.: observação por linha)
      if (wasUpdate) skipNextDataLoadRef.current = true;

      // Se era edição (registro já existia), mantém os dados na tela; senão reseta para novo cadastro
      if (!wasUpdate) {
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
        setLatasPrevista("");
        setLatasRealizadas("");
        setLatasBatidas("");
        setTotalCortado("");
        setPercentualMeta("");
        setTotalReprocesso("");
        setObservacao("");
        setReprocessos([]);
      } else {
        // Atualizar ocpdId nos itens que foram inseridos agora (backend retorna data com os novos ids)
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

  // Função para carregar dados do Supabase
  const loadFromDatabase = async (data?: string, filialNomeOverride?: string) => {
    setLoading(true);
    setSaveStatus(null);

    try {
      const dataToLoad = data || dataCabecalhoSelecionada || new Date().toISOString().split("T")[0];
      const filialNomeToUse = filialNomeOverride ?? (filialSelecionada ? filiais.find(f => f.codigo === filialSelecionada)?.nome : undefined);
      const result = await loadProducao({ data: dataToLoad, filialNome: filialNomeToUse });

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
          // Encontrar o código da filial pelo nome
          const filialEncontrada = filiais.find(f => f.nome === result.data[0].filial_nome);
          if (filialEncontrada) {
            setFilialSelecionada(filialEncontrada.codigo);
          }
        }

        setItems(loadedItems);

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
        if (result.reprocessos && Array.isArray(result.reprocessos) && result.reprocessos.length > 0) {
          result.reprocessos.forEach((r: any, idx: number) => {
            loadedReprocessos.push({
              id: Date.now() + idx,
              numero: r.numero ?? idx + 1,
              tipo: (r.tipo === "Usado" ? "Usado" : "Cortado") as "Cortado" | "Usado",
              codigo: r.codigo || "",
              descricao: r.descricao || "",
              quantidade: r.quantidade != null ? String(r.quantidade).replace(".", ",") : "",
            });
          });
        } else if (result.data && result.data.length > 0) {
          const firstRecord = result.data[0];
          if (firstRecord.reprocesso_numero || firstRecord.reprocesso_codigo || firstRecord.reprocesso_descricao) {
            loadedReprocessos.push({
              id: Date.now(),
              numero: firstRecord.reprocesso_numero || 1,
              tipo: (firstRecord.reprocesso_tipo as "Cortado" | "Usado") || "Cortado",
              codigo: firstRecord.reprocesso_codigo || "",
              descricao: firstRecord.reprocesso_descricao || "",
              quantidade: firstRecord.reprocesso_quantidade ? firstRecord.reprocesso_quantidade.toString().replace(".", ",") : "",
            });
          }
        }
        setReprocessos(loadedReprocessos);

        // Adicionar a data ao conjunto de datas disponíveis
        setAvailableDates(prev => new Set([...prev, dataToLoad]));
        setSaveStatus({
          success: true,
          message: `${result.count} item(ns) carregado(s) do banco!`,
        });

        setTimeout(() => {
          setSaveStatus(null);
        }, 5000);
      } else {
        setSaveStatus({
          success: false,
          message: `Nenhum dado encontrado para ${formatDateShort(dataToLoad)}`,
        });
        setTimeout(() => {
          setSaveStatus(null);
        }, 3000);
      }
    } catch (error: any) {
      console.error("Erro ao carregar produção:", error);
      setSaveStatus({
        success: false,
        message: error.message || "Erro ao carregar dados do banco",
      });
      setTimeout(() => {
        setSaveStatus(null);
      }, 5000);
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

  // Função para carregar histórico de produção (intervalo de datas e filtro por linha)
  const loadHistory = async (opts?: { data?: string; dataInicio?: string; dataFim?: string; linha?: string }) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      // Intervalo de datas (prioridade)
      const dataInicio = opts?.dataInicio ?? historyDataInicio;
      const dataFim = opts?.dataFim ?? historyDataFim;
      const linha = opts?.linha ?? historyLinhaFilter;
      if (dataInicio) params.set("dataInicio", dataInicio);
      if (dataFim) params.set("dataFim", dataFim);
      if (linha && linha.trim() !== "") params.set("linha", linha.trim());
      // Data única (legado, quando não usa intervalo)
      if (!dataInicio && !dataFim && opts?.data) params.set("data", opts.data);
      if (filialSelecionada) {
        const filialNome = filiais.find(f => f.codigo === filialSelecionada)?.nome;
        if (filialNome) params.set("filialNome", filialNome);
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

  // Função para carregar todos os registros ordenados (por data e ordem de criação)
  const loadAllRecords = async () => {
    try {
      const filialNomeForQuery = filialSelecionada ? filiais.find((f) => f.codigo === filialSelecionada)?.nome : undefined;
      const result = await getProducaoHistory({ limit: 1000, filialNome: filialNomeForQuery });

      if (Array.isArray(result) && result.length > 0) {
        const recordsMap = new Map<string, any>();
        const dates = new Set<string>();

        result.forEach((item: any) => {
          const dateValue = item.data_dia || item.data_cabecalho || item.data;
          if (dateValue) {
            const dateStr = typeof dateValue === 'string'
              ? dateValue.split('T')[0]
              : new Date(dateValue).toISOString().split('T')[0];

            dates.add(dateStr);

            const filialNome = (item.filial_nome || '').trim();
            const recordKey = `${dateStr}_${filialNome}`;

            if (!recordsMap.has(recordKey)) {
              recordsMap.set(recordKey, {
                ...item,
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
      }
    } catch (error: any) {
      console.error("Erro ao carregar registros:", error);
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
    const currentFilialNome = filiais.find(f => f.codigo === filialSelecionada)?.nome ?? '';
    const index = allRecords.findIndex(r => {
      const recordDate = r.data_dia || r.data_cabecalho || r.data;
      const dateStr = typeof recordDate === 'string'
        ? recordDate.split('T')[0]
        : new Date(recordDate).toISOString().split('T')[0];
      const recordFilial = (r.filial_nome || '').trim();
      return dateStr === currentDate && recordFilial === (currentFilialNome || '').trim();
    });

    return index >= 0 ? index : -1;
  };

  // Função para carregar um registro específico pelo índice (um documento = data + filial)
  const loadRecordByIndex = async (index: number) => {
    if (index < 0 || index >= allRecords.length) return;

    isNewDocumentRef.current = false;
    justLoadedByIndexRef.current = true; // evita que o useEffect sobrescreva os dados ao mudar dataCabecalhoSelecionada
    const record = allRecords[index];
    const recordDate = record.data_dia || record.data_cabecalho || record.data;
    const dateStr = typeof recordDate === 'string'
      ? recordDate.split('T')[0]
      : new Date(recordDate).toISOString().split('T')[0];

    setDataCabecalhoSelecionada(dateStr);
    setCurrentRecordIndex(index);
    setCurrentRecordId(record.id);
    const recordFilialNome = (record.filial_nome || '').trim();
    if (recordFilialNome) {
      const codigo = filiais.find(f => (f.nome || '').trim() === recordFilialNome)?.codigo;
      if (codigo) setFilialSelecionada(codigo);
    }

    await loadFromDatabase(dateStr, recordFilialNome || undefined);
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

  // Função para criar novo cadastro (limpar tudo)
  const createNewCadastro = () => {
    isNewDocumentRef.current = true;
    setCurrentRecordIndex(-1);
    setCurrentRecordId(null);
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

  // Abrir documento vindo de Relatórios (navigate com state: loadData, loadFilialNome)
  useEffect(() => {
    const state = location.state as { loadData?: string; loadFilialNome?: string } | null;
    if (!state?.loadData || !state?.loadFilialNome || openedFromStateRef.current || filiais.length === 0) return;
    openedFromStateRef.current = true;
    setDataCabecalhoSelecionada(state.loadData);
    const filial = filiais.find((f) => (f.nome || "").trim() === (state.loadFilialNome || "").trim());
    if (filial?.codigo) setFilialSelecionada(filial.codigo);
    setCurrentView("cadastro");
    loadFromDatabase(state.loadData, state.loadFilialNome);
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
      loadFromDatabase(dataCabecalhoSelecionada);
      const index = findCurrentRecordIndex();
      if (index >= 0) {
        setCurrentRecordIndex(index);
        if (allRecords[index]) {
          setCurrentRecordId(allRecords[index].id);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataCabecalhoSelecionada, currentView, allRecords]);

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

  // Ao abrir o histórico, carregar com os filtros atuais (intervalo de datas e linha)
  useEffect(() => {
    if (currentView === "historico") {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

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
    });
    return () => setDocumentNav(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, currentRecordIndex, currentRecordId, allRecords.length, dataCabecalhoSelecionada]);

  // Função para exportar análise de produção como PNG
  const exportProducaoAsPNG = async () => {
    if (!producaoCardRef.current) return;

    try {
      await new Promise(resolve => setTimeout(resolve, 400));

      const element = producaoCardRef.current;

      // Capturar o elemento usando html-to-image com configurações para manter fidelidade
      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        quality: 1.0,
        cacheBust: true,
        skipAutoScale: false,
        skipFonts: false,
        filter: (node) => {
          // Não filtrar nenhum nó para manter tudo visível
          return true;
        },
      });

      // Criar imagem a partir do data URL
      const img = new Image();
      img.src = dataUrl;

      await new Promise((resolve) => {
        img.onload = () => {
          // Criar canvas com padding
          const padding = 40;
          const canvas = document.createElement('canvas');
          canvas.width = img.width + (padding * 2);
          canvas.height = img.height + (padding * 2);
          const ctx = canvas.getContext('2d');

          if (ctx) {
            // Fundo branco
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Desenhar a imagem com padding
            ctx.drawImage(img, padding, padding);
          }

          // Download
          const link = document.createElement("a");
          link.download = `analise - producao - ${new Date().toISOString().split('T')[0]}.png`;
          link.href = canvas.toDataURL("image/png", 1.0);
          link.click();
          resolve(undefined);
        };
      });
    } catch (error) {
      console.error("Erro ao exportar análise de produção:", error);
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

            {/* Card: Histórico */}
            <div
              onClick={() => {
                setCurrentView("historico");
                loadHistory();
              }}
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
                      <Database className="relative h-8 w-8 text-primary group-hover/card:scale-110 transition-transform duration-500" />
                      <Sparkles className="absolute -top-0.5 -right-0.5 h-4 w-4 text-primary/50 opacity-0 group-hover/card:opacity-100 group-hover/card:animate-spin transition-opacity duration-300" />
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="space-y-2">
                    <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-foreground via-foreground/95 to-foreground/90 bg-clip-text text-transparent group-hover/card:from-primary group-hover/card:via-primary/90 group-hover/card:to-primary/80 transition-all duration-500">
                      Histórico de Análise de Produção
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground/70 leading-relaxed">
                      Visualize registros anteriores de produção
                    </p>
                  </div>

                  {/* Badge e seta */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] sm:text-xs font-medium group-hover/card:bg-primary/15 group-hover/card:border-primary/35 transition-colors duration-300">
                      <Database className="h-2.5 w-2.5" />
                      Consultar
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

    // Conteúdo do cadastro
    if (currentView === "cadastro") {
      return (
        <div className="space-y-6 min-w-0">
          {/* Botão de voltar - só seta, área de toque adequada no mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView("menu")}
            className="mt-6 mb-4 size-11 min-h-[44px] rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-accent hover:border-primary/30 hover:shadow-md transition-all"
            aria-label="Voltar ao menu"
          >
            <ArrowLeft className="size-5 text-foreground" strokeWidth={2.5} />
          </Button>

          {/* Card: Acompanhamento diário da produção */}
          <div ref={producaoCardRef} data-export-target className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] transition-all duration-500 overflow-hidden group/card">
            {/* Efeito de brilho sutil */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
            {/* Borda superior com gradiente */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

            <div className="relative z-10">
            <div
              className="relative w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 lg:p-8 transition-all duration-500 group/button bg-gradient-to-r from-transparent via-primary/2 to-transparent"
            >
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-5 min-w-0">
                  {/* Ícone com efeito glassmorphism melhorado */}
                  <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                    <Factory className="relative h-7 w-7 text-primary drop-shadow-lg" />
                  </div>

                  <div className="text-left space-y-2">
                    <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                      Acompanhamento diário da produção
                    </h2>
                    <p className="text-sm text-muted-foreground/80 font-medium">
                      Registre e gerencie a produção do dia
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary/70" />
                        <span className="text-sm sm:text-base font-mono font-semibold text-primary">
                          {formatTime(currentTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Input de data com navegação */}
                        <div className="flex items-center gap-2">
                          <Calendar
                            className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/70 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => {
                              if (dataInputRef.current) {
                                if (typeof dataInputRef.current.showPicker === 'function') {
                                  dataInputRef.current.showPicker();
                                } else {
                                  dataInputRef.current.click();
                                }
                              }
                            }}
                          />
                          <div className="relative group">
                            <Input
                              ref={dataInputRef}
                              type="date"
                              className="hidden"
                              value={dataCabecalhoSelecionada}
                              onChange={(e) => setDataCabecalhoSelecionada(e.target.value)}
                            />
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-transparent group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
                              <span className="text-sm sm:text-base text-muted-foreground/90 font-medium capitalize select-none pointer-events-none">
                                {formatDate(dataCabecalhoSelecionada ? parseDateString(dataCabecalhoSelecionada) : currentTime)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botões de navegação e novo cadastro - agrupados */}
                        <div className="flex items-center gap-1">
                          {/* Botões de navegação - setas lado a lado */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigateToPreviousRecord();
                            }}
                            disabled={!hasPreviousRecord()}
                            className="flex items-center justify-center h-8 w-8 rounded-md border border-border/50 bg-background/50 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background/50"
                            title={hasPreviousRecord() ? "Registro anterior" : "Não há registros anteriores"}
                          >
                            <ChevronLeft className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigateToNextRecord();
                            }}
                            disabled={!hasNextRecord()}
                            className="flex items-center justify-center h-8 w-8 rounded-md border border-border/50 bg-background/50 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background/50"
                            title={hasNextRecord() ? "Próximo registro" : "Não há registros posteriores"}
                          >
                            <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </button>

                          {/* Botão de novo cadastro */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              createNewCadastro();
                            }}
                            className="flex items-center justify-center h-8 w-8 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/40 transition-all duration-200"
                            title="Criar novo cadastro"
                          >
                            <Plus className="h-4 w-4 text-primary" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botões de ação - empilham no mobile, touch-friendly */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      saveToDatabase();
                    }}
                    disabled={saving || items.length === 0}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success z-20 relative backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                      loadFromDatabase();
                    }}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary z-20 relative backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Carregar do banco de dados"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : (
                      <Database className="h-4 w-4 shrink-0" />
                    )}
                    <span className="hidden sm:inline">{loading ? "Carregando..." : "Carregar"}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      exportProducaoAsPNG();
                    }}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary z-20 relative backdrop-blur-sm"
                    title="Exportar como PNG"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Exportar PNG</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-4 sm:p-5 lg:p-7 space-y-5 sm:space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Status de salvamento/carregamento */}
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
                          <SelectItem key={filial.id} value={filial.codigo ?? String(filial.id)}>
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
                          <TableHead className="min-w-[150px] sm:min-w-[200px] text-xs sm:text-sm">Descrição</TableHead>
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
                              <Input
                                type="date"
                                value={item.dataDia || new Date().toISOString().split("T")[0]}
                                onChange={(e) => updateItem(item.id, "dataDia", e.target.value)}
                                className="h-8 sm:h-9 text-xs sm:text-sm"
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
                            <TableCell className="p-2 sm:p-4">
                              <Input
                                value={item.descricaoItem}
                                onChange={(e) => updateItem(item.id, "descricaoItem", e.target.value)}
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                                placeholder="Descrição"
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
                                className={`flex h-8 sm:h-9 items-center rounded-md border border-input bg-muted/50 px-2 sm:px-3 text-xs sm:text-sm font-medium ${item.diferenca < 0
                                  ? "text-destructive"
                                  : item.diferenca > 0
                                    ? "text-warning"
                                    : "text-success"
                                  }`}
                              >
                                <Calculator className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                <span className="truncate">{item.diferenca.toFixed(2)}</span>
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
                                onClick={() => removeItem(item.id)}
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
                                  className={`flex h-8 sm:h-9 items-center justify-center rounded-md border px-2 text-xs sm:text-sm font-bold ${totais.diferencaTotal < 0
                                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                                    : totais.diferencaTotal > 0
                                      ? "border-warning/30 bg-warning/10 text-warning"
                                      : "border-success/30 bg-success/10 text-success"
                                    }`}
                                >
                                  {formatTotal(totais.diferencaTotal)}
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
                              setCalculatorTargetItemId(item.id);
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
                        <div className="flex h-9 sm:h-10 items-center rounded-md border border-input bg-primary/10 px-2 sm:px-3 text-xs sm:text-sm font-mono font-semibold text-primary">
                          <span className="truncate">{item.horaFinal || "---"}</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Cálculo automático em tempo real</p>
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
                <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  </div>

                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 sm:w-16 text-center text-xs sm:text-sm">N°</TableHead>
                            <TableHead className="min-w-[140px] sm:min-w-[160px] text-xs sm:text-sm">Tipo do Reprocesso</TableHead>
                            <TableHead className="min-w-[120px] sm:min-w-[140px] text-xs sm:text-sm">Código do reprocesso</TableHead>
                            <TableHead className="min-w-[150px] sm:min-w-[200px] text-xs sm:text-sm">Descrição do reprocesso</TableHead>
                            <TableHead className="min-w-[140px] sm:min-w-[160px] text-xs sm:text-sm">Quantidade</TableHead>
                            <TableHead className="w-12 sm:w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reprocessos.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                                Nenhum reprocesso cadastrado. Clique em "Adicionar Reprocesso" para começar.
                              </TableCell>
                            </TableRow>
                          ) : (
                            reprocessos.map((reprocesso) => (
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
                                  <Input
                                    value={reprocesso.codigo}
                                    onChange={(e) => updateReprocesso(reprocesso.id, "codigo", e.target.value)}
                                    className="h-8 sm:h-9 text-xs sm:text-sm"
                                    placeholder="Código"
                                  />
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Input
                                    value={reprocesso.descricao}
                                    onChange={(e) => updateReprocesso(reprocesso.id, "descricao", e.target.value)}
                                    className="h-8 sm:h-9 text-xs sm:text-sm"
                                    placeholder="Descrição"
                                  />
                                </TableCell>
                                <TableCell className="p-2 sm:p-4">
                                  <Input
                                    type="text"
                                    value={reprocesso.quantidade}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === "" || /^[\d.,]*$/.test(value)) {
                                        updateReprocesso(reprocesso.id, "quantidade", value);
                                      }
                                    }}
                                    className="h-8 sm:h-9 text-xs sm:text-sm text-center"
                                    placeholder="0,00"
                                  />
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
                          {reprocessos
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
                          {reprocessos
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

                {/* Seção: Análise Gráfica */}
                <div className="space-y-6">
                  {/* Gráfico 1: Planejado vs Realizado */}
                  <div ref={chartPlanejadoRealizadoRef} className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                          <Target className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-card-foreground">Planejado vs Realizado</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground/70">Comparação por item de produção</p>
                        </div>
                      </div>
                      <ExportToPng targetRef={chartPlanejadoRealizadoRef} filenamePrefix="grafico-planejado-realizado" expandScrollable={false} className="shrink-0" />
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={items.map((item) => ({
                          name: item.descricaoItem || item.codigoItem || item.op || `Item ${item.numero}`,
                          planejado: parseFormattedNumber(item.quantidadePlanejada),
                          realizado: parseFormattedNumber(item.quantidadeRealizada),
                          diferenca: item.diferenca,
                        }))}
                        margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis
                          dataKey="name"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            padding: "8px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                        />
                        <Legend />
                        <Bar dataKey="planejado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Planejado">
                          <LabelList
                            content={(props: any) => <CustomBarLabel {...props} dataKey="planejado" />}
                            position="top"
                          />
                        </Bar>
                        <Bar dataKey="realizado" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Realizado">
                          <LabelList
                            content={(props: any) => <CustomBarLabel {...props} dataKey="realizado" />}
                            position="top"
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Gráficos em Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Gráfico 2: Diferença por Item - barras horizontais: nome à esquerda, valor à direita */}
                    <div ref={chartDiferencaItemRef} className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 border border-warning/20">
                            <TrendingUp className="h-5 w-5 text-warning" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-card-foreground">Diferença por Item</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">Variação entre planejado e realizado</p>
                          </div>
                        </div>
                        <ExportToPng targetRef={chartDiferencaItemRef} filenamePrefix="grafico-diferenca-item" expandScrollable={false} className="shrink-0" />
                      </div>
                      <ResponsiveContainer width="100%" height={Math.max(220, items.length * 40)}>
                        <BarChart
                          layout="vertical"
                          data={items.map((item) => ({
                            name: item.descricaoItem || item.codigoItem || item.op || `Item ${item.numero}`,
                            diferenca: item.diferenca,
                          }))}
                          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" width={200} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              padding: "8px",
                            }}
                            formatter={(value: number) => [formatNumber(value), "Diferença"]}
                          />
                          <Bar dataKey="diferenca" name="Diferença" radius={[0, 4, 4, 0]} maxBarSize={28}>
                            <LabelList dataKey="diferenca" position="right" formatter={(v: number) => formatNumber(v)} className="fill-foreground" fontSize={11} />
                            {items.map((_, i) => (
                              <Cell key={i} fill={items[i].diferenca >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Gráfico 3: Status de Produção - reflete o % do quadro Percentual Meta */}
                    <div ref={chartStatusProducaoRef} className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-4 sm:p-5 lg:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                      <div className="mb-4 sm:mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 border border-success/20">
                            <Factory className="h-5 w-5 text-success" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-card-foreground">Status de Produção</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">Mesmo percentual do quadro “Percentual Meta” (total realizado ÷ total planejado)</p>
                          </div>
                        </div>
                        <ExportToPng targetRef={chartStatusProducaoRef} filenamePrefix="grafico-status-producao" expandScrollable={false} className="shrink-0" />
                      </div>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          {(() => {
                            const { totalPlanejada, totalRealizada } = calcularTotaisProducao();
                            const perc = totalPlanejada > 0 ? (totalRealizada / totalPlanejada) * 100 : 0;
                            const statusData =
                              totalPlanejada === 0
                                ? [{ name: "Sem meta definida", value: 100, color: "#6b7280" }]
                                : perc >= 100
                                  ? [{ name: "Meta atingida (≥100%)", value: 100, color: "#10b981" }]
                                  : [
                                      { name: `Meta atingida (${perc.toFixed(1).replace(".", ",")}%)`, value: perc, color: "#10b981" },
                                      { name: `Faltando (${(100 - perc).toFixed(1).replace(".", ",")}%)`, value: 100 - perc, color: "#ef4444" },
                                    ];
                            return (
                              <>
                                <Pie
                                  data={statusData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    padding: "8px",
                                  }}
                                  formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                                />
                                <Legend />
                              </>
                            );
                          })()}
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gráfico 4: Produção por Linha — valor realizado vs meta por linha (mesmo do dashboard) */}
                  {(() => {
                    const porLinha = items.reduce<Record<string, { valor: number; meta: number }>>((acc, item) => {
                      const linha = (item.linha || "").trim() || "Sem linha";
                      if (!acc[linha]) acc[linha] = { valor: 0, meta: 0 };
                      acc[linha].valor += parseFormattedNumber(item.quantidadeRealizada);
                      acc[linha].meta += parseFormattedNumber(item.quantidadePlanejada);
                      return acc;
                    }, {});
                    const productionDataLinha = Object.entries(porLinha).map(([key, v]) => ({
                      name: key === "Sem linha" ? key : (productionLines.find(l => l.code === key || (l.name || "").trim() === key)?.name || key),
                      valor: v.valor,
                      meta: v.meta,
                    })).filter(d => d.valor > 0 || d.meta > 0);
                    if (productionDataLinha.length === 0) return null;
                    return (
                      <div ref={chartProducaoLinhaRef} className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                              <Factory className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base sm:text-lg font-bold text-card-foreground">Produção por Linha</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground">Valor realizado vs meta por linha</p>
                            </div>
                          </div>
                          <ExportToPng targetRef={chartProducaoLinhaRef} filenamePrefix="grafico-producao-linha" expandScrollable={false} className="shrink-0" />
                        </div>
                        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:h-2" style={{ minHeight: 320 }}>
                          <div className="min-w-[280px]" style={{ minWidth: Math.max(280, productionDataLinha.length * 72) }}>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart
                                data={productionDataLinha}
                                margin={{ top: 20, right: 20, left: 0, bottom: 56 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                <XAxis
                                  dataKey="name"
                                  stroke="hsl(var(--muted-foreground))"
                                  fontSize={11}
                                  tickLine={false}
                                  axisLine={false}
                                  angle={-35}
                                  textAnchor="end"
                                  height={48}
                                  interval={0}
                                />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", padding: "8px" }}
                              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Realizado">
                              <LabelList content={(props: any) => <CustomBarLabel {...props} dataKey="valor" />} position="top" />
                            </Bar>
                            <Bar dataKey="meta" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Meta" opacity={0.5}>
                              <LabelList content={(props: any) => <CustomBarLabel {...props} dataKey="meta" />} position="top" />
                            </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Conteúdo do histórico
    if (currentView === "historico") {
      return (
        <div className="space-y-6 min-w-0 overflow-x-hidden">
          {/* Botão de voltar - só seta */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView("menu")}
            className="mt-6 mb-4 size-11 min-h-[44px] rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-accent hover:border-primary/30 hover:shadow-md transition-all"
            aria-label="Voltar ao menu"
          >
            <ArrowLeft className="size-5 text-foreground" strokeWidth={2.5} />
          </Button>

          {/* Título e descrição — acima do card (layout reorganizado para mobile) */}
          <div className="relative mb-4 sm:mb-5 rounded-2xl p-4 sm:py-5 sm:px-0 transition-all duration-500 group/button">
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

          {/* Card: filtros + tabela */}
          <div ref={historicoCardRef} className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] transition-all duration-500 overflow-hidden group/card">
            {/* Efeito de brilho sutil */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
            {/* Borda superior com gradiente */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

            <div className="relative z-10">
              {/* Filtros: intervalo de datas e linha — em coluna abaixo de 791px */}
              <div className="flex flex-col gap-4 min-[791px]:flex-row min-[791px]:flex-nowrap min-[791px]:items-center min-[791px]:justify-between w-full p-4 min-[791px]:p-6 min-[791px]:pb-5 min-[791px]:pt-6 lg:p-8 transition-all duration-500 bg-gradient-to-r from-transparent via-primary/2 to-transparent rounded-t-2xl overflow-visible">
                <div className="flex flex-col gap-3 min-[791px]:flex-row min-[791px]:flex-nowrap min-[791px]:items-center min-[791px]:gap-2 overflow-visible">
                  <div className="flex items-center gap-2 w-full min-w-0 min-[791px]:flex-1 min-[791px]:flex-initial min-[791px]:min-w-[160px] overflow-visible">
                    <span className="flex shrink-0 w-6 h-6 items-center justify-center text-muted-foreground" aria-hidden>
                      <Calendar className="h-4 w-4 min-w-[16px] min-h-[16px]" />
                    </span>
                    <Label htmlFor="history-data-inicio" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">De</Label>
                    <Input
                      id="history-data-inicio"
                      type="date"
                      value={historyDataInicio}
                      onChange={(e) => setHistoryDataInicio(e.target.value)}
                      className="h-9 flex-1 min-w-[120px] w-full min-[791px]:w-[140px] text-sm overflow-visible"
                      title="Data inicial do intervalo"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full min-w-0 min-[791px]:flex-1 min-[791px]:flex-initial min-[791px]:min-w-[160px] overflow-visible">
                    <span className="flex shrink-0 w-6 h-6 items-center justify-center text-muted-foreground" aria-hidden>
                      <Calendar className="h-4 w-4 min-w-[16px] min-h-[16px]" />
                    </span>
                    <Label htmlFor="history-data-fim" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Até</Label>
                    <Input
                      id="history-data-fim"
                      type="date"
                      value={historyDataFim}
                      onChange={(e) => setHistoryDataFim(e.target.value)}
                      className="h-9 flex-1 min-w-[120px] w-full min-[791px]:w-[140px] text-sm overflow-visible"
                      title="Data final do intervalo"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full min-w-0 min-[791px]:w-auto">
                    <Label htmlFor="history-linha" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Linha</Label>
                    <Select value={historyLinhaFilter || "todas"} onValueChange={(v) => setHistoryLinhaFilter(v === "todas" ? "" : v)}>
                      <SelectTrigger id="history-linha" className="h-9 w-full min-w-0 min-[791px]:w-[260px] text-sm">
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
                    className="w-full min-[791px]:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary z-20 relative backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Filtrar histórico pelo intervalo e linha"
                  >
                    {historyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4" />
                    )}
                    <span className="hidden min-[791px]:inline">{historyLoading ? "Carregando..." : "Filtrar"}</span>
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
                  <p className="text-xs text-muted-foreground/70 mt-1">Os registros salvos aparecerão aqui</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-lg border border-border/40 [&::-webkit-scrollbar]:h-2">
                  <div className="inline-block min-w-full align-middle">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Data</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Hora</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">OP</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Código</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Descrição</TableHead>
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
                          const openDocument = () => {
                            const dataDia = (record.data_dia || record.data_cabecalho) as string;
                            if (dataDia) setDataCabecalhoSelecionada(dataDia);
                            const filial = recordFilialNome ? filiais.find((f) => (f.nome || "").trim() === recordFilialNome) : null;
                            if (filial?.codigo) setFilialSelecionada(filial.codigo);
                            setCurrentView("cadastro");
                            loadFromDatabase(dataDia, recordFilialNome || undefined);
                          };
                          // Hora: hora_cabecalho ou, se vazia, hora de cadastro (created_at)
                          const horaFormatada = record.hora_cabecalho || (record.created_at ? formatHoraFinal(record.created_at) : "-");
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
                            <TableRow key={record.id || index}>
                              <TableCell className="text-xs sm:text-sm font-mono">{dataFormatada}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-mono">{horaFormatada}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-semibold">{record.op || "-"}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-mono font-semibold">{record.codigo_item || "-"}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-semibold break-words">{record.descricao_item || "-"}</TableCell>
                              <TableCell className="text-xs sm:text-sm font-semibold">{linhaNome}</TableCell>
                              <TableCell className="text-xs sm:text-sm text-right">{formatTotal(parseFloat(record.qtd_planejada) || 0)}</TableCell>
                              <TableCell className="text-xs sm:text-sm text-right">{formatTotal(parseFloat(record.qtd_realizada) || 0)}</TableCell>
                              <TableCell className={`text-xs sm:text-sm text-right ${parseFloat(record.diferenca) < 0 ? "text-destructive" :
                                parseFloat(record.diferenca) > 0 ? "text-warning" :
                                  "text-success"
                                }`}>
                                {formatTotal(parseFloat(record.diferenca) || 0)}
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
