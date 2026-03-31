import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OCTERow } from "@/services/supabaseData";
import { formatNumberPtBrFixed } from "@/lib/formatLocale";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExportToPng } from "@/components/ExportToPng";

function truncateNomeColaborador(nome: string, maxChars: number): string {
  const t = nome.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
}

/** Quebra nome em até 2 linhas por palavras (melhor em telas estreitas). */
function splitNomeColaboradorLinhas(nome: string, maxLinha: number): [string] | [string, string] {
  const t = nome.trim() || "—";
  if (t.length <= maxLinha) return [t];
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return [truncateNomeColaborador(words[0] ?? t, maxLinha + 1)];
  }
  let line1 = words[0]!;
  let i = 1;
  for (; i < words.length; i++) {
    const next = `${line1} ${words[i]!}`;
    if (next.length > maxLinha) break;
    line1 = next;
  }
  const rest = words.slice(i).join(" ").trim();
  if (!rest.length) return [line1];
  const line2 = rest.length > maxLinha ? `${rest.slice(0, Math.max(1, maxLinha - 1))}…` : rest;
  return [line1, line2];
}

/** Preenchimento horizontal dos rótulos dentro da barra (px) — igual nas duas séries. */
const BAR_LABEL_INSET_PX = 6;
/** Espaço mínimo entre bloco % e bloco kg no modo split (px). */
const BAR_LABEL_SPLIT_GAP_PX = 10;

/** Largura aproximada do texto (px) para decidir split / uma linha / só kg — evita % “para fora” da barra. */
function approxBarLabelTextWidthPx(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") w += fontSize * 0.58;
    else if (ch === "%") w += fontSize * 0.72;
    else if (ch === "·") w += fontSize * 0.42;
    else if (ch === "," || ch === ".") w += fontSize * 0.32;
    else w += fontSize * 0.48;
  }
  return w;
}
/** Contorno dos números sobre as barras (legível em qualquer tom de barra). */
const BAR_LABEL_STROKE = "rgba(0,0,0,0.38)";
const BAR_LABEL_FILL = "#ffffff";

type TkgBarLabelProps = {
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  /** Recharts não repassa `payload` no `content` (filterProps remove). */
  index?: number;
  value?: unknown;
};

/** Linha do gráfico para rótulo (tKg + %). */
type TkgBarLabelRow = { tKg: number; pctTkgSobreMeta: number | null };

const labelNumericStyle = { fontVariantNumeric: "tabular-nums" as const };

