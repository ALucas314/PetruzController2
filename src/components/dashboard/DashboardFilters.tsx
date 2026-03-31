import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Database, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface DashboardFiltersProps {
  dataInicio?: string;
  setDataInicio?: (v: string) => void;
  dataFim?: string;
  setDataFim?: (v: string) => void;
  filial?: string;
  setFilial?: (v: string) => void;
  filiais?: Array<{ id: number; codigo: string; nome: string }>;
  onFilter?: () => void;
  loading?: boolean;
}

export function DashboardFilters({
  dataInicio = "", setDataInicio, dataFim = "", setDataFim, filial, setFilial, filiais = [],
  onFilter, loading = false,
}: DashboardFiltersProps) {
  const [mesmaData, setMesmaData] = useState(false);

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 items-center overflow-visible">
      {setDataInicio && setDataFim && (
        <>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Checkbox
              id="dashboard-mesma-data"
              checked={mesmaData}
              onCheckedChange={(checked) => {
                const value = Boolean(checked);
                setMesmaData(value);
                if (value && dataInicio) setDataFim(dataInicio);
              }}
            />
            <label htmlFor="dashboard-mesma-data" className="text-xs text-muted-foreground cursor-pointer select-none">
              Mesma data
            </label>
          </div>
          <div className="flex items-center gap-2 min-w-[152px] w-full sm:w-[172px] sm:min-w-0 flex-shrink-0 overflow-visible">
            <DatePicker
              value={dataInicio}
              onChange={(v) => {
                setDataInicio(v);
                if (mesmaData) setDataFim(v);
              }}
              placeholder="Data inicial"
              className="flex-1 min-w-[120px] w-[120px] shrink-0 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm sm:w-[140px] overflow-visible"
              triggerClassName="bg-card/80 border-border/50"
            />
          </div>
          <span className="text-muted-foreground text-sm hidden sm:inline shrink-0">até</span>
          <div className="flex items-center gap-2 min-w-[152px] w-full sm:w-[172px] sm:min-w-0 flex-shrink-0 overflow-visible">
            <DatePicker
              value={dataFim}
              onChange={(v) => {
                setDataFim(v);
                if (mesmaData) setDataInicio(v);
              }}
              placeholder="Data final"
              className="flex-1 min-w-[120px] w-[120px] shrink-0 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm sm:w-[140px] overflow-visible"
              triggerClassName="bg-card/80 border-border/50"
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
      {onFilter && (
        <Button
          variant="outline"
          onClick={onFilter}
          disabled={loading}
          className="w-full min-[791px]:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          title="Filtrar pelo período e filial"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          <span>{loading ? "Carregando..." : "Filtrar"}</span>
        </Button>
      )}
    </div>
  );
}
