import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumberPtBrFixed } from "@/lib/formatLocale";

type Slice = { name: string; value: number; fill: string };

/**
 * Pizza com base na soma das **entradas** (100%):
 * - Verde: saldo (entrada acumulada − saída acumulada), mín. 0
 * - Vermelho: total de saída
 * Com entrada 50 e saída 10 → 80% verde / 20% vermelho (40 + 10 = 50).
 */
export function EntradaSaidaPieChart({ totalEntrada, totalSaida }: { totalEntrada: number; totalSaida: number }) {
  const saldoPos = Math.max(0, totalEntrada - totalSaida);

  const { data, pieSum, hasEntradaBase } = useMemo(() => {
    if (totalEntrada <= 0 && totalSaida <= 0) {
      return { data: [{ name: "Sem dados", value: 1, fill: "hsl(var(--muted) / 0.45)" }] as Slice[], pieSum: 0, hasEntradaBase: false };
    }

    if (totalEntrada <= 0 && totalSaida > 0) {
      return {
        data: [{ name: "Saída (sem entrada no acumulado)", value: totalSaida, fill: "url(#occe-pie-danger)" }] as Slice[],
        pieSum: totalSaida,
        hasEntradaBase: false,
      };
    }

    const slices: Slice[] = [];
    if (saldoPos > 0) {
      slices.push({ name: "Saldo (sobra)", value: saldoPos, fill: "url(#occe-pie-success)" });
    }
    if (totalSaida > 0) {
      slices.push({ name: "Saída", value: totalSaida, fill: "url(#occe-pie-danger)" });
    }
    if (slices.length === 0) {
      return {
        data: [{ name: "Sem dados", value: 1, fill: "hsl(var(--muted) / 0.45)" }] as Slice[],
        pieSum: 0,
        hasEntradaBase: false,
      };
    }

    const sum = slices.reduce((a, s) => a + s.value, 0);
    return { data: slices, pieSum: sum, hasEntradaBase: true };
  }, [totalEntrada, totalSaida, saldoPos]);

  const renderTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name?: string; value?: number; payload?: Slice }>;
  }) => {
    if (!active || !payload?.length || pieSum <= 0) return null;
    const item = payload[0];
    const name = item.name ?? item.payload?.name;
    const value = Number(item.value ?? 0);
    const pctDoGrafico = (100 * value) / pieSum;

    let refLine: string | null = null;
    if (hasEntradaBase && totalEntrada > 0) {
      const pctEntrada = (100 * value) / totalEntrada;
      refLine = `${formatNumberPtBrFixed(pctEntrada, 1)}% da soma das entradas (${formatNumberPtBrFixed(totalEntrada, 2)})`;
    } else if (!hasEntradaBase && name?.includes("Saída")) {
      refLine = "Não há total de entrada para comparar; toda a pizza é saída acumulada.";
    }

    return (
      <div
        className="rounded-xl border border-border/80 bg-card/98 px-4 py-3 shadow-lg text-sm font-medium max-w-[16rem]"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        <p className="font-bold text-foreground">{name}</p>
        <p className="text-muted-foreground tabular-nums mt-1">Quantidade: {formatNumberPtBrFixed(value, 2)}</p>
        <p className="text-muted-foreground tabular-nums text-xs mt-0.5">
          {formatNumberPtBrFixed(pctDoGrafico, 1)}% da pizza
        </p>
        {refLine ? <p className="text-muted-foreground text-xs mt-2 leading-snug border-t border-border/50 pt-2">{refLine}</p> : null}
        {hasEntradaBase && totalSaida > totalEntrada ? (
          <p className="text-destructive text-xs mt-2 leading-snug">
            Saída total maior que entrada acumulada; o saldo exibido nos cards pode ficar negativo.
          </p>
        ) : null}
      </div>
    );
  };

  const showLabels = pieSum > 0 && data.length > 0 && data[0]?.name !== "Sem dados";

  return (
    <div className="dashboard-pie-chart dashboard-pie-chart-wrap h-[260px] sm:h-[280px] lg:h-[300px] w-full max-w-md mx-auto flex items-center justify-center p-4 sm:p-5">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <radialGradient id="occe-pie-success" cx="0.35" cy="0.35" r="0.65">
              <stop offset="0%" stopColor="hsl(160 84% 52%)" stopOpacity={1} />
              <stop offset="70%" stopColor="hsl(var(--success))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(160 84% 28%)" stopOpacity={0.95} />
            </radialGradient>
            <radialGradient id="occe-pie-danger" cx="0.35" cy="0.35" r="0.65">
              <stop offset="0%" stopColor="hsl(0 72% 58%)" stopOpacity={1} />
              <stop offset="70%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(0 62% 28%)" stopOpacity={0.95} />
            </radialGradient>
          </defs>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius="78%"
            innerRadius={0}
            stroke="hsl(var(--card))"
            strokeWidth={2.5}
            paddingAngle={pieSum > 0 && data.length > 1 ? 2 : 0}
            className="[&_.recharts-pie-sector]:outline-none"
            isAnimationActive
            animationDuration={700}
            animationEasing="ease-out"
            label={showLabels ? ({ percent }) => `${((percent ?? 0) * 100).toFixed(1).replace(".", ",")}%` : false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name + i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={renderTooltip} />
          <Legend
            wrapperStyle={{ paddingTop: 12 }}
            align="center"
            iconType="circle"
            iconSize={10}
            formatter={(value) => (
              <span
                style={{
                  color: "hsl(var(--foreground) / 0.9)",
                  fontWeight: 600,
                  marginLeft: 6,
                  letterSpacing: "0.02em",
                }}
              >
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
