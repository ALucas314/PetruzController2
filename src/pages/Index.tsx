import { useState, useEffect, useRef } from "react";
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

const Index = () => {
  // Filtros de data do dashboard: começam com a data de hoje, mas o usuário pode alterar
  const [dataInicio, setDataInicio] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [dataFim, setDataFim] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [filial, setFilial] = useState<string>(""); // Nome completo da filial
  const [filiais, setFiliais] = useState<Array<{ id: number; codigo: string; nome: string }>>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [productionData, setProductionData] = useState<any[]>([]);
  const chartPlanejadoRealizadoRef = useRef<HTMLDivElement>(null);
  const chartStatusProducaoRef = useRef<HTMLDivElement>(null);
  const chartProducaoLinhaRef = useRef<HTMLDivElement>(null);

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

  // Carregar dados do dashboard (Supabase direto)
  useEffect(() => {
    const run = async () => {
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
    };
    run();
  }, [filial, dataInicio, dataFim]);

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

  // Preparar dados para os gráficos
  const chartData = revenueData.map((item) => ({
    name: item.month,
    planejado: item.receita,
    realizado: item.despesas,
    diferenca: item.receita - item.despesas,
  }));

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

          {/* Seção: Análise Gráfica */}
          <div className="space-y-6">
            {/* Gráfico único: Planejado vs Realizado vs Diferença por período */}
            <div ref={chartPlanejadoRealizadoRef} className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-4 sm:p-5 lg:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
              <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-card-foreground">Planejado vs Realizado vs Diferença</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground/70">Comparação por período — use o intervalo de datas acima para filtrar</p>
                  </div>
                </div>
                <ExportToPng targetRef={chartPlanejadoRealizadoRef} filenamePrefix="dashboard-planejado-realizado-diferenca" expandScrollable={false} className="shrink-0" />
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 24, right: 20, left: 0, bottom: 5 }}
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
                    allowDataOverflow
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      padding: "8px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                    formatter={(value: number) => [value.toLocaleString("pt-BR"), ""]}
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
                  <Bar dataKey="diferenca" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} name="Diferença (Planejado − Realizado)">
                    <LabelList
                      content={(props: any) => <CustomBarLabel {...props} dataKey="diferenca" />}
                      position="top"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico: Status de Produção — mesmo percentual do quadro Percentual Meta */}
            <div ref={chartStatusProducaoRef} className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-4 sm:p-5 lg:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 border border-success/20">
                      <Factory className="h-5 w-5 text-success" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-card-foreground">Status de Produção</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">Mesmo percentual do quadro “Percentual Meta” (total realizado ÷ total planejado)</p>
                    </div>
                  </div>
                  <ExportToPng targetRef={chartStatusProducaoRef} filenamePrefix="dashboard-status-producao" expandScrollable={false} className="shrink-0" />
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
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
                  </PieChart>
                </ResponsiveContainer>
            </div>

            {/* Gráfico: Produção por Linha */}
            {productionData.length > 0 && (
              <div ref={chartProducaoLinhaRef} className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                      <Factory className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-card-foreground">Produção por Linha</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">Valor realizado vs meta por linha</p>
                    </div>
                  </div>
                  <ExportToPng targetRef={chartProducaoLinhaRef} filenamePrefix="dashboard-producao-linha" expandScrollable={false} className="shrink-0" />
                </div>
                {/* No mobile: scroll horizontal para os nomes das linhas não ficarem comprimidos */}
                <div className="overflow-x-auto -mx-1 px-1 sm:overflow-visible sm:mx-0 sm:px-0" style={{ minHeight: 320 }}>
                  <div className="min-w-[280px]" style={{ minWidth: Math.max(280, productionData.length * 72) }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={productionData}
                        margin={{ top: 20, right: 20, left: 0, bottom: 56 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
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
                    <Legend verticalAlign="top" height={36} />
                    <Bar
                      dataKey="valor"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name="Realizado"
                    >
                      <LabelList
                        content={(props: any) => <CustomBarLabel {...props} dataKey="valor" />}
                        position="top"
                      />
                    </Bar>
                    <Bar
                      dataKey="meta"
                      fill="hsl(var(--muted-foreground))"
                      radius={[4, 4, 0, 0]}
                      name="Meta"
                      opacity={0.5}
                    >
                      <LabelList
                        content={(props: any) => <CustomBarLabel {...props} dataKey="meta" />}
                        position="top"
                      />
                    </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

    </AppLayout>
  );
};

export default Index;