function buildTkgBarLabelContent(isMobile: boolean, chartData: ReadonlyArray<TkgBarLabelRow>) {
  const fsDefault = isMobile ? 10 : 11;
  const fsMin = 7;

  return function TkgBarLabelContent(props: TkgBarLabelProps) {
    const vb = props.viewBox;
    if (!vb) return null;
    const x = Number(vb.x ?? 0);
    const y = Number(vb.y ?? 0);
    const width = Number(vb.width ?? 0);
    const height = Number(vb.height ?? 0);
    if (width < 2 || height < 2) return null;

    const idx = typeof props.index === "number" ? props.index : -1;
    const row = idx >= 0 && idx < chartData.length ? chartData[idx] : undefined;
    const tKgFromValue = Number(props.value);
    const tKg = row != null && Number.isFinite(row.tKg) ? row.tKg : tKgFromValue;
    if (!Number.isFinite(tKg)) return null;

    const pctStr =
      row != null && row.pctTkgSobreMeta != null && Number.isFinite(row.pctTkgSobreMeta)
        ? `${formatNumberPtBrFixed(row.pctTkgSobreMeta, 0)}%`
        : "";
    const kgStr = formatNumberPtBrFixed(tKg, isMobile ? 1 : 2);
    const midY = y + height / 2;

    const innerW = Math.max(0, width - 2 * BAR_LABEL_INSET_PX);
    const splitSlackPx = 4;
    const pctW = pctStr ? approxBarLabelTextWidthPx(pctStr, fsDefault) : 0;
    const kgW = approxBarLabelTextWidthPx(kgStr, fsDefault);
    const useSplit =
      Boolean(pctStr) &&
      pctW + BAR_LABEL_SPLIT_GAP_PX + kgW <= innerW - splitSlackPx;

    const commonFor = (fontSize: number) => ({
      fontSize,
      fontWeight: 700 as const,
      fill: BAR_LABEL_FILL,
      style: labelNumericStyle,
      paintOrder: "stroke fill" as const,
      stroke: BAR_LABEL_STROKE,
      strokeWidth: 2,
      strokeLinejoin: "round" as const,
    });

    if (useSplit && pctStr) {
      return (
        <g>
          <text
            x={x + BAR_LABEL_INSET_PX}
            y={midY}
            dominantBaseline="central"
            textAnchor="start"
            {...commonFor(fsDefault)}
          >
            {pctStr}
          </text>
          <text
            x={x + width - BAR_LABEL_INSET_PX}
            y={midY}
            dominantBaseline="central"
            textAnchor="end"
            {...commonFor(fsDefault)}
          >
            {kgStr}
          </text>
        </g>
      );
    }

    const singleLine = pctStr ? `${pctStr} · ${kgStr}` : kgStr;
    let fs = fsDefault;
    while (fs > fsMin && approxBarLabelTextWidthPx(singleLine, fs) > innerW) {
      fs -= 1;
    }

    const lineFits = approxBarLabelTextWidthPx(singleLine, fs) <= innerW;
    const showKgOnly = !lineFits;
    let showText = lineFits ? singleLine : kgStr;
    let outFs = lineFits ? fs : fsDefault;
    if (showKgOnly) {
      let kfs = fsDefault;
      while (kfs > fsMin && approxBarLabelTextWidthPx(kgStr, kfs) > innerW) {
        kfs -= 1;
      }
      outFs = kfs;
      if (approxBarLabelTextWidthPx(kgStr, kfs) > innerW) {
        showText = isMobile ? formatNumberPtBrFixed(tKg, 0) : formatNumberPtBrFixed(tKg, 1);
      }
    }

    return (
      <text
        x={x + width - BAR_LABEL_INSET_PX}
        y={midY}
        dominantBaseline="central"
        textAnchor="end"
        {...commonFor(outFs)}
      >
        {showText}
      </text>
    );
  };
}

function buildMetaKgBarLabelContent(isMobile: boolean, chartData: ReadonlyArray<{ metaKg: number }>) {
  const fs = isMobile ? 10 : 11;

  return function MetaKgBarLabelContent(props: TkgBarLabelProps) {
    const vb = props.viewBox;
    if (!vb) return null;
    const x = Number(vb.x ?? 0);
    const y = Number(vb.y ?? 0);
    const width = Number(vb.width ?? 0);
    const height = Number(vb.height ?? 0);
    if (width < 2 || height < 2) return null;

    const idx = typeof props.index === "number" ? props.index : -1;
    const row = idx >= 0 && idx < chartData.length ? chartData[idx] : undefined;
    const metaFromVal = Number(props.value);
    const meta = row != null && Number.isFinite(row.metaKg) ? row.metaKg : metaFromVal;
    if (!Number.isFinite(meta)) return null;

    const kgStr = formatNumberPtBrFixed(meta, isMobile ? 1 : 2);
    const midY = y + height / 2;
    return (
      <text
        x={x + width - BAR_LABEL_INSET_PX}
        y={midY}
        dominantBaseline="central"
        textAnchor="end"
        fontSize={fs}
        fontWeight={700}
        fill={BAR_LABEL_FILL}
        style={labelNumericStyle}
        paintOrder="stroke fill"
        stroke={BAR_LABEL_STROKE}
        strokeWidth={2}
        strokeLinejoin="round"
      >
        {kgStr}
      </text>
    );
  };
}

type ColaboradorYAxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: unknown };
};

