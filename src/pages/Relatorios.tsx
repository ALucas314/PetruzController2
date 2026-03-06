import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, DollarSign, ShoppingCart, Minus, Target, Loader2, Download, Pencil } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFiliais, getLines, getDashboardStats, getProducaoHistory } from "@/services/supabaseData";

interface DashboardStats {
  totalPlanejado: string;
  totalRealizado: string;
  diferenca: string;
  percentualMeta: string;
  variacaoPercentual: number;
  registros: number;
}

interface ProductionLine {
  id: number;
  code: string;
  name: string;
}

interface HistoryRecord {
  id?: number;
  data_dia: string;
  hora_cabecalho?: string;
  created_at?: string | null;
  filial_nome?: string;
  linha?: string;
  op?: string;
  codigo_item?: string;
  descricao_item?: string;
  qtd_planejada?: number;
  qtd_realizada?: number;
  diferenca?: number;
  calculo_1_horas?: number | null;
  restante_horas?: string | null;
  hora_final?: string | null;
  percentual_meta?: number | null;
}

const PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "1y", label: "Último ano" },
] as const;

function getDateRange(period: string) {
  const hoje = new Date();
  const dataFim = hoje.toISOString().split("T")[0];
  const dataInicio = new Date(hoje);
  switch (period) {
    case "hoje":
      return { dataInicio: dataFim, dataFim };
    case "7d":
      dataInicio.setDate(dataInicio.getDate() - 7);
      break;
    case "30d":
      dataInicio.setDate(dataInicio.getDate() - 30);
      break;
    case "90d":
      dataInicio.setDate(dataInicio.getDate() - 90);
      break;
    case "1y":
      dataInicio.setFullYear(dataInicio.getFullYear() - 1);
      break;
    default:
      dataInicio.setDate(dataInicio.getDate() - 30);
  }
  return {
    dataInicio: dataInicio.toISOString().split("T")[0],
    dataFim,
  };
}

function formatValue(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0,00";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(str: string): string {
  if (!str) return "—";
  try {
    const [y, m, d] = str.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return str;
  }
}

/** Formata hora no formato HH:MM:SS ou HH:MM para exibição (DD/MM/YYYY ou timestamp ISO). */
function formatTime(value: string | null | undefined): string {
  if (!value || value === "—") return "—";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const s = d.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  } catch {
    if (value.length >= 8 && value.includes(":")) return value;
    return "—";
  }
}

/** hora_cabecalho vem como "HH:MM:SS" do backend. */
function formatHoraCabecalho(h: string | null | undefined): string {
  if (!h || String(h).trim() === "") return "—";
  const s = String(h).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s.length === 5 ? `${s}:00` : s;
  return s;
}

/** Hora do registro: usa hora_cabecalho ou, se vazia, extrai do created_at (hora de cadastro). */
function formatHoraRegistro(record: { hora_cabecalho?: string | null; created_at?: string | null }): string {
  const h = formatHoraCabecalho(record.hora_cabecalho);
  if (h !== "—") return h;
  if (record.created_at) return formatTime(record.created_at);
  return "—";
}

