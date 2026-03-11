import type { ReactNode } from "react";

/** Formata número para exibição em gráficos (pt-BR) */
export function formatChartValue(value: number, decimals = 0): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string; color: string }>;
  label?: string;
  labelFormatter?: (label: unknown, payload: unknown[]) => ReactNode;
  valueFormatter?: (v: number) => string;
  valueSuffix?: string;
};

/** Tooltip reutilizável para gráficos – valores em pt-BR, bordas e sombra */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = (v: number) => formatChartValue(v),
  valueSuffix = "",
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const displayLabel = labelFormatter && label != null ? labelFormatter(label, payload) : label;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-lg">
      {displayLabel != null && displayLabel !== "" && (
        <p className="text-xs font-semibold text-foreground border-b border-border/50 pb-1.5 mb-2">
          {displayLabel}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground font-medium">{entry.name}</span>
            <span className="text-xs font-bold text-foreground tabular-nums">
              {typeof entry.value === "number" ? valueFormatter(entry.value) : String(entry.value)}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
