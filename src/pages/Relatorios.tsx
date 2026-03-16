import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Filter, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getFiliais, getProducaoHistory } from "@/services/supabaseData";

function formatDate(str: string): string {
  if (!str) return "—";
  try {
    const [y, m, d] = str.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return str;
  }
}

/** Formato longo para card: "segunda-feira, 09 de março de 2026" */
function formatDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const s = dateStr.split("T")[0];
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

interface DocRecord {
  recordKey: string;
  data_dia: string;
  filial_nome: string;
  doc_id?: string | null;
  id?: number;
  data_cabecalho?: string;
  data?: string;
}

export default function Relatorios() {
  const navigate = useNavigate();
  const [filiais, setFiliais] = useState<Array<{ id: number; codigo: string; nome: string }>>([]);
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const hojeStrDoc = hoje.toISOString().split("T")[0];

  // Documentos no período (grid com filtros De/Até, Filial, N° documento)
  const [docGridDataDe, setDocGridDataDe] = useState(primeiroDiaMes);
  const [docGridDataAte, setDocGridDataAte] = useState(hojeStrDoc);
  const [docGridDataDeApplied, setDocGridDataDeApplied] = useState(primeiroDiaMes);
  const [docGridDataAteApplied, setDocGridDataAteApplied] = useState(hojeStrDoc);
  const [docGridFilialFilter, setDocGridFilialFilter] = useState("");
  const [docGridFilialFilterApplied, setDocGridFilialFilterApplied] = useState("");
  const [docGridNumeroFilter, setDocGridNumeroFilter] = useState("");
  const [docGridNumeroFilterApplied, setDocGridNumeroFilterApplied] = useState("");
  const [docGridRecords, setDocGridRecords] = useState<DocRecord[]>([]);
  const [docGridLoading, setDocGridLoading] = useState(false);

  const normalizeDataDia = (v: string | Date | null | undefined): string => {
    if (!v) return "";
    if (typeof v === "string") return v.split("T")[0];
    return new Date(v).toISOString().split("T")[0];
  };

  const loadDocGrid = useCallback(async () => {
    setDocGridLoading(true);
    try {
      const de = docGridDataDeApplied.split("T")[0];
      const ate = docGridDataAteApplied.split("T")[0];
      if (!de || !ate || de > ate) {
        setDocGridRecords([]);
        return;
      }
      const [y, m] = de.split("-").map(Number);
      const primeiroDiaMes = `${y}-${String(m).padStart(2, "0")}-01`;
      const result = await getProducaoHistory({ dataInicio: primeiroDiaMes, dataFim: ate, limit: 2000 });
      const recordsMap = new Map<string, DocRecord>();
      (result as any[]).forEach((item: any) => {
        const dateStr = normalizeDataDia(item.data_dia || item.data_cabecalho || item.data);
        if (!dateStr) return;
        const filialNome = (item.filial_nome || "").trim();
        const docId = item.doc_id ?? null;
        const recordKey = `${dateStr}_${filialNome}_${docId ?? "legacy"}`;
        if (!recordsMap.has(recordKey)) {
          recordsMap.set(recordKey, {
            recordKey,
            data_dia: dateStr,
            filial_nome: filialNome,
            doc_id: docId,
            id: item.id,
            data_cabecalho: item.data_cabecalho,
            data: item.data,
          });
        }
      });
      const sorted = Array.from(recordsMap.values()).sort((a, b) => {
        const tA = new Date(a.data_dia).getTime();
        const tB = new Date(b.data_dia).getTime();
        if (tA !== tB) return tA - tB;
        return (a.filial_nome || "").localeCompare(b.filial_nome || "");
      });
      setDocGridRecords(sorted);
    } catch (e) {
      console.error("Erro ao carregar documentos:", e);
      setDocGridRecords([]);
    } finally {
      setDocGridLoading(false);
    }
  }, [docGridDataDeApplied, docGridDataAteApplied]);

  const docGridListAfterFilial = useMemo(() => {
    let list = docGridRecords;
    if (docGridFilialFilterApplied.trim()) {
      const fn = docGridFilialFilterApplied.trim();
      list = list.filter((r) => (r.filial_nome || "").trim() === fn);
    }
    return list;
  }, [docGridRecords, docGridFilialFilterApplied]);

  const docGridListAfterDate = useMemo(() => {
    const de = docGridDataDeApplied.split("T")[0];
    const ate = docGridDataAteApplied.split("T")[0];
    if (!de || !ate) return docGridListAfterFilial;
    return docGridListAfterFilial.filter((r) => r.data_dia >= de && r.data_dia <= ate);
  }, [docGridListAfterFilial, docGridDataDeApplied, docGridDataAteApplied]);

  const docGridFiltered = useMemo(() => {
    if (!docGridNumeroFilterApplied.trim()) return docGridListAfterDate;
    const num = parseInt(docGridNumeroFilterApplied.trim(), 10);
    if (Number.isNaN(num) || num < 1) return docGridListAfterDate;
    const item = docGridListAfterDate[num - 1];
    return item ? [item] : [];
  }, [docGridListAfterDate, docGridNumeroFilterApplied]);

  useEffect(() => {
    loadDocGrid();
  }, [loadDocGrid]);

  useEffect(() => {
    getFiliais()
      .then((data) => setFiliais(data.map((f) => ({ id: f.id as number, codigo: String(f.codigo ?? ""), nome: String(f.nome ?? "") }))))
      .catch((e) => console.error("Erro ao carregar filiais:", e));
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6 pt-4 sm:pt-6">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Relatórios
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-medium mt-1">
            Consulte dados de produção já cadastrados
          </p>
        </div>

        {/* Documentos no período — mesma interface do Acompanhamento diário */}
        <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm p-4 sm:p-5 lg:p-6 shadow-sm space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            Documentos no período: {formatDate(docGridDataDeApplied)} até {formatDate(docGridDataAteApplied)}
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 sm:gap-3">
            <div className="flex flex-col gap-1.5 w-full sm:min-w-[120px] sm:w-auto">
              <Label className="text-xs font-medium text-muted-foreground">De</Label>
              <DatePicker
                value={docGridDataDe}
                onChange={(v) => v && setDocGridDataDe(v)}
                placeholder="Data inicial"
                className="w-full overflow-visible min-w-0"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-full sm:min-w-[120px] sm:w-auto">
              <Label className="text-xs font-medium text-muted-foreground">Até</Label>
              <DatePicker
                value={docGridDataAte}
                onChange={(v) => v && setDocGridDataAte(v)}
                placeholder="Data final"
                className="w-full overflow-visible min-w-0"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-full sm:min-w-[140px] sm:max-w-[180px]">
              <Label className="text-xs font-medium text-muted-foreground">Filial</Label>
              <Select
                value={docGridFilialFilter || "__todos__"}
                onValueChange={(v) => setDocGridFilialFilter(v === "__todos__" ? "" : v)}
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  {filiais.map((f) => (
                    <SelectItem key={f.id} value={(f.nome || "").trim()}>
                      {(f.nome || "").trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 w-full sm:min-w-[120px] sm:w-auto">
              <Label htmlFor="doc-grid-numero" className="text-xs font-medium text-muted-foreground">
                N° documento
              </Label>
              <Input
                id="doc-grid-numero"
                type="number"
                min={1}
                max={docGridListAfterFilial.length || 999}
                placeholder="Todos"
                value={docGridNumeroFilter}
                onChange={(e) => setDocGridNumeroFilter(e.target.value)}
                className="h-9 w-full sm:w-[100px] text-sm tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 gap-2 w-full sm:w-auto"
                onClick={() => {
                  setDocGridDataDeApplied(docGridDataDe);
                  setDocGridDataAteApplied(docGridDataAte);
                  setDocGridFilialFilterApplied(docGridFilialFilter);
                  setDocGridNumeroFilterApplied(docGridNumeroFilter.trim());
                }}
              >
                {docGridLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                Filtrar
              </Button>
              {(docGridNumeroFilterApplied || docGridFilialFilterApplied) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-full sm:w-auto text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setDocGridNumeroFilter("");
                    setDocGridNumeroFilterApplied("");
                    setDocGridFilialFilter("");
                    setDocGridFilialFilterApplied("");
                  }}
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {docGridLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {docGridFiltered.map((record) => {
                  const indexInList = docGridListAfterFilial.findIndex((r) => r.recordKey === record.recordKey) + 1;
                  const total = docGridListAfterFilial.length;
                  return (
                    <div
                      key={record.recordKey}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        navigate("/analise-producao", {
                          state: {
                            loadData: record.data_dia,
                            loadFilialNome: record.filial_nome || "",
                            loadDocId: record.doc_id ?? undefined,
                          },
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate("/analise-producao", {
                            state: {
                              loadData: record.data_dia,
                              loadFilialNome: record.filial_nome || "",
                              loadDocId: record.doc_id ?? undefined,
                            },
                          });
                        }
                      }}
                      className="group relative rounded-xl border border-border/50 bg-card/95 hover:border-primary/40 hover:bg-muted/60 hover:shadow-md transition-all duration-300 p-4 sm:p-5 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex min-w-[3.5rem] sm:min-w-[4rem] shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary py-1.5">
                          <span className="text-[10px] font-bold leading-tight">N°</span>
                          <span className="text-sm font-bold tabular-nums">{indexInList}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">de {total}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">
                            {(record.filial_nome || "").trim() || "Sem filial"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDateLong(record.data_dia)}
                          </p>
                          {record.doc_id && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono truncate">
                              Doc. {String(record.doc_id).slice(0, 8)}…
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
              {docGridRecords.length === 0 && !docGridLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum documento no período. Ajuste as datas e clique em Filtrar.
                </p>
              )}
              {docGridRecords.length > 0 && docGridFiltered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum documento encontrado com os filtros aplicados. Use &quot;Limpar&quot; para ver todos.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