export default function Relatorios() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("30d");
  const [filial, setFilial] = useState<string>("");
  const [filiais, setFiliais] = useState<Array<{ id: number; codigo: string; nome: string }>>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Histórico de Análise de Produção
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const hojeStr = hoje.toISOString().split("T")[0];
  const [dateDe, setDateDe] = useState(primeiroDiaMes);
  const [dateAte, setDateAte] = useState(hojeStr);
  const [linhaFilter, setLinhaFilter] = useState<string>("all");
  const [linhas, setLinhas] = useState<ProductionLine[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /** Mapa código ou nome -> nome da linha (para exibir sempre o nome na tabela) */
  const lineDisplayName = useMemo(() => {
    const map: Record<string, string> = {};
    linhas.forEach((l) => {
      if (l.code) map[String(l.code).trim()] = l.name ?? l.code;
      if (l.name) map[String(l.name).trim()] = l.name;
    });
    return (key: string | null | undefined) => {
      if (!key || String(key).trim() === "") return "—";
      const k = String(key).trim();
      return map[k] ?? key;
    };
  }, [linhas]);

  useEffect(() => {
    getFiliais()
      .then((data) => {
        setFiliais(data.map((f) => ({ id: f.id as number, codigo: String(f.codigo ?? ""), nome: String(f.nome ?? "") })));
        if (data.length > 0) setFilial((prev) => prev || String(data[0].nome));
      })
      .catch((e) => console.error("Erro ao carregar filiais:", e));
  }, []);

  useEffect(() => {
    getLines()
      .then((data) => setLinhas(data.map((l) => ({ id: l.id as number, code: String(l.code ?? ""), name: String(l.name ?? "") }))))
      .catch((e) => console.error("Erro ao carregar linhas:", e));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { dataInicio, dataFim } = getDateRange(period);
      const filialNome = filial || undefined;
      const statsResult = await getDashboardStats({ dataInicio, dataFim, filialNome });
      setStats(statsResult);
    } catch (e) {
      console.error("Erro ao carregar estatísticas:", e);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [period, filial]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const filialNome = filial || undefined;
      const linha = linhaFilter === "all" || !linhaFilter ? undefined : linhaFilter;
      const data = await getProducaoHistory({ limit: 500, dataInicio: dateDe, dataFim: dateAte, filialNome, linha });
      setHistory(data as HistoryRecord[]);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [dateDe, dateAte, linhaFilter, filial]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const exportCsv = () => {
    const headers = [
      "Data",
      "Hora",
      "OP",
      "Código",
      "Descrição",
      "Linha",
      "Qtd. Planejada",
      "Qtd. Realizada",
      "Diferença",
      "Kg/h",
      "Restante",
      "Hora final",
      "% Meta",
    ];
    const rows = history.map((r) => [
      formatDate(r.data_dia),
      formatHoraRegistro(r),
      r.op ?? "-",
      r.codigo_item ?? "",
      (r.descricao_item ?? "").replace(/"/g, '""'),
      lineDisplayName(r.linha),
      String(r.qtd_planejada ?? 0).replace(".", ","),
      String(r.qtd_realizada ?? 0).replace(".", ","),
      String(r.diferenca ?? 0).replace(".", ","),
      r.calculo_1_horas != null ? String(r.calculo_1_horas) : "-",
      (r.restante_horas ?? "-").replace(/"/g, '""'),
      formatTime(r.hora_final),
      r.percentual_meta != null ? `${r.percentual_meta}%` : "-",
    ]);
    const csv = [headers.join(";"), ...rows.map((row) => row.map((c) => `"${c}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-analise-producao-${dateDe}-${dateAte}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Relatórios
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-medium mt-1">
            Consulte dados de produção já cadastrados
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
          <Select value={filial || "all"} onValueChange={(v) => setFilial(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full min-w-0 sm:w-[200px] md:w-[240px] bg-card/80 border-border/50">
              <SelectValue placeholder="Filial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as filiais</SelectItem>
              {filiais.map((f) => (
                <SelectItem key={f.id} value={f.nome}>
                  {f.nome.length > 40 ? `${f.nome.slice(0, 40)}...` : f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v)}>
            <SelectTrigger className="w-full min-w-0 sm:w-[160px] bg-card/80 border-border/50">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total Planejado"
              value={stats ? formatValue(stats.totalPlanejado) : "0"}
              change={stats?.variacaoPercentual ?? 0}
              icon={DollarSign}
            />
            <KpiCard
              title="Total Realizado"
              value={stats ? formatValue(stats.totalRealizado) : "0"}
              change={stats?.variacaoPercentual ?? 0}
              icon={ShoppingCart}
            />
            <KpiCard
              title="Diferença"
              value={stats ? formatValue(stats.diferenca) : "0"}
              change={stats?.variacaoPercentual ?? 0}
              icon={Minus}
            />
            <KpiCard
              title="Percentual Meta"
              value={stats ? `${parseFloat(stats.percentualMeta).toFixed(2)}%` : "0%"}
              change={stats?.variacaoPercentual ?? 0}
              icon={Target}
            />
          </div>
        )}

        {/* Histórico de Análise de Produção - exatamente como especificado */}
        <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm p-4 sm:p-5 lg:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/30">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-card-foreground">
                Histórico de Análise de Produção
              </h2>
              <p className="text-xs text-muted-foreground">
                Visualize registros anteriores de produção
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="date-de">De</Label>
              <Input
                id="date-de"
                type="date"
                value={dateDe}
                onChange={(e) => setDateDe(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-ate">Até</Label>
              <Input
                id="date-ate"
                type="date"
                value={dateAte}
                onChange={(e) => setDateAte(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Linha</Label>
              <Select value={linhaFilter} onValueChange={setLinhaFilter}>
                <SelectTrigger className="w-full bg-card/80 border-border/50">
                  <SelectValue placeholder="Todas as linhas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as linhas</SelectItem>
                  {linhas.map((l) => (
                    <SelectItem key={l.id} value={l.code}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => loadHistory()} disabled={historyLoading} className="w-full sm:w-auto">
                {historyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Filtrar"
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={exportCsv}
                disabled={historyLoading || history.length === 0}
                title="Exportar CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum dado de produção no período selecionado.
            </p>
          ) : (
            <div
              className="overflow-x-auto rounded-lg border border-border/40 [&::-webkit-scrollbar]:h-2"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Data</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Hora</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">OP</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Código</TableHead>
                    <TableHead className="text-xs sm:text-sm min-w-[140px]">Descrição</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Linha</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right whitespace-nowrap">Qtd. Planejada</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right whitespace-nowrap">Qtd. Realizada</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right whitespace-nowrap">Diferença</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right whitespace-nowrap">Kg/h</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Restante</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Hora final</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right whitespace-nowrap">% Meta</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right whitespace-nowrap w-[90px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r, idx) => (
                    <TableRow key={r.id ?? idx} className="hover:bg-muted/10">
                      <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                        {formatDate(r.data_dia)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                        {formatHoraRegistro(r)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm whitespace-nowrap font-mono">
                        {r.op ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm whitespace-nowrap font-mono">
                        {r.codigo_item ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm max-w-[180px] truncate" title={r.descricao_item ?? ""}>
                        {r.descricao_item ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                        {lineDisplayName(r.linha)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-right tabular-nums">
                        {formatValue(r.qtd_planejada ?? 0)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-right tabular-nums">
                        {formatValue(r.qtd_realizada ?? 0)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-right tabular-nums">
                        {formatValue(r.diferenca ?? 0)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-right tabular-nums">
                        {r.calculo_1_horas != null ? String(r.calculo_1_horas) : "—"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                        {r.restante_horas ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                        {r.hora_final ? formatTime(r.hora_final) : "—"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-right tabular-nums">
                        {r.percentual_meta != null ? `${Number(r.percentual_meta)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() =>
                            navigate("/analise-producao", {
                              state: {
                                loadData: r.data_dia,
                                loadFilialNome: r.filial_nome ?? "",
                              },
                            })
                          }
                          title="Abrir documento para editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Abrir</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
