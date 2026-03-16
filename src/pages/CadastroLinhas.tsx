import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, Plus, Edit, Trash2, Loader2, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { getLines, createLine, updateLine, deleteLine } from "@/services/supabaseData";
import { useToast } from "@/hooks/use-toast";

interface Linha {
    id: number;
    line_id?: number;
    code: string;
    name: string;
}

export default function CadastroLinhas() {
    const [linhas, setLinhas] = useState<Linha[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingLinha, setEditingLinha] = useState<Linha | null>(null);
    const [formData, setFormData] = useState({ code: "", name: "" });
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const { toast } = useToast();

    // Carregar linhas
    useEffect(() => {
        loadLinhas();
    }, []);

    const loadLinhas = async () => {
        try {
            setLoading(true);
            const data = await getLines();
            const list = data.map((l) => ({ id: l.id as number, line_id: l.line_id as number, code: String(l.code ?? ""), name: String(l.name ?? "") }));
            // Ordenar por código: numérico do menor ao maior (1, 2, 3, ..., 10, 11), depois alfabético
            list.sort((a, b) => {
                const na = Number(a.code);
                const nb = Number(b.code);
                if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
                if (!Number.isNaN(na)) return -1;
                if (!Number.isNaN(nb)) return 1;
                return a.code.localeCompare(b.code, undefined, { numeric: true });
            });
            setLinhas(list);
        } catch (error: any) {
            console.error("Erro ao carregar linhas:", error);
            toast({
                title: "Erro",
                description: error?.message || "Erro ao carregar linhas",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (linha?: Linha) => {
        if (linha) {
            setEditingLinha(linha);
            setFormData({ code: linha.code, name: linha.name });
        } else {
            setEditingLinha(null);
            setFormData({ code: "", name: "" });
        }
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingLinha(null);
        setFormData({ code: "", name: "" });
    };

    // Próximo código automático: maior código numérico + 1 (ex: 1,2,3,10 → 11)
    const getNextCode = (list: Linha[]): string => {
        const numeros = list.map((l) => Number(l.code)).filter((n) => !Number.isNaN(n) && n >= 0);
        const max = numeros.length ? Math.max(...numeros) : 0;
        return String(max + 1);
    };

    const handleSave = async () => {
        const nameTrim = formData.name.trim();
        if (!nameTrim) {
            toast({
                title: "Validação",
                description: "Preencha a descrição da linha",
                variant: "destructive",
            });
            return;
        }

        // Nome duplicado
        const nameLower = nameTrim.toLowerCase();
        const isDuplicateName = linhas.some(
            (linha) =>
                linha.name.toLowerCase() === nameLower &&
                (!editingLinha || linha.id !== editingLinha.id)
        );
        if (isDuplicateName) {
            toast({
                title: "Validação",
                description: "Já existe uma linha com esta descrição",
                variant: "destructive",
            });
            return;
        }

        try {
            setSaving(true);
            if (editingLinha) {
                await updateLine(editingLinha.id, { Name: nameTrim });
            } else {
                const codeAuto = getNextCode(linhas);
                await createLine({ Code: codeAuto, Name: nameTrim });
            }

            {
                toast({
                    title: "Sucesso",
                    description: editingLinha
                        ? "Linha atualizada com sucesso"
                        : "Linha cadastrada com sucesso",
                });
                handleCloseDialog();
                loadLinhas();
            }
        } catch (error: any) {
            console.error("Erro ao salvar linha:", error);
            toast({
                title: "Erro",
                description: error?.message || "Erro ao salvar linha",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteLine(id);
            setDeleteConfirmId(null);
            toast({
                title: "Sucesso",
                description: "Linha excluída com sucesso",
            });
            loadLinhas();
        } catch (error: any) {
            console.error("Erro ao excluir linha:", error);
            const errorMessage = error?.message || "Erro ao excluir linha";
            toast({
                title: "Erro de Conexão",
                description: errorMessage,
                variant: "destructive",
            });
        }
    };

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Card: Cadastro de Linhas */}
                <Card className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] transition-all duration-500 overflow-hidden group/card">
                    {/* Efeito de brilho sutil */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
                    {/* Borda superior com gradiente */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

                    <div className="relative z-10">
                        <CardHeader className="relative w-full flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 sm:p-8 transition-all duration-500 group/button bg-gradient-to-r from-transparent via-primary/2 to-transparent gap-4 sm:gap-0">
                            <div className="flex items-center gap-5 w-full sm:w-auto justify-center sm:justify-start">
                                {/* Ícone com efeito glassmorphism melhorado */}
                                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                                    <Factory className="relative h-7 w-7 text-primary drop-shadow-lg" />
                                </div>

                                <div className="text-center sm:text-left space-y-2">
                                    <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                                        Cadastro de Linhas de Produção
                                    </CardTitle>
                                    <CardDescription className="text-sm text-muted-foreground/80 font-medium">
                                        Gerencie as linhas de produção do sistema
                                    </CardDescription>
                                </div>
                            </div>

                            <div className="w-full sm:w-auto flex justify-center sm:justify-end">
                                <Button
                                    onClick={() => handleOpenDialog()}
                                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Nova Linha</span>
                                    <span className="sm:hidden">Nova Linha</span>
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-4 sm:p-5 lg:p-7">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : linhas.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground font-medium">
                                        Nenhuma linha cadastrada
                                    </p>
                                    <p className="text-sm text-muted-foreground/80 mt-2">
                                        Clique em "Nova Linha" para começar
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-x-auto overflow-y-hidden -mx-2 sm:mx-0 touch-pan-x [&::-webkit-scrollbar]:h-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                                    <Table className="min-w-[280px]">
                                        <TableHeader>
                                            <TableRow className="bg-muted/30 hover:bg-muted/40">
                                                <TableHead className="font-bold whitespace-nowrap">Código</TableHead>
                                                <TableHead className="font-bold whitespace-nowrap">Descrição</TableHead>
                                                <TableHead className="font-bold text-right whitespace-nowrap">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {linhas.map((linha) => (
                                                <TableRow
                                                    key={linha.id}
                                                    className="hover:bg-muted/20 transition-colors"
                                                >
                                                    <TableCell className="font-medium">{linha.code}</TableCell>
                                                    <TableCell>{linha.name}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleOpenDialog(linha)}
                                                                className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 p-0"
                                                                aria-label="Editar linha"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setDeleteConfirmId(linha.id)}
                                                                className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                aria-label="Excluir linha"
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

            {/* Dialog de Cadastro/Edição */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingLinha ? "Editar Linha" : "Nova Linha"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingLinha
                                ? "Atualize as informações da linha de produção"
                                : "Preencha os dados para cadastrar uma nova linha"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {editingLinha && (
                            <div className="space-y-2">
                                <Label>Código</Label>
                                <Input
                                    value={editingLinha.code}
                                    disabled
                                    readOnly
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground">
                                    O código é gerado automaticamente e não pode ser alterado.
                                </p>
                            </div>
                        )}

                        {!editingLinha && (
                            <p className="text-xs text-muted-foreground">
                                O código da linha será gerado automaticamente (próximo número disponível).
                            </p>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="name">Descrição *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                                }
                                placeholder="Ex: MIX - Tetra Pak + Tropical"
                                disabled={saving}
                                maxLength={255}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={handleCloseDialog}
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !formData.name.trim()}
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
                                    {editingLinha ? "Atualizar" : "Cadastrar"}
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