function buildColaboradorYAxisTick(isMobile: boolean, isCompact: boolean) {
  /** Mobile: nomes mais curtos = eixo Y mais estreito e gráfico mais à esquerda. */
  const lineMax = isCompact ? 10 : isMobile ? 11 : 32;
  const fs = isCompact ? 9 : isMobile ? 10 : 12;

  return function ColaboradorYAxisTick({ x = 0, y = 0, payload }: ColaboradorYAxisTickProps) {
    const nome = String(payload?.value ?? "").trim() || "—";
    const lines = splitNomeColaboradorLinhas(nome, lineMax);

    if (lines.length === 2 && lines[1]!.length > 0) {
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            textAnchor="end"
            fill="hsl(var(--foreground))"
            fontSize={fs}
            fontWeight={600}
            style={labelNumericStyle}
          >
            <tspan x={0} dy="-0.55em">
              {lines[0]}
            </tspan>
            <tspan x={0} dy="1.15em">
              {lines[1]}
            </tspan>
          </text>
        </g>
      );
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          textAnchor="end"
          x={0}
          y={0}
          dy="0.33em"
          fill="hsl(var(--foreground))"
          fontSize={fs}
          fontWeight={600}
          style={labelNumericStyle}
        >
          {lines[0]}
        </text>
      </g>
    );
  };
}

export type EmpacotamentoTKgMetaChartPoint = {
  colaborador: string;
  tKg: number;
  metaKg: number;
  /** (T. KG ÷ Meta Kg) × 100; null se Meta Kg ≤ 0. */
  pctTkgSobreMeta: number | null;
};

/** Percentual de atingimento em kg: (T. KG / Meta Kg) × 100. */
export function pctTkgRealizadoSobreMetaKg(tKg: number, metaKg: number): number | null {
  if (!(metaKg > 0)) return null;
  return (Number(tKg) / Number(metaKg)) * 100;
}

export function buildTKgMetaChartData(rows: OCTERow[]): EmpacotamentoTKgMetaChartPoint[] {
  const mapped = [...rows].map((r) => {
    const colaborador = (r.colaborador || "").trim() || "—";
    const tKg = r.tKg != null ? Number(r.tKg) : 0;
    const metaKg =
      r.metaKg != null
        ? Number(r.metaKg)
        : r.meta != null
          ? Number(r.meta) * Number(r.peso ?? 0)
          : 0;
    return {
      colaborador,
      tKg,
      metaKg,
      pctTkgSobreMeta: pctTkgRealizadoSobreMetaKg(tKg, metaKg),
    };
  });
  /**
   * Maior % primeiro: no layout vertical deste gráfico a primeira linha aparece no topo;
   * melhor atingimento em cima, pior em baixo.
   */
  return mapped.sort((a, b) => {
    const va = a.pctTkgSobreMeta ?? Number.NEGATIVE_INFINITY;
    const vb = b.pctTkgSobreMeta ?? Number.NEGATIVE_INFINITY;
    if (vb !== va) return vb - va;
    return a.colaborador.localeCompare(b.colaborador, "pt-BR", { sensitivity: "base" });
  });
}

type Props = {
  rows: OCTERow[];
  /** Título opcional (ex.: doc / data) */
  subtitle?: string;
};

function TkgMetaTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: { payload?: EmpacotamentoTKgMetaChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const pct = row.pctTkgSobreMeta;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      <ul className="space-y-1 text-muted-foreground">
        <li className="flex justify-between gap-4">
          <span>T. KG (realizado)</span>
          <span className="font-mono tabular-nums text-foreground">{formatNumberPtBrFixed(row.tKg, 2)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Meta Kg</span>
          <span className="font-mono tabular-nums text-foreground">{formatNumberPtBrFixed(row.metaKg, 2)}</span>
        </li>
        <li className="flex justify-between gap-4 pt-1 border-t border-border text-foreground font-medium">
          <span>T. KG ÷ Meta Kg × 100</span>
          <span className="font-mono tabular-nums">
            {pct != null ? `${formatNumberPtBrFixed(pct, 0)}%` : "—"}
          </span>
        </li>
      </ul>
    </div>
  );
}

