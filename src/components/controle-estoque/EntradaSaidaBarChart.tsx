import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumberPtBrFixed } from "@/lib/formatLocale";

type Row = { name: string; valor: number; fill: string };

export function EntradaSaidaBarChart({ totalEntrada, totalSaida }: { totalEntrada: number; totalSaida: number }) {
  const data = useMemo((): Row[] => {
    return [
      { name: "Entrada", valor: totalEntrada, fill: "url(#occe-bar-success)" },
      { name: "Saída", valor: totalSaida, fill: "url(#occe-bar-danger)" },
    ];
  }, [totalEntrada, totalSaida]);

  const yMax = Math.max(totalEntrada, totalSaida, 0) * 1.12 || 1;

  return (
    <div className="dashboard-bar-chart dashboard-bar-chart-wrap h-[260px] sm:h-[280px] lg:h-[300px] w-full min-w-0 flex flex-col">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 28, right: 8, left: 4, bottom: 8 }}
          barCategoryGap="28%"
        >
          <defs>
            <linearGradient id="occe-bar-success" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(160 84% 52%)" stopOpacity={1} />
              <stop offset="45%" stopColor="hsl(var(--success))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(160 84% 28%)" stopOpacity={0.95} />
            </linearGradient>
            <linearGradient id="occe-bar-danger" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(0 72% 58%)" stopOpacity={1} />
              <stop offset="45%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(0 62% 28%)" stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.2} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            width={44}
            domain={[0, yMax]}
            tickFormatter={(v) => formatNumberPtBrFixed(v, 0)}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--primary) / 0.06)", radius: 8 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as Row;
              return (
                <div
                  className="rounded-xl border border-border/80 bg-card/98 px-3 py-2.5 shadow-lg text-sm"
                  style={{
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                >
                  <p className="font-semibold text-foreground">{row.name}</p>
                  <p className="tabular-nums text-muted-foreground mt-0.5">
                    {formatNumberPtBrFixed(row.valor, 2)}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="valor" radius={[10, 10, 4, 4]} maxBarSize={72}>
            <LabelList
              dataKey="valor"
              position="top"
              formatter={(v: number | string) => formatNumberPtBrFixed(Number(v), 2)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                fill: "hsl(var(--foreground))",
              }}
            />
            {data.map((entry, i) => (
              <Cell key={entry.name + i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
