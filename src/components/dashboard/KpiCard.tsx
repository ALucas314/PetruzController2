import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  prefix?: string;
}

export function KpiCard({ title, value, icon: Icon, prefix }: KpiCardProps) {
  return (
    <div className="kpi-card animate-fade-in group">
      <div className="flex items-start justify-between">
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
    </div>
  );
}
