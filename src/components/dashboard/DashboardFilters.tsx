import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

interface DashboardFiltersProps {
  dataInicio?: string;
  setDataInicio?: (v: string) => void;
  dataFim?: string;
  setDataFim?: (v: string) => void;
  sector: string;
  setSector: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  filial?: string;
  setFilial?: (v: string) => void;
  filiais?: Array<{ id: number; codigo: string; nome: string }>;
}

export function DashboardFilters({
  dataInicio = "", setDataInicio, dataFim = "", setDataFim, sector, setSector, status, setStatus, filial, setFilial, filiais = [],
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
      {setDataInicio && setDataFim && (
        <>
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full min-w-0 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm sm:w-[140px]"
              placeholder="Data inicial"
            />
          </div>
          <span className="text-muted-foreground text-sm hidden sm:inline">até</span>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full min-w-0 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm sm:w-[140px]"
            placeholder="Data final"
          />
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

      <Select value={sector} onValueChange={setSector}>
        <SelectTrigger className="w-full min-w-0 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm hover:shadow-md transition-all sm:w-[140px] md:w-[160px]">
          <SelectValue placeholder="Setor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os setores</SelectItem>
          <SelectItem value="producao">Produção</SelectItem>
          <SelectItem value="vendas">Vendas</SelectItem>
          <SelectItem value="logistica">Logística</SelectItem>
          <SelectItem value="financeiro">Financeiro</SelectItem>
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full min-w-0 bg-card/80 backdrop-blur-sm border-border/50 shadow-sm hover:shadow-md transition-all sm:w-[140px] md:w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="ativo">Ativo</SelectItem>
          <SelectItem value="pendente">Pendente</SelectItem>
          <SelectItem value="concluido">Concluído</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
