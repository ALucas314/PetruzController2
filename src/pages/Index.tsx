import { useState, useEffect, useRef, useCallback } from "react";
import { ClipboardList, CheckCircle2, ArrowRightLeft, Factory, Percent, Target, Loader2 } from "lucide-react";
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
  // Valores "aplicados" do filtro — só atualizam ao clicar em Filtrar
  const [appliedDataInicio, setAppliedDataInicio] = useState<string>(() => {
    try {
      const d = localStorage.getItem(DASHBOARD_SYNC_KEY_DATE);
      if (d) return d;
    } catch {}
    return new Date().toISOString().split("T")[0];
  });
  const [appliedDataFim, setAppliedDataFim] = useState<string>(() => {
    try {
      const d = localStorage.getItem(DASHBOARD_SYNC_KEY_DATE);
      if (d) return d;
    } catch {}
    return new Date().toISOString().split("T")[0];
  });
  const [appliedFilial, setAppliedFilial] = useState<string>(() => {
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
  const [barMaxSize, setBarMaxSize] = useState(96);
  const [pieOuterRadius, setPieOuterRadius] = useState(72);
  const [linhaBarSize, setLinhaBarSize] = useState(20);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setChartBarMargin(w < 640 ? { top: 28, right: 16, left: 4, bottom: 8 } : { top: 28, right: 24, left: 24, bottom: 8 });
      setBarMaxSize(w >= 1024 ? 132 : 96);
      setPieOuterRadius(w >= 1024 ? 88 : 72);
      setLinhaBarSize(w >= 1024 ? 26 : w >= 640 ? 22 : 20);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Função para calcular datas: usa valores aplicados (após clicar em Filtrar)
  const getDateRange = () => {
    if (appliedDataInicio && appliedDataFim) {
      return { dataInicio: appliedDataInicio, dataFim: appliedDataFim };
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

  // Função para carregar dados do dashboard (usa filtros aplicados ao clicar em Filtrar)
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const { dataInicio: di, dataFim: df } = getDateRange();
      const filialNome = appliedFilial || undefined;
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
  }, [appliedFilial, appliedDataInicio, appliedDataFim]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Aplicar filtro ao clicar no botão Filtrar (atualiza valores aplicados; o useEffect recarrega)
  const handleApplyFilter = useCallback(() => {
    setAppliedDataInicio(dataInicio);
    setAppliedDataFim(dataFim);
    setAppliedFilial(filial);
  }, [dataInicio, dataFim, filial]);

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

  // Labels em cima das barras — legíveis e alinhados ao tema
  const CustomBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value == null || value === 0 || !x || !y || !width) return null;
    const str = typeof value === "number" ? value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : String(value);

    return (
      <text
        x={x + width / 2}
        y={y - 10}
        fill="hsl(var(--foreground))"
        fontSize={13}
        fontWeight={700}
        textAnchor="middle"
        style={{ letterSpacing: "0.03em", fontVariantNumeric: "tabular-nums", paintOrder: "stroke fill", stroke: "hsl(var(--card))", strokeWidth: 3, strokeLinejoin: "round" }}
      >
        {str}
      </text>
    );
  };

  // Gráfico Planejado vs Realizado vs Diferença: uma única linha com totais do período filtrado (soma), não uma barra por data
  const chartData = (() => {
    const totalPlanejado = stats ? parseFloat(String(stats.totalPlanejado || "0").replace(",", ".")) : 0;
    const totalRealizado = stats ? parseFloat(String(stats.totalRealizado || "0").replace(",", ".")) : 0;
    const totalDiferenca = stats ? parseFloat(String(stats.diferenca || "0").replace(",", ".")) : 0;
    const label = appliedDataInicio && appliedDataFim
      ? (appliedDataInicio === appliedDataFim
          ? new Date(appliedDataInicio + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
          : `${new Date(appliedDataInicio + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${new Date(appliedDataFim + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`)
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
  const statusPieInfo = (() => {
    const totalPlanejada = stats ? parseFloat(String(stats.totalPlanejado || "0").replace(",", ".")) : 0;
    const totalRealizada = stats ? parseFloat(String(stats.totalRealizado || "0").replace(",", ".")) : 0;
    const perc = totalPlanejada > 0 ? (totalRealizada / totalPlanejada) * 100 : 0;
    const successFill = "url(#dashboard-pie-success)";
    const dangerFill = "url(#dashboard-pie-danger)";
    const excessFill = "url(#dashboard-pie-excess)";
    const mutedColor = "hsl(var(--muted-foreground))";

    let statusData: Array<{ name: string; value: number; color: string; fill: string }>;
    if (totalPlanejada === 0) {
      statusData = [{ name: "Sem meta definida", value: 100, color: mutedColor, fill: mutedColor }];
    } else if (perc > 100) {
      statusData = [
        { name: "Até a meta (100% do planejado)", value: 100, color: "hsl(var(--success))", fill: successFill },
        {
          name: `${perc.toFixed(2).replace(".", ",")}% do planejado`,
          value: perc - 100,
          color: "hsl(var(--primary))",
          fill: excessFill,
        },
      ];
    } else if (perc >= 100) {
      statusData = [{ name: "Meta atingida (100%)", value: 100, color: "hsl(var(--success))", fill: successFill }];
    } else {
      statusData = [
        { name: `Realizado (${perc.toFixed(1).replace(".", ",")}%)`, value: perc, color: "hsl(var(--success))", fill: successFill },
        { name: `Faltando (${(100 - perc).toFixed(1).replace(".", ",")}%)`, value: 100 - perc, color: "hsl(var(--destructive))", fill: dangerFill },
      ];
    }
    const totalPie = statusData.reduce((s, x) => s + x.value, 0);
    return { statusData, perc, totalPlanejada, totalPie };
  })();
  const { statusData, perc: percStatusPie, totalPlanejada: totalPlanejadaStatus, totalPie: totalPieStatus } = statusPieInfo;

  return (
    <AppLayout>
      {/* Header: título em cima, filtros em baixo — menos margem superior no mobile/tablet */}
      <div className="mb-6 sm:mb-8 space-y-5 -mt-2 sm:-mt-1 lg:mt-0">
        <div className="space-y-1 text-center sm:text-left">
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
            onFilter={handleApplyFilter}
            loading={loading}
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
              icon={ClipboardList}
            />
            <KpiCard
              title="Total Realizado"
              value={stats ? formatValue(stats.totalRealizado) : "0"}
              icon={CheckCircle2}
            />
            <KpiCard
              title="Diferença"
              value={stats ? formatValue(stats.diferenca) : "0"}
              icon={ArrowRightLeft}
            />
            <KpiCard
              title="Percentual Meta"
              value={stats ? `${parseFloat(String(stats.percentualMeta).replace(",", ".")).toFixed(2).replace(".", ",")}%` : "0,00%"}
              icon={Percent}
            />
          </div>

          {/* Seção: Análise Gráfica — otimizada para desktop */}
          <div className="space-y-6 lg:space-y-8">
            {/* Gráfico único: Planejado vs Realizado vs Diferença por período */}
            <div ref={chartPlanejadoRealizadoRef} className="chart-card pl-3 pr-4 py-5 sm:p-6 lg:p-8 overflow-hidden">
              <div className="mb-5 lg:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 via-primary/15 to-primary/10 border border-primary/25 shadow-lg shadow-primary/10">
                    <Target className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-card-foreground">Planejado vs Realizado vs Diferença</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground/90 mt-0.5">Soma do total planejado, realizado e diferença no período filtrado</p>
                  </div>
                </div>
                <ExportToPng targetRef={chartPlanejadoRealizadoRef} filenamePrefix="dashboard-planejado-realizado-diferenca" expandScrollable={false} className="shrink-0" />
              </div>
              <div className="dashboard-bar-chart dashboard-bar-chart-wrap h-[300px] sm:h-[340px] lg:h-[420px] w-full rounded-2xl p-4 sm:p-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={chartBarMargin}
                    barCategoryGap="16%"
                    barGap={12}
                  >
                    <defs>
                      <linearGradient id="dashboard-primary-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(217 71% 65%)" stopOpacity={1} />
                        <stop offset="45%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(217 71% 32%)" stopOpacity={0.95} />
                      </linearGradient>
                      <linearGradient id="dashboard-success-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(160 84% 52%)" stopOpacity={1} />
                        <stop offset="45%" stopColor="hsl(var(--success))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(160 84% 28%)" stopOpacity={0.95} />
                      </linearGradient>
                      <linearGradient id="dashboard-warning-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(38 92% 62%)" stopOpacity={1} />
                        <stop offset="45%" stopColor="hsl(var(--warning))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(38 92% 38%)" stopOpacity={0.95} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" vertical={false} horizontal={true} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
                      dy={6}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={false}
                      width={40}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--primary) / 0.06)", radius: 10 }}
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
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700, marginBottom: 8, fontSize: 14 }}
                      formatter={(value: number) => [value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }), ""]}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 18 }}
                      align="center"
                      layout="horizontal"
                      iconType="circle"
                      iconSize={10}
                      formatter={(value) => <span style={{ color: "hsl(var(--foreground) / 0.9)", fontWeight: 600, marginLeft: 6, letterSpacing: "0.02em" }}>{value}</span>}
                    />
                    <Bar dataKey="planejado" fill="url(#dashboard-primary-bar)" radius={[10, 10, 0, 0]} name="Planejado" maxBarSize={barMaxSize} isAnimationActive animationDuration={700} animationEasing="ease-out">
                      <LabelList content={(props: any) => <CustomBarLabel {...props} dataKey="planejado" />} position="top" />
                    </Bar>
                    <Bar dataKey="realizado" fill="url(#dashboard-success-bar)" radius={[10, 10, 0, 0]} name="Realizado" maxBarSize={barMaxSize} isAnimationActive animationDuration={700} animationEasing="ease-out">
                      <LabelList content={(props: any) => <CustomBarLabel {...props} dataKey="realizado" />} position="top" />
                    </Bar>
                    <Bar dataKey="diferenca" fill="url(#dashboard-warning-bar)" radius={[10, 10, 0, 0]} name="Diferença (Planejado − Realizado)" maxBarSize={barMaxSize} isAnimationActive animationDuration={700} animationEasing="ease-out">
                      <LabelList content={(props: any) => <CustomBarLabel {...props} dataKey="diferenca" />} position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status de Produção e Produção por Linha — lado a lado no PC */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Gráfico: Status de Produção — mesmo percentual do quadro Percentual Meta */}
            <div ref={chartStatusProducaoRef} className="chart-card p-5 sm:p-6 lg:p-8 overflow-hidden">
                <div className="mb-4 lg:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-12 w-12 lg:h-14 lg:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-success/25 via-success/15 to-success/10 border border-success/25 shadow-lg shadow-success/10">
                      <Factory className="h-6 w-6 lg:h-7 lg:w-7 text-success" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold tracking-tight text-card-foreground">Status de Produção</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground/90">Mesmo percentual do quadro “Percentual Meta”. Acima de 100% aparece fatia de excedente.</p>
                    </div>
                  </div>
                  <ExportToPng targetRef={chartStatusProducaoRef} filenamePrefix="dashboard-status-producao" expandScrollable={false} className="shrink-0" />
                </div>
                <div className="dashboard-pie-chart dashboard-pie-chart-wrap h-[240px] sm:h-[260px] lg:h-[300px] w-full flex items-center justify-center p-4 sm:p-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <radialGradient id="dashboard-pie-success" cx="0.35" cy="0.35" r="0.65">
                          <stop offset="0%" stopColor="hsl(160 84% 52%)" stopOpacity={1} />
                          <stop offset="70%" stopColor="hsl(var(--success))" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(160 84% 28%)" stopOpacity={0.95} />
                        </radialGradient>
                        <radialGradient id="dashboard-pie-danger" cx="0.35" cy="0.35" r="0.65">
                          <stop offset="0%" stopColor="hsl(0 72% 58%)" stopOpacity={1} />
                          <stop offset="70%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(0 62% 28%)" stopOpacity={0.95} />
                        </radialGradient>
                        <radialGradient id="dashboard-pie-excess" cx="0.35" cy="0.35" r="0.65">
                          <stop offset="0%" stopColor="hsl(217 91% 72%)" stopOpacity={1} />
                          <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(217 71% 32%)" stopOpacity={0.95} />
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
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div
                              className="rounded-xl border border-border/80 bg-card/98 px-4 py-3 shadow-lg text-sm font-medium"
                              style={{
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                                boxShadow: "0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
                              }}
                            >
                              {totalPlanejadaStatus > 0 && (
                                <p className="font-bold text-foreground mb-2 border-b border-border/60 pb-2">
                                  % Meta (realizado ÷ planejado): {percStatusPie.toFixed(2).replace(".", ",")}%
                                </p>
                              )}
                              {payload.map((item: { name?: string; value?: number; color?: string }, idx: number) => (
                                <p key={idx} className="text-muted-foreground mt-1 first:mt-0">
                                  <span style={{ color: item.color ?? "inherit" }}>{item.name}</span>
                                  {totalPieStatus > 0 && item.value != null && (
                                    <span className="tabular-nums">
                                      {" "}
                                      — {((Number(item.value) / totalPieStatus) * 100).toFixed(1).replace(".", ",")}% do gráfico
                                    </span>
                                  )}
                                </p>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: 18 }}
                        align="center"
                        iconType="circle"
                        iconSize={10}
                        formatter={(value) => <span style={{ color: "hsl(var(--foreground) / 0.9)", fontWeight: 600, marginLeft: 6, letterSpacing: "0.02em" }}>{value}</span>}
                      />
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
                  <div className="rounded-xl border border-border/80 bg-card/98 backdrop-blur-xl px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] text-xs font-medium">
                    <p className="font-bold text-foreground mb-2 border-b border-border/60 pb-2 text-sm">{label}</p>
                    <p className="tabular-nums"><span className="text-primary font-semibold">Realizado:</span> {formatChartNumber(realizado)}</p>
                    <p className="tabular-nums"><span className="text-muted-foreground font-medium">Meta:</span> {formatChartNumber(meta)}</p>
                    <p className="mt-1.5 text-muted-foreground">% da meta: <span className="font-bold text-foreground">{pct}%</span></p>
                  </div>
                );
              };
              const linhaBarHeight = linhaBarSize * 2 + 28;
              const chartHeight = Math.min(560, Math.max(200, sorted.length * linhaBarHeight));
              return (
                <div ref={chartProducaoLinhaRef} className="chart-card p-5 sm:p-6 lg:p-8 overflow-hidden">
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
                    <ExportToPng targetRef={chartProducaoLinhaRef} filenamePrefix="dashboard-producao-linha" expandScrollable={false} className="shrink-0 w-full sm:w-auto min-h-[44px] sm:min-h-0" />
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
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <BarChart layout="vertical" data={sorted} margin={{ top: 8, right: 56, left: 4, bottom: 8 }} barCategoryGap={24} barGap={14}>
                        <defs>
                          <linearGradient id="dashboard-linha-primary" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="hsl(217 71% 32%)" stopOpacity={0.95} />
                            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                            <stop offset="100%" stopColor="hsl(217 71% 65%)" stopOpacity={1} />
                          </linearGradient>
                          <linearGradient id="dashboard-linha-meta" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.55} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" strokeOpacity={0.2} horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={false} />
                        <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                        <Tooltip content={<TooltipProducaoLinha />} cursor={{ fill: "hsl(var(--primary) / 0.06)", radius: 6 }} />
                        <Bar dataKey="valor" fill="url(#dashboard-linha-primary)" radius={[0, 8, 8, 0]} name="Realizado" barSize={linhaBarSize} isAnimationActive animationDuration={600} animationEasing="ease-out">
                          <LabelList dataKey="valor" position="right" formatter={(v: number) => formatChartNumber(v)} style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }} />
                        </Bar>
                        <Bar dataKey="meta" fill="url(#dashboard-linha-meta)" radius={[0, 8, 8, 0]} name="Meta" barSize={linhaBarSize} isAnimationActive animationDuration={600} animationEasing="ease-out">
                          <LabelList dataKey="meta" position="right" formatter={(v: number) => formatChartNumber(v)} style={{ fontSize: 12, fontWeight: 500, fill: "hsl(var(--muted-foreground))" }} />
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
