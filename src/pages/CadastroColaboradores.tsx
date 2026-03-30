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
import { Users, Edit, Trash2, Loader2, Save } from "lucide-react";
import { getOCTCList, getFiliais, insertOCTC, updateOCTC, deleteOCTC, type OCTCRow } from "@/services/supabaseData";
import { FilialSelectField } from "@/components/FilialSelectField";
import { OctGradientCadastroLayout } from "@/components/cadastro/OctGradientCadastroLayout";
import { useToast } from "@/hooks/use-toast";

/** Próximo código numérico (0001, 0002, …) com base nos códigos já cadastrados que são só dígitos. */
function getNextCodigoDocumento(list: OCTCRow[]): string {
  const numeros = list
    .map((r) => {
      const t = String(r.codigoDoDocumento ?? "").trim();
      if (!/^\d+$/.test(t)) return NaN;
      return Number(t);
    })
    .filter((n) => !Number.isNaN(n) && n >= 0);
  const max = numeros.length ? Math.max(...numeros) : 0;
  return String(max + 1).padStart(4, "0");
}

const emptyForm = () => ({
  codigoDoDocumento: "",
  nomeDoColaborador: "",
  setor: "",
  filialNome: "",
});

export default function CadastroColaboradores() {
  const [rows, setRows] = useState<OCTCRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OCTCRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filiaisOctf, setFiliaisOctf] = useState<{ id: number; nome: string }[]>([]);
  const [filiaisOctfLoading, setFiliaisOctfLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOCTCList();
      setRows(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar colaboradores.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setFiliaisOctfLoading(true);
    getFiliais()
      .then((list) => {
        if (!cancelled) setFiliaisOctf(list.map((f) => ({ id: f.id, nome: f.nome })));
      })
      .catch(() => {
        if (!cancelled) setFiliaisOctf([]);
      })
      .finally(() => {
        if (!cancelled) setFiliaisOctfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      codigoDoDocumento: getNextCodigoDocumento(rows),
      nomeDoColaborador: "",
      setor: "",
      filialNome: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (r: OCTCRow) => {
    setEditing(r);
    setForm({
      codigoDoDocumento: r.codigoDoDocumento,
      nomeDoColaborador: r.nomeDoColaborador,
      setor: r.setor,
      filialNome: r.filialNome ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    const cod = form.codigoDoDocumento.trim();
    const nome = form.nomeDoColaborador.trim();
    const setor = form.setor.trim();
    if (!cod || !nome || !setor) {
      toast({
        title: "Validação",
        description: "Preencha código do documento, nome do colaborador e setor.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        codigoDoDocumento: cod,
        nomeDoColaborador: nome,
        setor,
        filialNome: form.filialNome.trim(),
      };
      if (editing) await updateOCTC(editing.id, payload);
      else await insertOCTC(payload);
      toast({
        title: "Sucesso",
        description: editing ? "Registro atualizado." : "Colaborador cadastrado.",
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
      await deleteOCTC(deleteId);
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
      title="Cadastro de Colaboradores"
      description='Tabela OCTC — código do documento (0001…), nome, setor e filial'
      icon={Users}
      newButtonLabel="Novo colaborador"
      onNew={openNew}
      loading={loading}
      isEmpty={rows.length === 0}
      emptyTitle="Nenhum colaborador cadastrado"
      emptyHint='Clique em "Novo colaborador" para começar'
      table={
        <div
          className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-x-auto overflow-y-hidden -mx-2 sm:mx-0 touch-pan-x [&::-webkit-scrollbar]:h-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/40">
                <TableHead className="font-bold whitespace-nowrap min-w-[140px]">Cód. documento</TableHead>
                <TableHead className="font-bold whitespace-nowrap">Nome</TableHead>
                <TableHead className="font-bold whitespace-nowrap">Setor</TableHead>
                <TableHead className="font-bold whitespace-nowrap min-w-[120px]">Filial</TableHead>
                <TableHead className="font-bold text-right whitespace-nowrap">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-mono text-sm max-w-[200px] truncate" title={r.codigoDoDocumento}>
                    {r.codigoDoDocumento}
                  </TableCell>
                  <TableCell className="font-medium">{r.nomeDoColaborador}</TableCell>
                  <TableCell>{r.setor}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={r.filialNome || undefined}>
                    {r.filialNome?.trim() ? r.filialNome : "—"}
                  </TableCell>
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
                <DialogTitle>{editing ? "Editar colaborador" : "Novo colaborador"}</DialogTitle>
                <DialogDescription>
                  {editing
                    ? "Atualize os dados na tabela OCTC."
                    : "O código do documento é gerado em sequência (0001, 0002…). Você pode ajustar manualmente se precisar."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="octc-cod-doc">Código do documento *</Label>
                  <Input
                    id="octc-cod-doc"
                    className="font-mono text-sm"
                    value={form.codigoDoDocumento}
                    onChange={(e) => setForm((p) => ({ ...p, codigoDoDocumento: e.target.value }))}
                    placeholder="Ex.: 0001"
                    disabled={saving}
                    maxLength={60}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="octc-nome">Nome do colaborador *</Label>
                  <Input
                    id="octc-nome"
                    value={form.nomeDoColaborador}
                    onChange={(e) => setForm((p) => ({ ...p, nomeDoColaborador: e.target.value }))}
                    placeholder="Nome completo"
                    disabled={saving}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="octc-setor">Setor *</Label>
                  <Input
                    id="octc-setor"
                    value={form.setor}
                    onChange={(e) => setForm((p) => ({ ...p, setor: e.target.value }))}
                    placeholder="Ex.: Empacotamento"
                    disabled={saving}
                    maxLength={30}
                  />
                </div>
                <FilialSelectField
                  id="octc-filial"
                  label="Filial"
                  value={form.filialNome}
                  onChange={(nome) => setForm((p) => ({ ...p, filialNome: nome }))}
                  filiais={filiaisOctf}
                  loading={filiaisOctfLoading}
                  disabled={saving}
                  hint="Opcional. Mesma lista de filiais cadastradas na OCTF (padrão das demais telas)."
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={closeDialog} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleSave()}
                  disabled={saving || !form.codigoDoDocumento.trim() || !form.nomeDoColaborador.trim() || !form.setor.trim()}
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
                <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O registro será removido da tabela OCTC.
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
