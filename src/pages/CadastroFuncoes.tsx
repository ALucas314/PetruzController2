import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Briefcase, Edit, Trash2, Loader2, Save } from "lucide-react";
import { getOCTRFList, insertOCTRF, updateOCTRF, deleteOCTRF, type OCTRFRow } from "@/services/supabaseData";
import { OctGradientCadastroLayout } from "@/components/cadastro/OctGradientCadastroLayout";
import { useToast } from "@/hooks/use-toast";

function getNextNumeroDocumento(list: OCTRFRow[]): string {
  const numeros = list
    .map((r) => {
      const t = String(r.numeroDoDocumento ?? "").trim();
      if (!/^\d+$/.test(t)) return NaN;
      return Number(t);
    })
    .filter((n) => !Number.isNaN(n) && n >= 0);
  const max = numeros.length ? Math.max(...numeros) : 0;
  return String(max + 1).padStart(4, "0");
}

const emptyForm = () => ({
  numeroDoDocumento: "",
  nomeDaFuncao: "",
});

export default function CadastroFuncoes() {
  const [rows, setRows] = useState<OCTRFRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OCTRFRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOCTRFList();
      setRows(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar funções.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({
      numeroDoDocumento: getNextNumeroDocumento(rows),
      nomeDaFuncao: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (r: OCTRFRow) => {
    setEditing(r);
    setForm({
      numeroDoDocumento: r.numeroDoDocumento,
      nomeDaFuncao: r.nomeDaFuncao,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    const num = form.numeroDoDocumento.trim();
    const nome = form.nomeDaFuncao.trim();
    if (!num || !nome) {
      toast({
        title: "Validação",
        description: "Preencha número do documento e nome da função.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const payload = { numeroDoDocumento: num, nomeDaFuncao: nome };
      if (editing) await updateOCTRF(editing.id, payload);
      else await insertOCTRF(payload);
      toast({
        title: "Sucesso",
        description: editing ? "Registro atualizado." : "Função cadastrada.",
      });
      closeDialog();
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      await deleteOCTRF(deleteId);
      toast({ title: "Sucesso", description: "Registro excluído." });
      setDeleteId(null);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  return (
    <OctGradientCadastroLayout
      title="Cadastro de funções"
      description="Tabela OCTRF — número do documento (0001…) e nome da função"
      icon={Briefcase}
      newButtonLabel="Nova função"
      onNew={openNew}
      loading={loading}
      isEmpty={rows.length === 0}
      emptyTitle="Nenhuma função cadastrada"
      emptyHint='Clique em "Nova função" para começar'
      table={
        <div
          className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-x-auto overflow-y-hidden -mx-2 sm:mx-0 touch-pan-x [&::-webkit-scrollbar]:h-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/40">
                <TableHead className="font-bold whitespace-nowrap min-w-[140px]">Nº documento</TableHead>
                <TableHead className="font-bold whitespace-nowrap">Nome da função</TableHead>
                <TableHead className="font-bold text-right whitespace-nowrap">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-mono text-sm max-w-[200px] truncate" title={r.numeroDoDocumento}>
                    {r.numeroDoDocumento}
                  </TableCell>
                  <TableCell className="font-medium">{r.nomeDaFuncao}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(r)}
                        className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 p-0"
                        aria-label="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteId(r.id)}
                        className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        aria-label="Excluir"
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
      }
      footer={
        <>
          <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar função" : "Nova função"}</DialogTitle>
                <DialogDescription>
                  {editing
                    ? "Atualize os dados na tabela OCTRF."
                    : "O número do documento é gerado em sequência (0001, 0002…). Você pode ajustar manualmente se precisar."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="octrf-num-doc">Número do documento *</Label>
                  <Input
                    id="octrf-num-doc"
                    className="font-mono text-sm"
                    value={form.numeroDoDocumento}
                    onChange={(e) => setForm((p) => ({ ...p, numeroDoDocumento: e.target.value }))}
                    placeholder="Ex.: 0001"
                    disabled={saving}
                    maxLength={60}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="octrf-nome">Nome da função *</Label>
                  <Input
                    id="octrf-nome"
                    value={form.nomeDaFuncao}
                    onChange={(e) => setForm((p) => ({ ...p, nomeDaFuncao: e.target.value }))}
                    placeholder="Ex.: Operador de linha"
                    disabled={saving}
                    maxLength={120}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={closeDialog} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleSave()}
                  disabled={saving || !form.numeroDoDocumento.trim() || !form.nomeDaFuncao.trim()}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {editing ? "Atualizar" : "Cadastrar"}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir função?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O registro será removido da tabela OCTRF.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => void handleDelete()}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      }
    />
  );
}