export function EmpacotamentoTKgMetaChart({ rows, subtitle }: Props) {
  const reactId = useId().replace(/:/g, "");
  const exportCardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 480px)");
    const onChange = () => setIsCompact(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const data = useMemo(() => buildTKgMetaChartData(rows), [rows]);
  const tkgBarLabelContent = useMemo(() => buildTkgBarLabelContent(isMobile, data), [isMobile, data]);
  const metaKgBarLabelContent = useMemo(() => buildMetaKgBarLabelContent(isMobile, data), [isMobile, data]);
  const colaboradorYAxisTick = useMemo(
    () => buildColaboradorYAxisTick(isMobile, isCompact),
    [isMobile, isCompact],
  );

  if (data.length === 0) return null;

  const rowPitch = isCompact ? 90 : isMobile ? 78 : 72;
  const chartHeight = Math.min(720, Math.max(240, data.length * rowPitch));
  const gradTkg = `emp-tkg-${reactId}`;
  const gradMeta = `emp-meta-${reactId}`;

  /** Eixo Y estreito + margin.left pequeno desloca barras e grade para a esquerda. */
  const yAxisWidth = isCompact ? 96 : isMobile ? 76 : 132;
  const chartMargin = isMobile
    ? { top: 6, right: 10, left: 2, bottom: isCompact ? 10 : 22 }
    : { top: 8, right: 16, left: 4, bottom: 8 };
  const barThickness = isMobile ? 22 : 26;
  /** Largura mínima (px) da barra T. KG — Recharts expande a barra além do valor no eixo X só para o rótulo caber. */
  const tKgBarMinWidthPx = isCompact ? 118 : isMobile ? 110 : 124;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-4 sm:px-4 w-full min-w-0 max-w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div ref={exportCardRef} className="min-w-0 flex-1 space-y-3">
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold text-foreground">Análise T. KG × Meta Kg (por colaborador)</h4>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Percentual de atingimento (kg):{" "}
              <span className="font-mono tabular-nums">T. KG (realizado) ÷ Meta Kg × 100</span>
            </p>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3.5 rounded-sm bg-primary shadow-sm ring-1 ring-primary/25" aria-hidden />
              <span className="text-muted-foreground font-medium">T. KG (realizado)</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3.5 rounded-sm bg-muted-foreground/45 shadow-sm ring-1 ring-muted-foreground/20" aria-hidden />
              <span className="text-muted-foreground font-medium">Meta Kg</span>
            </span>
          </div>
          <div className="empacotamento-tkg-meta-chart w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-border/40 bg-card/40 pl-1 pr-2 py-2 sm:pl-2 sm:pr-3 sm:py-3 [&_.recharts-cartesian-grid-horizontal_line]:stroke-border/30 [&_.recharts-legend-item-text]:text-muted-foreground">
            <div className="min-w-0 w-full max-w-full">
              <ResponsiveContainer width="100%" height={chartHeight} minWidth={200}>
                <BarChart
                  layout="vertical"
                  data={data}
                  margin={chartMargin}
                  barCategoryGap={isMobile ? "12%" : "8%"}
                  barGap={isMobile ? 3 : 4}
                >
                  <defs>
                    <linearGradient id={gradTkg} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(217 71% 32%)" stopOpacity={0.92} />
                      <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(217 71% 60%)" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id={gradMeta} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 6"
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.35}
                    horizontal
                    vertical={false}
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="colaborador"
                    width={yAxisWidth}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={colaboradorYAxisTick}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--primary) / 0.06)", radius: 4 }}
                    content={<TkgMetaTooltip />}
                  />
                  {!isCompact ? (
                    <Legend
                      align="center"
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: isMobile ? 4 : 8, fontSize: isMobile ? 10 : 12 }}
                      iconSize={isMobile ? 10 : 14}
                      formatter={(value) => (value === "tKg" ? "T. KG" : "Meta Kg")}
                    />
                  ) : null}
                  <Bar
                    dataKey="tKg"
                    name="tKg"
                    fill={`url(#${gradTkg})`}
                    radius={[0, 6, 6, 0]}
                    barSize={barThickness}
                    minPointSize={tKgBarMinWidthPx}
                  >
                    <LabelList dataKey="tKg" content={tkgBarLabelContent} />
                  </Bar>
                  <Bar
                    dataKey="metaKg"
                    name="metaKg"
                    fill={`url(#${gradMeta})`}
                    radius={[0, 6, 6, 0]}
                    barSize={barThickness}
                  >
                    <LabelList dataKey="metaKg" content={metaKgBarLabelContent} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <ExportToPng
          targetRef={exportCardRef}
          filenamePrefix="grafico-empacotamento-tkg-meta"
          expandScrollable={false}
          className="shrink-0 w-full sm:w-auto min-h-[44px] sm:min-h-0"
        />
      </div>
    </div>
  );
}
