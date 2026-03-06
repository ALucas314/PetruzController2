import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from "recharts";
import { TrendingUp, TrendingDown, Target, Zap, Download } from "lucide-react";
import { useRef, RefObject } from "react";
import html2canvas from "html2canvas";

// Dados padrão (fallback)
const defaultRevenueData = [
  { month: "Sem dados", receita: 0, despesas: 0 },
];

const defaultProductionData = [
  { name: "Sem dados", valor: 0, meta: 0 },
];

const statusData = [
  { name: "Concluído", value: 45, color: "#10b981" },
  { name: "Em andamento", value: 30, color: "#3b82f6" },
  { name: "Pendente", value: 15, color: "#f59e0b" },
  { name: "Atrasado", value: 10, color: "#ef4444" },
];

// Função para calcular estatísticas
const calculateRevenueStats = (data: any[]) => {
  if (!data || data.length === 0) return { totalReceita: 0, totalDespesas: 0, lucro: 0, lucroPercentual: 0, crescimentoReceita: 0 };
  const totalReceita = data.reduce((sum, item) => sum + (item.receita || 0), 0);
  const totalDespesas = data.reduce((sum, item) => sum + (item.despesas || 0), 0);
  const lucro = totalReceita - totalDespesas;
  const lucroPercentual = totalReceita > 0 ? ((lucro / totalReceita) * 100) : 0;
  const crescimentoReceita = data.length > 1 && data[0].receita > 0 
    ? (((data[data.length - 1].receita - data[0].receita) / data[0].receita) * 100) 
    : 0;
  return { totalReceita, totalDespesas, lucro, lucroPercentual, crescimentoReceita };
};

// Componente customizado para tooltip profissional
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-xl p-3 min-w-[160px]">
        <p className="text-xs font-semibold text-card-foreground mb-2.5 pb-2 border-b border-border">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground capitalize font-medium">
                  {entry.name === "receita" ? "Planejado" : entry.name === "despesas" ? "Realizado" : entry.name}
                </span>
              </div>
              <span className="text-xs font-bold text-card-foreground">
                {entry.name === "receita" || entry.name === "despesas"
                  ? `R$ ${entry.value.toLocaleString("pt-BR")}`
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Componente customizado para tooltip do pie chart
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-card border border-border rounded-lg shadow-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-2.5 h-2.5 rounded-full shadow-sm"
            style={{ backgroundColor: data.payload.color }}
          />
          <p className="text-xs font-semibold text-card-foreground">{data.name}</p>
        </div>
        <p className="text-sm font-bold text-card-foreground">{data.value}%</p>
        <p className="text-xs text-muted-foreground mt-0.5">do total</p>
      </div>
    );
  }
  return null;
};

// Componente customizado para renderizar labels nos pontos do gráfico
const CustomLabel = (props: any) => {
  const { x, y, value, dataKey } = props;
  if (!value || !x || !y) return null;
  return (
    <text
      x={x}
      y={y - 8}
      fill="hsl(var(--muted-foreground))"
      fontSize={10}
      fontWeight={600}
      textAnchor="middle"
      className="drop-shadow-sm"
    >
      {dataKey === "receita" || dataKey === "despesas"
        ? `R$ ${(value / 1000).toFixed(0)}k`
        : value}
    </text>
  );
};

// Função utilitária para exportar gráfico como PNG
const exportChartAsPNG = async (chartRef: RefObject<HTMLDivElement>, filename: string) => {
  if (!chartRef.current) return;

  try {
    // Pequeno delay para garantir que tudo esteja renderizado
    await new Promise(resolve => setTimeout(resolve, 100));

    const element = chartRef.current;
    const rect = element.getBoundingClientRect();

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 3, // Aumentar scale para melhor qualidade
      logging: false,
      useCORS: true,
      allowTaint: false,
      foreignObjectRendering: true,
      width: rect.width,
      height: rect.height,
      windowWidth: rect.width,
      windowHeight: rect.height,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
    });

    // Criar um canvas maior para centralizar o conteúdo
    const padding = 40; // Padding ao redor do conteúdo
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvas.width + (padding * 10);
    finalCanvas.height = canvas.height + (padding * 10);
    const ctx = finalCanvas.getContext('2d');

    if (ctx) {
      // Preencher o fundo com branco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // Desenhar o conteúdo capturado centralizado
      ctx.drawImage(canvas, padding, padding);
    }

    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = finalCanvas.toDataURL("image/png", 1.0); // Qualidade máxima
    link.click();
  } catch (error) {
    console.error("Erro ao exportar gráfico:", error);
  }
};

interface RevenueChartProps {
  data?: Array<{ month: string; receita: number; despesas: number }>;
}

