import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Loader2, AlertCircle, Save, Thermometer, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatNumberPtBrFixed } from "@/lib/formatLocale";
import {
  createTunel,
  deleteTunel,
  getFiliais,
  getTuneis,
  parseBrazilNumber,
  subscribeOCTTRealtime,
  updateTunel,
  REALTIME_COLLAPSE_MS,
  REALTIME_SUPPRESS_OWN_WRITE_MS,
  type OCTTRow,
} from "@/services/supabaseData";

type Tunel = OCTTRow;
type FilialOption = { id: number; codigo: string; nome: string; endereco: string };

function filialNorm(s: string): string {
  return (s || "").trim();
}

/** Próximo `codigo_documento` apenas entre túneis da mesma filial. */
function nextCodigoDocumentoForFilial(rows: Tunel[], filialNome: string): number {
  const key = filialNorm(filialNome);
  const nums = rows
    .filter((t) => filialNorm(t.filial) === key)
    .map((t) => Number(String(t.code ?? "").replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

/** Valores gravados em `status_operacional` no Supabase (apenas letra). */
type StatusOperacionalCode = "A" | "M";

const STATUS_OPERACIONAL_CHOICES: ReadonlyArray<{ code: StatusOperacionalCode; label: string }> = [
  { code: "A", label: "A - Ativo" },
  { code: "M", label: "M - Manutenção" },
];

const DEFAULT_STATUS_OPERACIONAL: StatusOperacionalCode = "A";

/** Interpreta texto vindo do banco ou legado e devolve código A | M. */
function statusFromDbToFormCode(raw: string): StatusOperacionalCode {
  const t = (raw || "").trim();
  if (!t) return "A";
  const up = t.toUpperCase();
  if (up === "M" || up.startsWith("M -") || t === "Manutenção" || t === "M - Manutenção" || t === "Inativo") return "M";
  if (up === "A" || up.startsWith("A -") || t === "Operacional" || t === "A - Ativo") return "A";
  return "A";
}

/** Rótulo na grade (a partir do que está no banco). */
function labelStatusOperacional(stored: string): string {
  const code = statusFromDbToFormCode(stored);
  const row = STATUS_OPERACIONAL_CHOICES.find((c) => c.code === code);
  if (row) return row.label;
  const s = stored.trim();
  return s !== "" ? s : "—";
}

const CODIGO_DOCUMENTO_DIGITS = 4;

function formatCodigoDocumentoDisplay(n: number): string {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || v < 1) return "0".repeat(CODIGO_DOCUMENTO_DIGITS);
  return String(v).padStart(CODIGO_DOCUMENTO_DIGITS, "0");
}

function formatCapacidadeBr(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return formatNumberPtBrFixed(v, 2);
}

/** pt-BR enquanto digita: milhares com `.`; após `,` até 2 dígitos (sem completar `,00` até o blur). */
function formatCapacidadeWhileTyping(input: string): string {
  let s = input.replace(/[^\d.,]/g, "");
  if (!s) return "";

  const firstComma = s.indexOf(",");
  if (firstComma !== -1) {
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, "");
  }

  const intSection = firstComma === -1 ? s : s.slice(0, firstComma);
  const decSection = firstComma === -1 ? "" : s.slice(firstComma + 1);

  let intDigits = intSection.replace(/\./g, "").replace(/\D/g, "");
  const decDigitsRaw = decSection.replace(/\D/g, "").slice(0, 2);

  if (!intDigits && firstComma !== -1) intDigits = "0";

  const intFmt = intDigits
    ? intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    : "";

  if (firstComma === -1) return intFmt;

  if (decSection.replace(/\D/g, "").length === 0) return `${intFmt},`;

  return `${intFmt},${decDigitsRaw}`;
}

export default function ControleTuneis() {
  const [tuneis, setTuneis] = useState<Tunel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTunel, setEditingTunel] = useState<Tunel | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    codigoDocumento: string;
    name: string;
    filial: string;
    data: string;
    capacidadeMaximaTunel: string;
    statusOperacional: StatusOperacionalCode;
  }>({
    codigoDocumento: "",
    name: "",
    filial: "",
    data: new Date().toISOString().split("T")[0],
    capacidadeMaximaTunel: "",
    statusOperacional: DEFAULT_STATUS_OPERACIONAL,
  });
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [filiaisLoadError, setFiliaisLoadError] = useState<string | null>(null);
  /** Filtro da grade por filial: vazio = todas */
  const [filialFilterApplied, setFilialFilterApplied] = useState<string>("");
  const [filialFilterPending, setFilialFilterPending] = useState<string>("");
  const [tuneisFiltrosDialogOpen, setTuneisFiltrosDialogOpen] = useState(false);
  const { toast } = useToast();
  const octtLocalMutationAtRef = useRef(0);
  const octtRtDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const filiaisFiltroOpcoes = useMemo(() => {
    const s = new Set<string>();
    for (const t of tuneis) {
      const f = filialNorm(t.filial);
      if (f) s.add(f);
    }
    for (const row of filiais) {
      const n = filialNorm(row.nome || "");
      if (n) s.add(n);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tuneis, filiais]);

  const tuneisFiltrados = useMemo(() => {
    const key = filialNorm(filialFilterApplied);
    if (!key) return tuneis;
    return tuneis.filter((t) => filialNorm(t.filial) === key);
  }, [tuneis, filialFilterApplied]);

  useEffect(() => {
    if (tuneisFiltrosDialogOpen) {
      setFilialFilterPending(filialFilterApplied);
    }
  }, [tuneisFiltrosDialogOpen, filialFilterApplied]);

  const loadTuneis = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTuneis();
      const list = [...data];
      list.sort((a, b) => {
        const fa = filialNorm(a.filial);
        const fb = filialNorm(b.filial);
        if (fa !== fb) return fa.localeCompare(fb, "pt-BR");
        return Number(a.code || 0) - Number(b.code || 0);
      });
      setTuneis(list);
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Erro ao carregar túneis.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadTuneis();
  }, [loadTuneis]);

  useEffect(() => {
    getFiliais()
      .then((list) => {
        setFiliais(list as FilialOption[]);
        setFiliaisLoadError(null);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Falha ao carregar filiais";
        setFiliaisLoadError(msg);
        console.error("Erro ao carregar filiais (OCTF):", e);
      });
  }, []);

  useEffect(() => {
    const unsub = subscribeOCTTRealtime(() => {
      if (Date.now() - octtLocalMutationAtRef.current < REALTIME_SUPPRESS_OWN_WRITE_MS) return;
      if (octtRtDebounceRef.current) clearTimeout(octtRtDebounceRef.current);
      octtRtDebounceRef.current = setTimeout(() => {
        octtRtDebounceRef.current = null;
        void loadTuneis();
      }, REALTIME_COLLAPSE_MS);
    });
    return () => {
      if (octtRtDebounceRef.current) clearTimeout(octtRtDebounceRef.current);
      unsub();
    };
  }, [loadTuneis]);

  const openDialog = useCallback((tunel?: Tunel) => {
    if (tunel) {
      setEditingTunel(tunel);
      const codigoEdicao = Number(String(tunel.code ?? "").replace(/\D/g, ""));
      const codigoPadded = formatCodigoDocumentoDisplay(
        Number.isFinite(codigoEdicao) && codigoEdicao >= 1
          ? codigoEdicao
          : nextCodigoDocumentoForFilial(tuneis, tunel.filial)
      );
      setFormData({
        codigoDocumento: codigoPadded,
        name: tunel.name,
        filial: tunel.filial,
        data: tunel.data || new Date().toISOString().split("T")[0],
        capacidadeMaximaTunel: formatCapacidadeBr(Number(tunel.capacidadeMaximaTunel)),
        statusOperacional: statusFromDbToFormCode(tunel.statusOperacional),
      });
    } else {
      setEditingTunel(null);
      setFormData({
        codigoDocumento: formatCodigoDocumentoDisplay(nextCodigoDocumentoForFilial(tuneis, "")),
        name: "",
        filial: "",
        data: new Date().toISOString().split("T")[0],
        capacidadeMaximaTunel: "",
        statusOperacional: DEFAULT_STATUS_OPERACIONAL,
      });
    }
    setIsDialogOpen(true);
  }, [tuneis]);

  /** Abre o cadastro do túnel vindo de Movimentação (query ?filial=&codigo=). */
  useEffect(() => {
    const filialQ = (searchParams.get("filial") ?? "").trim();
    const codigoRaw = (searchParams.get("codigo") ?? "").replace(/\D/g, "");
    if (!filialQ || !codigoRaw) return;
    if (loading) return;

    const codigoNum = Number(codigoRaw);
    if (!Number.isFinite(codigoNum) || codigoNum < 1) {
      setSearchParams({}, { replace: true });
      return;
    }

    const match = tuneis.find(
      (t) =>
        filialNorm(t.filial) === filialNorm(filialQ) &&
        Number(String(t.code ?? "").replace(/\D/g, "")) === codigoNum
    );

    setSearchParams({}, { replace: true });

    if (match) {
      openDialog(match);
      setFilialFilterApplied(filialNorm(filialQ));
    } else {
      toast({
        title: "Túnel não encontrado",
        description: `Não há cadastro para filial "${filialQ}" e código ${String(codigoNum).padStart(4, "0")}.`,
        variant: "destructive",
      });
      setFilialFilterApplied(filialNorm(filialQ));
    }
  }, [loading, tuneis, searchParams, setSearchParams, openDialog, toast]);

  const handleSave = async () => {
    const nameTrim = formData.name.trim();
    const filialTrim = formData.filial.trim();
    const capacidade = parseBrazilNumber(formData.capacidadeMaximaTunel);
    const codigoStr = formData.codigoDocumento.replace(/\D/g, "");
    const codigoNum = codigoStr === "" ? NaN : Number(codigoStr);
    if (!Number.isFinite(codigoNum) || codigoNum < 1 || !Number.isInteger(codigoNum)) {
      toast({ title: "Validação", description: "Informe um Código válido (inteiro a partir de 1).", variant: "destructive" });
      return;
    }
    if (!nameTrim || !filialTrim || !formData.data || !formData.capacidadeMaximaTunel.trim()) {
      toast({ title: "Validação", description: "Preencha Nome, Filial, Data e Capacidade.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      if (editingTunel) {
        await updateTunel(editingTunel.id, {
          codigo_documento: codigoNum,
          nome: nameTrim,
          filial_nome: filialTrim,
          data: formData.data,
          capacidade_maxima_tunel: capacidade,
          status_operacional: formData.statusOperacional,
        });
      } else {
        await createTunel({
          codigo_documento: codigoNum,
          nome: nameTrim,
          filial_nome: filialTrim,
          data: formData.data,
          capacidade_maxima_tunel: capacidade,
          status_operacional: formData.statusOperacional,
        });
      }
      setIsDialogOpen(false);
      octtLocalMutationAtRef.current = Date.now();
      toast({ title: "Sucesso", description: editingTunel ? "Túnel atualizado." : "Túnel cadastrado." });
      await loadTuneis();
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message || "Erro ao salvar túnel.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] transition-all duration-500 overflow-hidden group/card">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

          <div className="relative z-10">
            <CardHeader className="relative w-full flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 sm:p-8 transition-all duration-500 group/button bg-gradient-to-r from-transparent via-primary/2 to-transparent gap-4 sm:gap-0">
              <div className="flex items-center gap-5 w-full sm:w-auto justify-center sm:justify-start min-w-0">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                  <Thermometer className="relative h-7 w-7 text-primary drop-shadow-lg" />
                </div>
                <div className="text-center sm:text-left space-y-2 min-w-0">
                  <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                    Cadastro de Túneis
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground/80 font-medium">
                    Cadastro de túneis e status operacional
                  </CardDescription>
                </div>
              </div>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row justify-center sm:justify-end items-stretch sm:items-center gap-2 shrink-0">
                <Dialog open={tuneisFiltrosDialogOpen} onOpenChange={setTuneisFiltrosDialogOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium border border-input bg-background hover:bg-muted/50 shrink-0 w-full sm:w-auto"
                      aria-label="Abrir filtros de túneis por filial"
                      aria-haspopup="dialog"
                      aria-expanded={tuneisFiltrosDialogOpen}
                    >
                      <Filter className="h-4 w-4 shrink-0" />
                      <span>Filtros</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="w-[340px] sm:w-[380px] max-w-[95vw] p-4 rounded-lg">
                    <DialogHeader>
                      <DialogTitle className="text-base">Filtros — Cadastro de Túneis</DialogTitle>
                      <DialogDescription className="text-sm text-muted-foreground">
                        Filtre a lista por filial. Clique em Filtrar para aplicar.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <Label htmlFor="octt-dialog-filial" className="text-xs text-muted-foreground whitespace-nowrap">
                          Filial
                        </Label>
                        <Select
                          value={filialNorm(filialFilterPending) ? filialFilterPending : "__todas__"}
                          onValueChange={(v) => setFilialFilterPending(v === "__todas__" ? "" : v)}
                        >
                          <SelectTrigger id="octt-dialog-filial" className="h-9 text-sm">
                            <SelectValue placeholder="Todas as filiais" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__todas__">Todas as filiais</SelectItem>
                            {filiaisFiltroOpcoes.map((nome) => (
                              <SelectItem key={nome} value={nome}>
                                {nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-9"
                        onClick={() => setFilialFilterPending("")}
                      >
                        Limpar
                      </Button>
                      <Button
                        type="button"
                        className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => {
                          setFilialFilterApplied(filialFilterPending);
                          setTuneisFiltrosDialogOpen(false);
                        }}
                      >
                        Filtrar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  onClick={() => openDialog()}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Novo Túnel
                </Button>
              </div>
            </CardHeader>

            <CardContent className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-4 sm:p-5 lg:p-7">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : tuneis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">Nenhum túnel cadastrado</p>
                  <p className="text-sm text-muted-foreground/80 mt-2">Clique em &quot;Novo Túnel&quot; para começar</p>
                </div>
              ) : tuneisFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">Nenhum túnel nesta filial</p>
                  <p className="text-sm text-muted-foreground/80 mt-2">
                    Ajuste o filtro em &quot;Filtros&quot; ou cadastre um túnel para{" "}
                    <span className="font-medium text-foreground">{filialFilterApplied}</span>.
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-x-auto overflow-y-hidden -mx-2 sm:mx-0 touch-pan-x [&::-webkit-scrollbar]:h-2"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <Table className="min-w-[48rem]">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/40">
                        <TableHead className="font-bold whitespace-nowrap">Código</TableHead>
                        <TableHead className="font-bold min-w-[20rem] sm:min-w-[26rem] max-w-2xl">Filial</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Nome</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Cap. Máx. Túnel</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Status Operacional</TableHead>
                        <TableHead className="font-bold text-right whitespace-nowrap">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tuneisFiltrados.map((t) => (
                        <TableRow key={t.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-medium font-mono tabular-nums">{formatCodigoDocumentoDisplay(Number(t.code))}</TableCell>
                          <TableCell
                            className="min-w-[20rem] sm:min-w-[26rem] max-w-2xl whitespace-normal break-words align-top"
                            title={t.filial}
                          >
                            {t.filial}
                          </TableCell>
                          <TableCell>{t.name}</TableCell>
                          <TableCell className="tabular-nums">{formatCapacidadeBr(t.capacidadeMaximaTunel)}</TableCell>
                          <TableCell className="whitespace-nowrap">{labelStatusOperacional(t.statusOperacional)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDialog(t)}
                                className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 p-0"
                                aria-label="Editar túnel"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirmId(t.id)}
                                className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label="Excluir túnel"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTunel ? "Editar Túnel" : "Novo Túnel"}</DialogTitle>
            <DialogDescription>
              {editingTunel ? "Atualize as informações do túnel" : "Preencha os dados para cadastrar um novo túnel"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={formData.data} onChange={(e) => setFormData((p) => ({ ...p, data: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Filial</Label>
              <Select
                value={
                  formData.filial
                    ? formData.filial
                    : "__filial_placeholder__"
                }
                onValueChange={(v) => {
                  const filial = v === "__filial_placeholder__" ? "" : v;
                  setFormData((p) => ({
                    ...p,
                    filial,
                    ...(!editingTunel
                      ? {
                          codigoDocumento: formatCodigoDocumentoDisplay(
                            nextCodigoDocumentoForFilial(tuneis, filial)
                          ),
                        }
                      : {}),
                  }));
                }}
                disabled={filiais.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={filiais.length === 0 ? "Carregue filiais na OCTF" : "Selecione a filial"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__filial_placeholder__" disabled className="text-muted-foreground">
                    Selecione a filial
                  </SelectItem>
                  {formData.filial.trim() &&
                    !filiais.some((f) => (f.nome || "").trim() === formData.filial.trim()) && (
                      <SelectItem value={formData.filial.trim()}>{formData.filial.trim()}</SelectItem>
                    )}
                  {filiais.map((f) => (
                    <SelectItem key={f.id} value={(f.nome || "").trim()}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filiais.length === 0 || filiaisLoadError) && (
                <p className="text-xs text-muted-foreground">
                  {filiaisLoadError
                    ? filiaisLoadError
                    : "Cadastre filiais na tabela OCTF no Supabase (igual Produção e Planejamento)."}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input readOnly className="bg-muted font-mono tabular-nums" value={formData.codigoDocumento} />
              <p className="text-xs text-muted-foreground">
                {editingTunel
                  ? "O código é gerado automaticamente e não pode ser alterado."
                  : "Numeração por filial: ao trocar a filial, o próximo código recomeça em 0001 para aquela filial."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Capacidade Máxima do Túnel</Label>
              <Input
                inputMode="decimal"
                placeholder="Ex.: 8.300,00"
                value={formData.capacidadeMaximaTunel}
                onChange={(e) => {
                  const next = formatCapacidadeWhileTyping(e.target.value);
                  setFormData((p) => ({ ...p, capacidadeMaximaTunel: next }));
                }}
                onBlur={() => {
                  setFormData((p) => {
                    const raw = p.capacidadeMaximaTunel.trim();
                    if (!raw) return p;
                    return { ...p, capacidadeMaximaTunel: formatCapacidadeBr(parseBrazilNumber(p.capacidadeMaximaTunel)) };
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Status Operacional</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={formData.statusOperacional}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    statusOperacional: e.target.value as StatusOperacionalCode,
                  }))
                }
              >
                {STATUS_OPERACIONAL_CHOICES.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir túnel</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente excluir este túnel?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (deleteConfirmId == null) return;
              await deleteTunel(deleteConfirmId);
              octtLocalMutationAtRef.current = Date.now();
              setDeleteConfirmId(null);
              toast({ title: "Sucesso", description: "Túnel excluído." });
              await loadTuneis();
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
