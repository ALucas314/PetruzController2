import { useState, useEffect, useRef, useCallback } from "react";
import { DollarSign, ShoppingCart, Factory, Target, Minus, Loader2 } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { AppLayout } from "@/components/AppLayout";
import { ExportToPng } from "@/components/ExportToPng";
import { getFiliais, getDashboardStats, getProductionChart, getProductionLines } from "@/services/supabaseData";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from "recharts";

interface DashboardStats {
  totalPlanejado: string;
  totalRealizado: string;
  diferenca: string;
  percentualMeta: string;
  variacaoPercentual: number;
  registros: number;
}

const DASHBOARD_SYNC_KEY_DATE = "dashboard_producao_data_dia";
const DASHBOARD_SYNC_KEY_FILIAL = "dashboard_producao_filial_nome";

const Index = () => {
  // Filtros: iniciam com a mesma data/filial do módulo Produção (localStorage) para acompanhar o diário
  const [dataInicio, setDataInicio] = useState<string>(() => {
    try {
      const d = localStorage.getItem(DASHBOARD_SYNC_KEY_DATE);
      if (d) return d;
    } catch {}
    return new Date().toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState<string>(() => {
    try {
      const d = localStorage.getItem(DASHBOARD_SYNC_KEY_DATE);
      if (d) return d;
    } catch {}
    return new Date().toISOString().split("T")[0];
  });
  const [filial, setFilial] = useState<string>(() => {
    try {
      const f = localStorage.getItem(DASHBOARD_SYNC_KEY_FILIAL);
      if (f) return f;
    } catch {}
    return "";
  });
  const [filiais, setFiliais] = useState<Array<{ id: number; codigo: string; nome: string }>>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [productionData, setProductionData] = useState<any[]>([]);
  const chartPlanejadoRealizadoRef = useRef<HTMLDivElement>(null);
  const chartStatusProducaoRef = useRef<HTMLDivElement>(null);
  const chartProducaoLinhaRef = useRef<HTMLDivElement>(null);

  const [chartBarMargin, setChartBarMargin] = useState({ top: 28, right: 24, left: 24, bottom: 8 });
  useEffect(() => {
    const update = () => setChartBarMargin(
      window.innerWidth < 640 ? { top: 28, right: 16, left: 4, bottom: 8 } : { top: 28, right: 24, left: 24, bottom: 8 }
    );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Função para calcular datas: usa intervalo (dataInicio/dataFim) se ambos preenchidos; senão últimos 30 dias
  const getDateRange = () => {
    if (dataInicio && dataFim) {
      return { dataInicio, dataFim };
    }
    const hoje = new Date();
    const dataFimDefault = hoje.toISOString().split("T")[0];
    const dataInicioDate = new Date(hoje);
    dataInicioDate.setDate(dataInicioDate.getDate() - 30);
    return {
      dataInicio: dataInicioDate.toISOString().split("T")[0],
      dataFim: dataFimDefault,
    };
  };

  // Carregar filiais (Supabase direto)
  useEffect(() => {
    getFiliais()
      .then((data) => {
        setFiliais(data.map((f) => ({ id: f.id as number, codigo: String(f.codigo ?? ""), nome: String(f.nome ?? "") })));
        if (data.length > 0) setFilial((prev) => prev || String(data[0].nome));
      })
      .catch((err) => console.error("Erro ao carregar filiais:", err));
  }, []);

  // Função para carregar dados do dashboard (mesma fonte OCPD da produção diária)
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const { dataInicio: di, dataFim: df } = getDateRange();
      const filialNome = filial || undefined;
      const [statsResult, chartResult, linesResult] = await Promise.all([
        getDashboardStats({ dataInicio: di, dataFim: df, filialNome }),
        getProductionChart({ dataInicio: di, dataFim: df, filialNome }),
        getProductionLines({ dataInicio: di, dataFim: df, filialNome }),
      ]);
      setStats(statsResult);
      setRevenueData(chartResult);
      setProductionData(linesResult);
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [filial, dataInicio, dataFim]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Atualizar ao voltar para a aba (ex.: após salvar na Produção) para acompanhar o diário
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadDashboardData();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadDashboardData]);

  // Formatar valores para exibição
  const formatValue = (value: string | number, prefix: string = "") => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0";
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // Gráfico Planejado vs Realizado vs Diferença: uma única linha com totais do período filtrado (soma), não uma barra por data
  const chartData = (() => {
    const totalPlanejado = stats ? parseFloat(String(stats.totalPlanejado || "0").replace(",", ".")) : 0;
    const totalRealizado = stats ? parseFloat(String(stats.totalRealizado || "0").replace(",", ".")) : 0;
    const totalDiferenca = stats ? parseFloat(String(stats.diferenca || "0").replace(",", ".")) : 0;
    const label = dataInicio && dataFim
      ? (dataInicio === dataFim
          ? new Date(dataInicio + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
          : `${new Date(dataInicio + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${new Date(dataFim + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`)
      : "Total";
    return [
      {
        name: label,
        planejado: totalPlanejado,
        realizado: totalRealizado,
        diferenca: totalDiferenca,
      },
    ];
  })();

  // Gráfico de pizza: mesmo critério da Análise de produção — percentual de meta (total realizado ÷ total planejado)
  const statusData = (() => {
    const totalPlanejada = stats ? parseFloat(stats.totalPlanejado || "0") : 0;
    const totalRealizada = stats ? parseFloat(stats.totalRealizado || "0") : 0;
    const perc = totalPlanejada > 0 ? (totalRealizada / totalPlanejada) * 100 : 0;

    if (totalPlanejada === 0) {
      return [{ name: "Sem meta definida", value: 100, color: "#6b7280" }];
    }
    if (perc >= 100) {
      return [{ name: "Meta atingida (≥100%)", value: 100, color: "#10b981" }];
    }
    return [
      { name: `Meta atingida (${perc.toFixed(1).replace(".", ",")}%)`, value: perc, color: "#10b981" },
      { name: `Faltando (${(100 - perc).toFixed(1).replace(".", ",")}%)`, value: 100 - perc, color: "#ef4444" },
    ];
  })();

  return (
    <AppLayout>
      {/* Header: título em cima, filtros em baixo */}
      <div className="mb-6 sm:mb-8 space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Painel de Controle
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-medium">
            Visão geral do desempenho da empresa
          </p>
        </div>
        <div className="w-full min-w-0">
          <DashboardFilters
            dataInicio={dataInicio} setDataInicio={setDataInicio}
            dataFim={dataFim} setDataFim={setDataFim}
            filial={filial} setFilial={setFilial}
            filiais={filiais}
          />
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="mb-6 sm:mb-8 flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="mb-6 sm:mb-8 grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total Planejado"
              value={stats ? formatValue(stats.totalPlanejado) : "0"}
              change={stats?.variacaoPercentual || 0}
              icon={DollarSign}
            />
            <KpiCard
              title="Total Realizado"
              value={stats ? formatValue(stats.totalRealizado) : "0"}
              change={stats?.variacaoPercentual || 0}
              icon={ShoppingCart}
            />
            <KpiCard
              title="Diferença"
              value={stats ? formatValue(stats.diferenca) : "0"}
              change={stats?.variacaoPercentual || 0}
              icon={Minus}
            />
            <KpiCard
              title="Percentual Meta"
              value={stats ? `${parseFloat(String(stats.percentualMeta).replace(",", ".")).toFixed(2).replace(".", ",")}%` : "0,00%"}
              change={stats?.variacaoPercentual || 0}
              icon={Target}
            />
          </div>

          {/* Seção: Análise Gráfica — otimizada para desktop */}
          <div className="space-y-6 lg:space-y-8">
            {/* Gráfico único: Planejado vs Realizado vs Diferença por período */}
            <div ref={chartPlanejadoRealizadoRef} className="chart-card rounded-2xl border border-border/60 bg-gradient-to-br from-card/95 via-card/90 to-card pl-3 pr-4 py-5 sm:p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08)] lg:shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
              <div className="mb-5 lg:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                    <Target className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold text-card-foreground">Planejado vs Realizado vs Diferença</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground/80 mt-0.5">Soma do total planejado, realizado e diferença no período filtrado</p>
                  </div>
                </div>
                <ExportToPng targetRef={chartPlanejadoRealizadoRef} filenamePrefix="dashboard-planejado-realizado-diferenca" expandScrollable={false} className="shrink-0" />
              </div>
              <div className="h-[300px] sm:h-[340px] lg:h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={chartBarMargin}
                    barCategoryGap="12%"
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDataOverflow
                      tick={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        padding: "12px 16px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                        fontSize: "13px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                      formatter={(value: number) => [value.toLocaleString("pt-BR"), ""]}
                    />
                    <Legend wrapperStyle={{ paddingTop: 8 }} align="center" layout="horizontal" />
                    <Bar dataKey="planejado" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Planejado" maxBarSize={80}>
                      <LabelList
                        content={(props: any) => <CustomBarLabel {...props} dataKey="planejado" />}
                        position="top"
                        style={{ fontSize: 11 }}
                      />
                    </Bar>
                    <Bar dataKey="realizado" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} name="Realizado" maxBarSize={80}>
                      <LabelList
                        content={(props: any) => <CustomBarLabel {...props} dataKey="realizado" />}
                        position="top"
                        style={{ fontSize: 11 }}
                      />
                    </Bar>
                    <Bar dataKey="diferenca" fill="hsl(var(--warning))" radius={[6, 6, 0, 0]} name="Diferença (Planejado − Realizado)" maxBarSize={80}>
                      <LabelList
                        content={(props: any) => <CustomBarLabel {...props} dataKey="diferenca" />}
                        position="top"
                        style={{ fontSize: 11 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status de Produção e Produção por Linha — lado a lado no PC */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Gráfico: Status de Produção — mesmo percentual do quadro Percentual Meta */}
            <div ref={chartStatusProducaoRef} className="chart-card rounded-2xl border border-border/60 bg-gradient-to-br from-card/95 via-card/90 to-card p-5 sm:p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08)] lg:shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
                <div className="mb-4 lg:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-success/10 border border-success/20 shadow-sm">
                      <Factory className="h-5 w-5 lg:h-6 lg:w-6 text-success" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-card-foreground">Status de Produção</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">Mesmo percentual do quadro “Percentual Meta” (total realizado ÷ total planejado)</p>
                    </div>
                  </div>
                  <ExportToPng targetRef={chartStatusProducaoRef} filenamePrefix="dashboard-status-producao" expandScrollable={false} className="shrink-0" />
                </div>
                <div className="h-[240px] sm:h-[260px] lg:h-[300px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={72}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                        className="[&_.recharts-pie-sector]:outline-none"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          padding: "12px 16px",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                          fontSize: "13px",
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                      />
                      <Legend wrapperStyle={{ paddingTop: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
            </div>

            {/* Gráfico: Produção por Linha — intuitivo: realizado vs meta com % da meta no tooltip */}
            {productionData.length > 0 ? (() => {
              const sorted = [...productionData].sort((a: any, b: any) => (b.valor ?? 0) - (a.valor ?? 0));
              const formatChartNumber = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
              const TooltipProducaoLinha = ({ active, payload, label }: any) => {
                if (!active || !payload?.length || !label) return null;
                const row = payload[0]?.payload;
                const realizado = row?.valor ?? 0;
                const meta = row?.meta ?? 0;
                const pct = meta > 0 ? ((realizado / meta) * 100).toFixed(1).replace(".", ",") : "—";
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-md text-xs">
                    <p className="font-semibold text-foreground mb-1.5 border-b border-border pb-1">{label}</p>
                    <p><span className="text-primary font-medium">Realizado:</span> {formatChartNumber(realizado)}</p>
                    <p><span className="text-muted-foreground font-medium">Meta:</span> {formatChartNumber(meta)}</p>
                    <p className="mt-1 text-muted-foreground">% da meta: <span className="font-semibold text-foreground">{pct}%</span></p>
                  </div>
                );
              };
              const chartHeight = Math.min(320, Math.max(200, sorted.length * 28));
              return (
                <div ref={chartProducaoLinhaRef} className="chart-card rounded-2xl border border-border/60 bg-gradient-to-br from-card/95 via-card/90 to-card p-5 sm:p-6 lg:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08)] lg:shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
                  <div className="mb-4 lg:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-sm">
                        <Factory className="h-5 w-5 lg:h-6 lg:w-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg lg:text-xl font-bold text-foreground">Produção por Linha</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Compare realizado (azul) com meta (cinza). Ordenado do maior ao menor realizado.</p>
                      </div>
                    </div>
                    <ExportToPng targetRef={chartProducaoLinhaRef} filenamePrefix="dashboard-producao-linha" expandScrollable={false} className="shrink-0 w-full sm:w-auto min-h-[44px] sm:min-h-0" />
                  </div>
                  <div className="flex flex-wrap gap-3 mb-3">
                    <span className="inline-flex items-center gap-2 text-xs sm:text-sm">
                      <span className="w-3 h-3 rounded-sm bg-primary shadow-sm" aria-hidden />
                      <span className="text-muted-foreground">Realizado (produzido)</span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs sm:text-sm">
                      <span className="w-3 h-3 rounded-sm bg-muted-foreground/50" aria-hidden />
                      <span className="text-muted-foreground">Meta (planejado)</span>
                    </span>
                  </div>
                  <div className="rounded-xl bg-muted/20 lg:bg-muted/30 p-4 lg:p-5 border border-border/40">
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <BarChart layout="vertical" data={sorted} margin={{ top: 8, right: 56, left: 4, bottom: 8 }}>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={false} label={false} />
                        <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                        <Tooltip content={<TooltipProducaoLinha />} />
                        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="Realizado" maxBarSize={24} barCategoryGap="40%">
                          <LabelList dataKey="valor" position="right" formatter={(v: number) => formatChartNumber(v)} style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                        </Bar>
                        <Bar dataKey="meta" fill="hsl(var(--muted-foreground))" fillOpacity={0.5} radius={[0, 6, 6, 0]} name="Meta" maxBarSize={24} barCategoryGap="40%">
                          <LabelList dataKey="meta" position="right" formatter={(v: number) => formatChartNumber(v)} style={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })() : null}
            </div>
          </div>
        </>
      )}

    </AppLayout>
  );
};

export default Index;