export function RevenueChart({ data = defaultRevenueData }: RevenueChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const stats = calculateRevenueStats(data);
  const chartData = data.length > 0 ? data : defaultRevenueData;

  const handleExport = () => {
    exportChartAsPNG(chartRef, "analise-financeira");
  };

  return (
    <div ref={chartRef} className="chart-card animate-fade-in group relative">
      {/* Overlay com botão de exportação */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10 rounded-lg">
        <div className="absolute top-4 right-4 pointer-events-auto">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium text-card-foreground"
            title="Exportar como PNG"
          >
            <Download className="h-4 w-4" />
            <span>Exportar PNG</span>
          </button>
        </div>
      </div>

      {/* Header com métricas */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-card-foreground">Planejado vs Realizado</h3>
          {stats.crescimentoReceita !== 0 && (
            <div className={`flex items-center gap-1 text-xs font-medium ${stats.crescimentoReceita >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stats.crescimentoReceita >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span>{stats.crescimentoReceita >= 0 ? '+' : ''}{stats.crescimentoReceita.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wide mb-1.5">Total Planejado</p>
            <p className="text-sm font-bold text-foreground">{stats.totalReceita >= 1000 ? `R$ ${(stats.totalReceita / 1000).toFixed(0)}k` : stats.totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wide mb-1.5">Total Realizado</p>
            <p className="text-sm font-bold text-foreground">{stats.totalDespesas >= 1000 ? `R$ ${(stats.totalDespesas / 1000).toFixed(0)}k` : stats.totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm"></div>
          <span className="text-muted-foreground font-medium">Planejado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-sm"></div>
          <span className="text-muted-foreground font-medium">Realizado</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 15, right: 15, left: 5, bottom: 10 }}>
          <defs>
            <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.5} />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.15}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
            stroke="transparent"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
            stroke="transparent"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
            tickMargin={8}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="despesas"
            stroke="#06b6d4"
            strokeWidth={2.5}
            fill="url(#colorDespesas)"
            animationDuration={1200}
            dot={{ fill: "#06b6d4", r: 4, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "#06b6d4", fill: "#fff" }}
          >
            <LabelList content={(props: any) => <CustomLabel {...props} dataKey="despesas" />} />
          </Area>
          <Area
            type="monotone"
            dataKey="receita"
            stroke="#3b82f6"
            strokeWidth={3}
            fill="url(#colorReceita)"
            animationDuration={1200}
            dot={{ fill: "#3b82f6", r: 5, strokeWidth: 2.5, stroke: "#fff" }}
            activeDot={{ r: 7, strokeWidth: 2.5, stroke: "#3b82f6", fill: "#fff" }}
            style={{ filter: "url(#glow)" }}
          >
            <LabelList content={(props: any) => <CustomLabel {...props} dataKey="receita" />} />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ProductionChartProps {
  data?: Array<{ name: string; valor: number; meta: number }>;
}

export function ProductionChart({ data = defaultProductionData }: ProductionChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartData = data.length > 0 ? data : defaultProductionData;
  const totalProducao = chartData.reduce((sum, item) => sum + (item.valor || 0), 0);
  const totalMeta = chartData.reduce((sum, item) => sum + (item.meta || 0), 0);
  const percentualMeta = totalMeta > 0 ? ((totalProducao / totalMeta) * 100).toFixed(1) : "0.0";

  const handleExport = () => {
    exportChartAsPNG(chartRef, "desempenho-producao");
  };

  return (
    <div ref={chartRef} className="chart-card animate-fade-in group relative">
      {/* Overlay com botão de exportação */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10 rounded-lg">
        <div className="absolute top-4 right-4 pointer-events-auto">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium text-card-foreground"
            title="Exportar como PNG"
          >
            <Download className="h-4 w-4" />
            <span>Exportar PNG</span>
          </button>
        </div>
      </div>

      {/* Header com métricas */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-card-foreground">Desempenho de Produção</h3>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span>Meta: {percentualMeta}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Total Produzido</p>
            <p className="text-sm font-bold text-foreground">{totalProducao.toLocaleString("pt-BR")} unidades</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Meta Total</p>
            <p className="text-sm font-bold text-foreground">{totalMeta.toLocaleString("pt-BR")} unidades</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 15, right: 15, left: 5, bottom: 10 }}>
          <defs>
            <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
              <stop offset="50%" stopColor="#2563eb" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#64748b" stopOpacity={0.2} />
            </linearGradient>
            <pattern id="stripes" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#64748b" opacity="0.1" />
              <path d="M0,0 L8,8" stroke="#64748b" strokeWidth="0.5" opacity="0.2" />
            </pattern>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.15}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
            stroke="transparent"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
            stroke="transparent"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="meta"
            fill="url(#colorMeta)"
            radius={[8, 8, 0, 0]}
            opacity={0.4}
            animationDuration={800}
          />
          <Bar
            dataKey="valor"
            fill="url(#colorBar)"
            radius={[8, 8, 0, 0]}
            animationDuration={1200}
          >
            {chartData.map((entry, index) => {
              const percentual = entry.meta > 0 ? ((entry.valor / entry.meta) * 100).toFixed(0) : "0";
              const isAboveMeta = entry.meta > 0 && entry.valor >= entry.meta;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={isAboveMeta ? "#10b981" : "url(#colorBar)"}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Indicadores de performance por linha */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        {chartData.map((item, index) => {
          const percentual = item.meta > 0 ? ((item.valor / item.meta) * 100).toFixed(0) : "0";
          const isAboveMeta = item.meta > 0 && item.valor >= item.meta;
          return (
            <div
              key={index}
              className={`p-2 rounded-lg border text-center transition-all ${isAboveMeta
                ? "bg-success/10 border-success/30"
                : "bg-muted/20 border-border/50"
                }`}
            >
              <p className="text-xs font-semibold text-foreground mb-1">{item.name}</p>
              <div className="flex items-center justify-center gap-1">
                {isAboveMeta ? (
                  <Target className="h-3 w-3 text-success" />
                ) : (
                  <Zap className="h-3 w-3 text-warning" />
                )}
                <p className={`text-xs font-bold ${isAboveMeta ? "text-success" : "text-warning"}`}>
                  {percentual}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatusPieChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const total = statusData.reduce((sum, item) => sum + item.value, 100);
  const maiorStatus = statusData.reduce((max, item) => item.value > max.value ? item : max, statusData[0]);

  // Calcular valores absolutos (simulando pedidos)
  const totalPedidos = 1248;
  const statusComValores = statusData.map(item => ({
    ...item,
    quantidade: Math.round((item.value / 100) * totalPedidos)
  }));

  const handleExport = () => {
    exportChartAsPNG(chartRef, "status-pedidos");
  };

  return (
    <div ref={chartRef} className="chart-card animate-fade-in group relative">
      {/* Overlay com botão de exportação */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10 rounded-lg">
        <div className="absolute top-4 right-4 pointer-events-auto">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium text-card-foreground"
            title="Exportar como PNG"
          >
            <Download className="h-4 w-4" />
            <span>Exportar PNG</span>
          </button>
        </div>
      </div>

      {/* Header com métricas principais */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-card-foreground mb-1">Status dos Pedidos</h3>
            <p className="text-xs text-muted-foreground">Distribuição atual do portfólio</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{totalPedidos.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Total de pedidos</p>
          </div>
        </div>

        {/* Card do status principal */}
        <div
          className="p-4 rounded-xl border-2 shadow-sm"
          style={{
            backgroundColor: `${maiorStatus.color}15`,
            borderColor: `${maiorStatus.color}40`
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
                style={{ backgroundColor: maiorStatus.color }}
              >
                <span className="text-white font-bold text-sm">{maiorStatus.value}%</span>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Status Principal</p>
                <p className="text-sm font-bold text-foreground">{maiorStatus.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">
                {statusComValores.find(s => s.name === maiorStatus.name)?.quantidade.toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-muted-foreground">pedidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico Donut Chart */}
      <div className="relative mb-6">
        <ResponsiveContainer width="100%" height={340}>
          <PieChart>
            <defs>
              {statusData.map((entry, index) => (
                <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop offset="50%" stopColor={entry.color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.75} />
                </linearGradient>
              ))}
              <filter id="shadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" />
              </filter>
            </defs>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={95}
              outerRadius={135}
              paddingAngle={6}
              dataKey="value"
              animationDuration={1500}
              animationBegin={0}
              startAngle={90}
              endAngle={-270}
            >
              {statusData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#gradient-${index})`}
                  stroke="hsl(var(--background))"
                  strokeWidth={5}
                  style={{
                    filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.15))',
                    transition: 'all 0.3s ease',
                  }}
                  className="hover:opacity-90 cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centro do donut com informação melhorada */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="mb-2">
              <p className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5">{total}%</p>
              <p className="text-xs text-muted-foreground font-medium">Cobertura Total</p>
            </div>
            <div className="h-px w-12 bg-border mx-auto mb-2"></div>
            <p className="text-xs text-muted-foreground">{totalPedidos.toLocaleString("pt-BR")} pedidos</p>
          </div>
        </div>
      </div>

      {/* Legenda detalhada e elegante */}
      <div className="space-y-3">
        {statusComValores.map((item, index) => {
          const percentual = item.value;
          const isActive = item.name === maiorStatus.name;

          return (
            <div
              key={index}
              className={`group relative p-4 rounded-xl border transition-all duration-300 ${isActive
                ? 'bg-primary/5 border-primary/30 shadow-sm'
                : 'bg-muted/20 border-border/50 hover:bg-muted/40 hover:border-border'
                }`}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Lado esquerdo - Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="relative">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${item.color}20` }}
                    >
                      <div
                        className="w-6 h-6 rounded-lg"
                        style={{ backgroundColor: item.color }}
                      />
                    </div>
                    {isActive && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm font-bold text-foreground">{item.name}</p>
                      {isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                          Principal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.quantidade.toLocaleString("pt-BR")} pedidos
                      </p>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[120px]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentual}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lado direito - Percentual */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground mb-0.5">{item.value}%</p>
                  <p className="text-xs text-muted-foreground">do total</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
