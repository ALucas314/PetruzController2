import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  change: number;
  icon: LucideIcon;
  prefix?: string;
}

export function KpiCard({ title, value, change, icon: Icon, prefix }: KpiCardProps) {
  const isPositive = change >= 0;

  return (
    <div className="kpi-card animate-fade-in group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wide mb-1.5">
            {title}
          </p>
          <p className="text-xl sm:text-2xl font-bold bg-gradient-to-br from-card-foreground to-card-foreground/70 bg-clip-text text-transparent">
            {prefix}{value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300 shrink-0 ml-2">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2.5 border-t border-border/50">
        {isPositive ? (
          <TrendingUp className="h-3.5 w-3.5 text-success" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
        )}
        <span className={`text-xs font-semibold ${isPositive ? "text-success" : "text-destructive"}`}>
          {isPositive ? "+" : ""}{change}%
        </span>
        <span className="text-xs text-muted-foreground ml-1">vs mês anterior</span>
      </div>
    </div>
  );
}
