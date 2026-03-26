import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  prefix?: string;
}

export function KpiCard({ title, value, icon: Icon, prefix }: KpiCardProps) {
  const raw = String(value ?? "").trim();
  const isNegative = raw.startsWith("-");
  const valueWithoutSign = isNegative ? raw.slice(1) : raw;

  return (
    <div className="kpi-card animate-fade-in group backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground/90 uppercase tracking-widest mb-2">
            {title}
          </p>
          <p className="text-[clamp(1rem,1.8vw,1.45rem)] font-bold tracking-tight leading-tight tabular-nums whitespace-nowrap bg-gradient-to-br from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
            <span className="inline-block w-[0.7em] text-center">{isNegative ? "-" : ""}</span>
            {prefix}{valueWithoutSign}
          </p>
        </div>
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/12 to-primary/5 border border-primary/25 shadow-[0_2px_8px_hsl(var(--primary)/0.15)] group-hover:shadow-[0_4px_16px_hsl(var(--primary)/0.2)] group-hover:scale-105 transition-all duration-300 shrink-0 ml-3 ring-2 ring-primary/5">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        </div>
      </div>
    </div>
  );
}
