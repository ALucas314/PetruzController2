import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Loader2, AlertCircle, Save, Tags, Filter } from "lucide-react";
import { FILIAL_PLACEHOLDER_LABEL, FILIAL_PLACEHOLDER_VALUE } from "@/lib/filialSelect";
import { useToast } from "@/hooks/use-toast";
import {
  createTipoProduto,
  deleteTipoProduto,
  getFiliais,
  getTiposProduto,
  updateTipoProduto,
  type CDTPRow,
} from "@/services/supabaseData";

type TipoRow = CDTPRow;
type FilialOption = { id: number; codigo: string; nome: string; endereco: string };

function filialNorm(s: string): string {
  return (s || "").trim();
}

const CODIGO_DOCUMENTO_DIGITS = 4;

function formatCodigoDocumentoDisplay(n: number): string {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || v < 1) return "0".repeat(CODIGO_DOCUMENTO_DIGITS);
  return String(v).padStart(CODIGO_DOCUMENTO_DIGITS, "0");
}

function nextCodigoDocumentoForFilial(rows: TipoRow[], filialNome: string): number {
  const key = filialNorm(filialNome);
  const nums = rows
    .filter((t) => filialNorm(t.filial) === key)
    .map((t) => Number(String(t.code ?? "").replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

/** Ex.: 150 → "2:30" (horas podem ter mais de 2 dígitos). */
function formatMinutesAsHMM(total: number): string {
  const v = Math.max(0, Math.trunc(Number(total)));
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function parseColonHHMMToMinutes(input: string): number {
  const s = input.trim();
  const [a, b = "0"] = s.split(":");
  const h = parseInt((a || "").replace(/\D/g, "") || "0", 10) || 0;
  const m = parseInt((b || "").replace(/\D/g, "").slice(0, 2) || "0", 10) || 0;
  return h * 60 + Math.min(59, Math.max(0, m));
}

/**
 * Aceita com dois-pontos ("10:30") ou só dígitos no padrão relógio:
 * "1030" → 10h30, "130" → 1h30, "45" → 45 min, "5" → 5 min.
 */
function parseTempoInputToMinutes(input: string): number {
  const s = input.trim();
  if (!s) return 0;
  if (s.includes(":")) {
    return parseColonHHMMToMinutes(s);
  }
  const d = s.replace(/\D/g, "");
  if (!d) return 0;
  if (d.length === 1) {
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? Math.min(9, Math.max(0, n)) : 0;
  }
  if (d.length === 2) {
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? Math.min(99, Math.max(0, n)) : 0;
  }
  if (d.length === 3) {
    const h = parseInt(d[0], 10);
    const m = parseInt(d.slice(1), 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    return h * 60 + Math.min(59, Math.max(0, m));
  }
  const m = parseInt(d.slice(-2), 10);
  const h = parseInt(d.slice(0, -2), 10) || 0;
  if (!Number.isFinite(m)) return 0;
  return Math.max(0, h) * 60 + Math.min(59, Math.max(0, m));
}

function formatTempoInputDisplay(input: string): string {
  return formatMinutesAsHMM(parseTempoInputToMinutes(input));
}

export default function CadastroTipoProduto() {
  const [rows, setRows] = useState<TipoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TipoRow | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    codigoDocumento: string;
    filial: string;
    nome: string;
    descricaoProduto: string;
    tempoCongelamentoHHMM: string;
  }>({
    codigoDocumento: "",
    filial: "",
    nome: "",
    descricaoProduto: "",
    tempoCongelamentoHHMM: "0:00",
  });
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [filiaisLoadError, setFiliaisLoadError] = useState<string | null>(null);
  const [filialFilterApplied, setFilialFilterApplied] = useState<string>("");
  const [filialFilterPending, setFilialFilterPending] = useState<string>("");
  const [filtrosDialogOpen, setFiltrosDialogOpen] = useState(false);
  const { toast } = useToast();

  const filiaisFiltroOpcoes = useMemo(() => {
    const s = new Set<string>();
    for (const t of rows) {
      const f = filialNorm(t.filial);
      if (f) s.add(f);
    }
    for (const row of filiais) {
      const n = filialNorm(row.nome || "");
      if (n) s.add(n);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows, filiais]);

  const rowsFiltrados = useMemo(() => {
    const key = filialNorm(filialFilterApplied);
    if (!key) return rows;
    return rows.filter((t) => filialNorm(t.filial) === key);
  }, [rows, filialFilterApplied]);

  useEffect(() => {
    if (filtrosDialogOpen) setFilialFilterPending(filialFilterApplied);
  }, [filtrosDialogOpen, filialFilterApplied]);

  useEffect(() => {
    void loadRows();
  }, []);

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

  const loadRows = async () => {
    try {
      setLoading(true);
      const data = await getTiposProduto();
      const list = [...data];
      list.sort((a, b) => {
        const fa = filialNorm(a.filial);
        const fb = filialNorm(b.filial);
        if (fa !== fb) return fa.localeCompare(fb, "pt-BR");
        return Number(a.code || 0) - Number(b.code || 0);
      });
      setRows(list);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao carregar tipos de produto.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (row?: TipoRow) => {
    if (row) {
      setEditing(row);
      const codigoEdicao = Number(String(row.code ?? "").replace(/\D/g, ""));
      const codigoPadded = formatCodigoDocumentoDisplay(
        Number.isFinite(codigoEdicao) && codigoEdicao >= 1
          ? codigoEdicao
          : nextCodigoDocumentoForFilial(rows, row.filial)
      );
      setFormData({
        codigoDocumento: codigoPadded,
        filial: row.filial,
        nome: row.nome,
        descricaoProduto: row.descricaoProduto,
        tempoCongelamentoHHMM: formatMinutesAsHMM(row.tempoMaxCongelamentoMinutos),
      });
    } else {
      setEditing(null);
      setFormData({
        codigoDocumento: formatCodigoDocumentoDisplay(nextCodigoDocumentoForFilial(rows, "")),
        filial: "",
        nome: "",
        descricaoProduto: "",
        tempoCongelamentoHHMM: "0:00",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const nomeTrim = formData.nome.trim();
    const filialTrim = formData.filial.trim();
    const codigoStr = formData.codigoDocumento.replace(/\D/g, "");
    const codigoNum = codigoStr === "" ? NaN : Number(codigoStr);
    const mins = parseTempoInputToMinutes(formData.tempoCongelamentoHHMM);
    if (!Number.isFinite(codigoNum) || codigoNum < 1 || !Number.isInteger(codigoNum)) {
      toast({ title: "Validação", description: "Informe um Código válido (inteiro a partir de 1).", variant: "destructive" });
      return;
    }
    if (!nomeTrim || !filialTrim) {
      toast({ title: "Validação", description: "Preencha Nome e Filial.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateTipoProduto(editing.id, {
          codigo_documento: codigoNum,
          filial_nome: filialTrim,
          nome: nomeTrim,
          descricao_produto: formData.descricaoProduto.trim(),
          tempo_max_congelamento_minutos: mins,
        });
      } else {
        await createTipoProduto({
          codigo_documento: codigoNum,
          filial_nome: filialTrim,
          nome: nomeTrim,
          descricao_produto: formData.descricaoProduto.trim(),
          tempo_max_congelamento_minutos: mins,
        });
      }
      setIsDialogOpen(false);
      toast({ title: "Sucesso", description: editing ? "Tipo de produto atualizado." : "Tipo de produto cadastrado." });
      await loadRows();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao salvar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
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
                  <Tags className="relative h-7 w-7 text-primary drop-shadow-lg" />
                </div>
                <div className="text-center sm:text-left space-y-2 min-w-0">
                  <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                    Cadastro de tipo de produtos
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground/80 font-medium">
                    Tabela CDTP — filial, código, tempo máx. de congelamento (horas:minutos), nome e descrição
                  </CardDescription>
                </div>
              </div>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row justify-center sm:justify-end items-stretch sm:items-center gap-2 shrink-0">
                <Dialog open={filtrosDialogOpen} onOpenChange={setFiltrosDialogOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium border border-input bg-background hover:bg-muted/50 shrink-0 w-full sm:w-auto"
                      aria-label="Abrir filtros por filial"
                      aria-haspopup="dialog"
                      aria-expanded={filtrosDialogOpen}
                    >
                      <Filter className="h-4 w-4 shrink-0" />
                      <span>Filtros</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="w-[340px] sm:w-[380px] max-w-[95vw] p-4 rounded-lg">
                    <DialogHeader>
                      <DialogTitle className="text-base">Filtros — Tipo de produtos</DialogTitle>
                      <DialogDescription className="text-sm text-muted-foreground">
                        Filtre a lista por filial. Clique em Filtrar para aplicar.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                        <Label htmlFor="cdtp-dialog-filial" className="text-xs text-muted-foreground whitespace-nowrap">
                          Filial
                        </Label>
                        <Select
                          value={filialNorm(filialFilterPending) ? filialFilterPending : "__todas__"}
                          onValueChange={(v) => setFilialFilterPending(v === "__todas__" ? "" : v)}
                        >
                          <SelectTrigger id="cdtp-dialog-filial" className="h-9 text-sm">
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
                      <Button type="button" variant="outline" className="flex-1 h-9" onClick={() => setFilialFilterPending("")}>
                        Limpar
                      </Button>
                      <Button
                        type="button"
                        className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => {
                          setFilialFilterApplied(filialFilterPending);
                          setFiltrosDialogOpen(false);
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
                  Novo tipo
                </Button>
              </div>
            </CardHeader>

            <CardContent className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-4 sm:p-5 lg:p-7">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">Nenhum tipo de produto cadastrado</p>
                  <p className="text-sm text-muted-foreground/80 mt-2">Clique em &quot;Novo tipo&quot; para começar</p>
                </div>
              ) : rowsFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">Nenhum registro nesta filial</p>
                  <p className="text-sm text-muted-foreground/80 mt-2">
                    Ajuste o filtro ou cadastre um tipo para{" "}
                    <span className="font-medium text-foreground">{filialFilterApplied}</span>.
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-x-auto overflow-y-hidden -mx-2 sm:mx-0 touch-pan-x [&::-webkit-scrollbar]:h-2"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <Table className="min-w-[52rem]">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/40">
                        <TableHead className="font-bold whitespace-nowrap">Código</TableHead>
                        <TableHead className="font-bold min-w-[18rem] sm:min-w-[22rem] max-w-2xl">Filial</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Nome</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Tempo máx. cong.</TableHead>
                        <TableHead className="font-bold min-w-[12rem] max-w-md">Descrição</TableHead>
                        <TableHead className="font-bold text-right whitespace-nowrap">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rowsFiltrados.map((t) => (
                        <TableRow key={t.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-medium font-mono tabular-nums">
                            {formatCodigoDocumentoDisplay(Number(t.code))}
                          </TableCell>
                          <TableCell
                            className="min-w-[18rem] sm:min-w-[22rem] max-w-2xl whitespace-normal break-words align-top"
                            title={t.filial}
                          >
                            {t.filial}
                          </TableCell>
                          <TableCell>{t.nome}</TableCell>
                          <TableCell className="font-mono tabular-nums whitespace-nowrap">
                            {formatMinutesAsHMM(t.tempoMaxCongelamentoMinutos)}
                          </TableCell>
                          <TableCell className="max-w-md text-sm text-muted-foreground truncate" title={t.descricaoProduto || undefined}>
                            {t.descricaoProduto || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDialog(t)}
                                className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 p-0"
                                aria-label="Editar tipo de produto"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirmId(t.id)}
                                className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label="Excluir tipo de produto"
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
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tipo de produto" : "Novo tipo de produto"}</DialogTitle>
            <DialogDescription>
              {editing ? "Atualize os dados do tipo de produto" : "Preencha os campos para cadastrar"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Filial</Label>
              <Select
                value={formData.filial ? formData.filial : FILIAL_PLACEHOLDER_VALUE}
                onValueChange={(v) => {
                  const filial = v === FILIAL_PLACEHOLDER_VALUE ? "" : v;
                  setFormData((p) => ({
                    ...p,
                    filial,
                    ...(!editing
                      ? {
                          codigoDocumento: formatCodigoDocumentoDisplay(nextCodigoDocumentoForFilial(rows, filial)),
                        }
                      : {}),
                  }));
                }}
                disabled={filiais.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={filiais.length === 0 ? "Carregue filiais na OCTF" : FILIAL_PLACEHOLDER_LABEL}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILIAL_PLACEHOLDER_VALUE} disabled>
                    {FILIAL_PLACEHOLDER_LABEL}
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
                {editing
                  ? "O código não pode ser alterado manualmente."
                  : "Numeração por filial: ao trocar a filial, o próximo código recomeça em 0001."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tempo máximo de congelamento (horas:minutos)</Label>
              <Input
                className="font-mono tabular-nums"
                placeholder="Ex.: 10:30 ou 1030"
                value={formData.tempoCongelamentoHHMM}
                onChange={(e) => setFormData((p) => ({ ...p, tempoCongelamentoHHMM: e.target.value }))}
                onBlur={() =>
                  setFormData((p) => ({
                    ...p,
                    tempoCongelamentoHHMM: formatTempoInputDisplay(p.tempoCongelamentoHHMM),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={formData.nome} onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descrição do produto</Label>
              <Textarea
                rows={4}
                className="resize-y min-h-[80px]"
                value={formData.descricaoProduto}
                onChange={(e) => setFormData((p) => ({ ...p, descricaoProduto: e.target.value }))}
                placeholder="Descrição opcional"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de produto</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente excluir este registro?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteConfirmId == null) return;
                await deleteTipoProduto(deleteConfirmId);
                setDeleteConfirmId(null);
                toast({ title: "Sucesso", description: "Registro excluído." });
                await loadRows();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
