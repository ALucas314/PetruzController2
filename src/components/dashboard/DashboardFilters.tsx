import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

interface DashboardFiltersProps {
  dataInicio?: string;
  setDataInicio?: (v: string) => void;
  dataFim?: string;
  setDataFim?: (v: string) => void;
  filial?: string;
  setFilial?: (v: string) => void;
  filiais?: Array<{ id: number; codigo: string; nome: string }>;
}

export function DashboardFilters({
  dataInicio = "", setDataInicio, dataFim = "", setDataFim, filial, setFilial, filiais = [],
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 items-center overflow-visible">
      {setDataInicio && setDataFim && (
        <>
          <div className="flex items-center gap-2 min-w-[152px] w-full sm:w-[172px] sm:min-w-0 flex-shrink-0 overflow-visible">
            <span className="flex shrink-0 w-6 h-6 items-center justify-center text-muted-foreground" aria-hidden>
              <Calendar className="h-4 w-4 min-w-[16px] min-h-[16px]" />
            </span>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="flex-1 min-w-[120px] w-[120px] shrink-0 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm sm:w-[140px] overflow-visible"
              placeholder="Data inicial"
            />
          </div>
          <span className="text-muted-foreground text-sm hidden sm:inline shrink-0">até</span>
          <div className="flex items-center gap-2 min-w-[152px] w-full sm:w-[172px] sm:min-w-0 flex-shrink-0 overflow-visible">
            <span className="flex shrink-0 w-6 h-6 items-center justify-center text-muted-foreground" aria-hidden>
              <Calendar className="h-4 w-4 min-w-[16px] min-h-[16px]" />
            </span>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="flex-1 min-w-[120px] w-[120px] shrink-0 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm sm:w-[140px] overflow-visible"
              placeholder="Data final"
            />
          </div>
        </>
      )}
      {filial !== undefined && setFilial && (
        <Select value={filial || "all"} onValueChange={(value) => setFilial(value === "all" ? "" : value)}>
          <SelectTrigger className="w-full min-w-0 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm hover:shadow-md transition-all sm:w-[140px] md:w-[180px]">
            <SelectValue placeholder="Selecionar filial" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as filiais</SelectItem>
            {filiais.map((f) => (
              <SelectItem key={f.id} value={f.nome}>
                {f.nome.length > 30 ? `${f.nome.substring(0, 30)}...` : f.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
