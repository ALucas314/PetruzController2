import { useState, useRef, useEffect } from "react";
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
import { getItemByCode } from "@/services/supabaseData";
import { Plus, Trash2, Factory, Download, Calendar, FileText, Clock } from "lucide-react";
import { toPng } from "html-to-image";

interface PlanejamentoItem {
    id: number;
    numero: number;
    linhas: string;
    invoice: string;
    cod: string;
    item: string;
    linha: string;
    capacidade: number;
    latas: number;
    corte: number;
    programado: number;
    realizado: number;
    diferenca: number;
}

export default function PlanejamentoPCP() {
    const planejamentoCardRef = useRef<HTMLDivElement>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [dia, setDia] = useState("");
    const [data, setData] = useState("");

    const [items, setItems] = useState<PlanejamentoItem[]>([
        {
            id: 1,
            numero: 1,
            linhas: "",
            invoice: "",
            cod: "",
            item: "",
            linha: "",
            capacidade: 0,
            latas: 0,
            corte: 0,
            programado: 0,
            realizado: 0,
            diferenca: 0,
        },
    ]);

    // Atualizar relógio em tempo real
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Formatar hora atual
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    // Formatar data atual
    const formatDate = (date: Date) => {
        return date.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    };

    // Adicionar nova linha
    const addItem = () => {
        const newNumero = items.length > 0 ? Math.max(...items.map((i) => i.numero)) + 1 : 1;
        const newItem: PlanejamentoItem = {
            id: Date.now(),
            numero: newNumero,
            linhas: "",
            invoice: "",
            cod: "",
            item: "",
            linha: "",
            capacidade: 0,
            latas: 0,
            corte: 0,
            programado: 0,
            realizado: 0,
            diferenca: 0,
        };
        setItems((prevItems) => [...prevItems, newItem]);
    };

    // Remover linha
    const removeItem = (id: number) => {
        if (items.length > 1) {
            const newItems = items.filter((item) => item.id !== id);
            // Renumerar itens
            const renumberedItems = newItems.map((item, index) => ({
                ...item,
                numero: index + 1,
            }));
            setItems(renumberedItems);
        }
    };

    // Formatar número com separador de milhar
    const formatNumber = (value: number | string | null | undefined): string => {
        if (value === null || value === undefined || value === "" || value === 0) return "";

        // Se for número, formatar diretamente
        if (typeof value === "number") {
            const parts = value.toString().split(".");
            const integerPart = parts[0];
            const decimalPart = parts[1] || "";
            const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
        }

        // Se for string, limpar e formatar
        const cleaned = value.replace(/\./g, "").replace(",", ".");
        const numValue = parseFloat(cleaned);
        if (isNaN(numValue) || numValue === 0) return "";

        const parts = numValue.toString().split(".");
        const integerPart = parts[0];
        const decimalPart = parts[1] || "";
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
    };

    // Formatar número para totais (sempre mostra 2 casas decimais)
    const formatTotal = (value: number): string => {
        const numValue = value || 0;
        const parts = numValue.toFixed(2).split(".");
        const integerPart = parts[0];
        const decimalPart = parts[1] || "00";
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return `${formattedInteger},${decimalPart}`;
    };

    // Remover formatação e converter para número
    const parseFormattedNumber = (value: string): number => {
        if (!value) return 0;
        // Remove pontos (separador de milhar) e substitui vírgula por ponto
        const cleaned = value.replace(/\./g, "").replace(",", ".");
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    };

    // Atualizar item (trata campos numéricos e de texto separadamente)
    const updateItem = (id: number, field: keyof PlanejamentoItem, value: string | number) => {
        const numericFields: (keyof PlanejamentoItem)[] = ["capacidade", "latas", "corte", "programado", "realizado", "diferenca"];
        setItems((prevItems) =>
            prevItems.map((item) => {
                if (item.id !== id) return item;

                const updated: PlanejamentoItem = { ...item };

                if (numericFields.includes(field)) {
                    let numValue: number;
                    if (typeof value === "string") {
                        if (value === "" || value.trim() === "") {
                            numValue = 0;
                        } else {
                            numValue = parseFormattedNumber(value);
                        }
                    } else {
                        numValue = value;
                    }
                    (updated as any)[field] = numValue;

                    // Diferença = Realizado - Programado
                    if (field === "programado" || field === "realizado") {
                        const programado = field === "programado" ? numValue : updated.programado;
                        const realizado = field === "realizado" ? numValue : updated.realizado;
                        updated.diferenca = realizado - programado;
                    }
                } else {
                    // Campos de texto: linhas, invoice, cod, item, linha
                    (updated as any)[field] = typeof value === "string" ? value : String(value);
                }

                return updated;
            })
        );
    };

    // Quando digitar o código, buscar descrição do item na OCTI e preencher o campo Item
    const handleCodBlur = async (id: number, rawValue: string) => {
        const code = (rawValue || "").trim();

        // Atualiza o código no estado
        updateItem(id, "cod", rawValue);

        if (!code) {
            // Se limpar o código, também limpa a descrição do item
            updateItem(id, "item", "");
            return;
        }

        try {
            const result = await getItemByCode(code);
            if (result && result.nome_item) {
                const nome = result.nome_item as string;
                setItems((prev) =>
                    prev.map((item) => (item.id === id ? { ...item, item: nome } : item))
                );
            }
        } catch (e) {
            console.error("Erro ao buscar item por código no planejamento PCP:", e);
        }
    };

    // Calcular totais
    const calcularTotais = () => {
        const totalCapacidade = items.reduce((sum, item) => sum + (item.capacidade || 0), 0);
        const totalCorte = items.reduce((sum, item) => sum + (item.corte || 0), 0);
        const totalProgramado = items.reduce((sum, item) => sum + (item.programado || 0), 0);
        const totalRealizado = items.reduce((sum, item) => sum + (item.realizado || 0), 0);
        // Diferença = Realizado - Programado (Positivo = feito a mais, Negativo = feito a menos)
        const diferencaTotal = totalRealizado - totalProgramado;
        const eficiencia = totalProgramado > 0 ? (totalRealizado / totalProgramado) * 100 : 0;

        return {
            totalCapacidade,
            totalCorte,
            totalProgramado,
            totalRealizado,
            diferencaTotal,
            eficiencia,
        };
    };

    // Função para exportar planejamento como PNG
    const exportPlanejamentoAsPNG = async () => {
        if (!planejamentoCardRef.current) return;

        try {
            await new Promise((resolve) => setTimeout(resolve, 400));

            const element = planejamentoCardRef.current;

            // Capturar o elemento usando html-to-image
            const dataUrl = await toPng(element, {
                backgroundColor: "#ffffff",
                pixelRatio: 2,
                quality: 1.0,
                cacheBust: true,
                skipAutoScale: false,
                skipFonts: false,
                filter: (node) => {
                    return true;
                },
            });

            // Criar imagem a partir do data URL
            const img = new Image();
            img.src = dataUrl;

            await new Promise((resolve) => {
                img.onload = () => {
                    // Criar canvas com padding
                    const padding = 40;
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width + padding * 2;
                    canvas.height = img.height + padding * 2;
                    const ctx = canvas.getContext("2d");

                    if (ctx) {
                        // Fundo branco
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Desenhar a imagem com padding
                        ctx.drawImage(img, padding, padding);
                    }

                    // Download
                    const link = document.createElement("a");
                    link.download = `planejamento-pcp-${new Date().toISOString().split("T")[0]}.png`;
                    link.href = canvas.toDataURL("image/png", 1.0);
                    link.click();
                    resolve(undefined);
                };
            });
        } catch (error) {
            console.error("Erro ao exportar planejamento:", error);
        }
    };


    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Card: Planejamento PCP */}
                <div
                    ref={planejamentoCardRef}
                    data-export-target
                    className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] transition-all duration-500 overflow-hidden group/card"
                >
                    {/* Efeito de brilho sutil */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
                    {/* Borda superior com gradiente */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

                    <div className="relative z-10">
                        <div className="relative w-full flex items-center justify-between p-6 sm:p-8 transition-all duration-500 group/button bg-gradient-to-r from-transparent via-primary/2 to-transparent">
                            <div className="flex items-center gap-5">
                                {/* Ícone com efeito glassmorphism melhorado */}
                                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                                    <FileText className="relative h-7 w-7 text-primary drop-shadow-lg" />
                                </div>

                                <div className="text-left space-y-2">
                                    <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                                        Planejamento de Controle de Produção (PCP)
                                    </h2>
                                    <p className="text-sm text-muted-foreground/80 font-medium">
                                        Programação e controle de produção
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1">
                                        <div className="flex items-center gap-2.5">
                                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary/70" />
                                            <span className="text-sm sm:text-base font-mono font-semibold text-primary">
                                                {formatTime(currentTime)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/70" />
                                            <span className="text-sm sm:text-base text-muted-foreground/90 font-medium capitalize">
                                                {formatDate(currentTime)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Botões de ação */}
                            <div className="flex items-center gap-2">
                                {/* Botão de exportação melhorado */}
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        exportPlanejamentoAsPNG();
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary z-20 relative backdrop-blur-sm"
                                    title="Exportar como PNG"
                                >
                                    <Download className="h-4 w-4" />
                                    <span className="hidden min-[791px]:inline">Exportar PNG</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-5 sm:p-7"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Seção: Tabela de Planejamento */}
                        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                            <div className="mb-5 flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                                        <Factory className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-base sm:text-lg font-bold text-card-foreground">
                                            Planejamento
                                        </h3>
                                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                                            Gerencie sua programação de produção
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1">
                                        <Label htmlFor="dia" className="text-xs text-muted-foreground">
                                            Dia
                                        </Label>
                                        <Input
                                            id="dia"
                                            type="text"
                                            value={dia}
                                            onChange={(e) => setDia(e.target.value)}
                                            placeholder="Digite o dia"
                                            className="h-9 w-32 text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Label htmlFor="data" className="text-xs text-muted-foreground">
                                            Data
                                        </Label>
                                        <div className="overflow-visible min-w-0">
                                            <Input
                                                id="data"
                                                type="date"
                                                value={data}
                                                onChange={(e) => setData(e.target.value)}
                                                className="h-9 w-40 min-w-[120px] text-sm overflow-visible"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.nativeEvent.stopImmediatePropagation();
                                        addItem();
                                    }}
                                    size="sm"
                                    className="gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all duration-300 z-10 relative"
                                    type="button"
                                >
                                    <Plus className="h-4 w-4" />
                                    Adicionar Linha
                                </Button>
                            </div>

                            <div className="overflow-x-auto -mx-4 sm:mx-0">
                                <div className="inline-block min-w-full align-middle">
                                    <Table className="w-full">
                                        <TableHeader>
                                            {/* Linha superior com Produção e Plano */}
                                            <TableRow className="border-b-2 border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
                                                <TableHead className="w-10 sm:w-12"></TableHead>
                                                <TableHead className="min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm font-bold text-primary">
                                                    Produção
                                                </TableHead>
                                                <TableHead className="min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm font-bold text-primary">
                                                    Plano
                                                </TableHead>
                                                <TableHead className="min-w-[70px] sm:min-w-[90px] text-xs sm:text-sm font-semibold"></TableHead>
                                                <TableHead className="min-w-[100px] sm:min-w-[130px] text-xs sm:text-sm font-semibold"></TableHead>
                                                <TableHead className="min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm font-semibold"></TableHead>
                                                <TableHead className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm font-semibold"></TableHead>
                                                <TableHead className="min-w-[70px] sm:min-w-[80px] text-xs sm:text-sm font-semibold"></TableHead>
                                                <TableHead className="min-w-[70px] sm:min-w-[80px] text-xs sm:text-sm font-semibold"></TableHead>
                                                <TableHead className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm font-semibold">
                                                    Planejamento
                                                </TableHead>
                                                <TableHead className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm font-semibold">
                                                    Execução
                                                </TableHead>
                                                <TableHead className="min-w-[80px] sm:min-w-[90px] text-xs sm:text-sm font-semibold"></TableHead>
                                                <TableHead className="w-12 sm:w-14"></TableHead>
                                            </TableRow>
                                            {/* Linha de cabeçalhos das colunas */}
                                            <TableRow>
                                                <TableHead className="w-10 sm:w-12 text-center text-xs sm:text-sm font-semibold">
                                                    N°
                                                </TableHead>
                                                <TableHead className="min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm font-semibold">
                                                    Linhas
                                                </TableHead>
                                                <TableHead className="min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm font-semibold">
                                                    Invoice
                                                </TableHead>
                                                <TableHead className="min-w-[70px] sm:min-w-[90px] text-xs sm:text-sm font-semibold">
                                                    Cod
                                                </TableHead>
                                                <TableHead className="min-w-[100px] sm:min-w-[130px] text-xs sm:text-sm font-semibold">
                                                    Item
                                                </TableHead>
                                                <TableHead className="min-w-[80px] sm:min-w-[100px] text-xs sm:text-sm font-semibold">
                                                    Linha
                                                </TableHead>
                                                <TableHead className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm font-semibold">
                                                    Capacidade
                                                </TableHead>
                                                <TableHead className="min-w-[70px] sm:min-w-[80px] text-xs sm:text-sm font-semibold">
                                                    Latas
                                                </TableHead>
                                                <TableHead className="min-w-[70px] sm:min-w-[80px] text-xs sm:text-sm font-semibold">
                                                    Corte
                                                </TableHead>
                                                <TableHead className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm font-semibold">
                                                    Programado
                                                </TableHead>
                                                <TableHead className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm font-semibold">
                                                    Realizado
                                                </TableHead>
                                                <TableHead className="min-w-[80px] sm:min-w-[90px] text-xs sm:text-sm font-semibold">
                                                    Diferença
                                                </TableHead>
                                                <TableHead className="w-16 sm:w-20 text-xs sm:text-sm font-semibold"></TableHead>
                                                <TableHead className="w-12 sm:w-14"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-muted/30">
                                                    <TableCell className="text-center font-semibold text-xs sm:text-sm py-3">
                                                        {item.numero}
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            value={item.linhas}
                                                            onChange={(e) => updateItem(item.id, "linhas", e.target.value)}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="Linhas"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            value={item.invoice}
                                                            onChange={(e) => updateItem(item.id, "invoice", e.target.value)}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="Invoice"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            value={item.cod}
                                                            onChange={(e) => updateItem(item.id, "cod", e.target.value)}
                                                            onBlur={(e) => handleCodBlur(item.id, e.target.value)}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="Cod"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            value={item.item}
                                                            onChange={(e) => updateItem(item.id, "item", e.target.value)}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="Item"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            value={item.linha}
                                                            onChange={(e) => updateItem(item.id, "linha", e.target.value)}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="Linha"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            type="text"
                                                            value={formatNumber(item.capacidade)}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                // Permitir apenas números, pontos e vírgulas
                                                                if (value === "" || /^[\d.,]*$/.test(value)) {
                                                                    const numValue = parseFormattedNumber(value);
                                                                    updateItem(item.id, "capacidade", numValue);
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                // Permitir backspace, delete, tab, escape, enter, e teclas de navegação
                                                                if ([8, 9, 27, 13, 46, 110, 190].indexOf(e.keyCode) !== -1 ||
                                                                    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                                                                    (e.keyCode === 65 && e.ctrlKey === true) ||
                                                                    (e.keyCode === 67 && e.ctrlKey === true) ||
                                                                    (e.keyCode === 86 && e.ctrlKey === true) ||
                                                                    (e.keyCode === 88 && e.ctrlKey === true) ||
                                                                    // Permitir home, end, left, right
                                                                    (e.keyCode >= 35 && e.keyCode <= 39)) {
                                                                    return;
                                                                }
                                                                // Garantir que é um número
                                                                if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105) && e.keyCode !== 188) {
                                                                    e.preventDefault();
                                                                }
                                                            }}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            type="text"
                                                            value={formatNumber(item.latas)}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (value === "" || /^[\d.,]*$/.test(value)) {
                                                                    const numValue = parseFormattedNumber(value);
                                                                    updateItem(item.id, "latas", numValue);
                                                                }
                                                            }}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            type="text"
                                                            value={formatNumber(item.corte)}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (value === "" || /^[\d.,]*$/.test(value)) {
                                                                    const numValue = parseFormattedNumber(value);
                                                                    updateItem(item.id, "corte", numValue);
                                                                }
                                                            }}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            type="text"
                                                            value={formatNumber(item.programado)}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (value === "" || /^[\d.,]*$/.test(value)) {
                                                                    const numValue = parseFormattedNumber(value);
                                                                    updateItem(item.id, "programado", numValue);
                                                                }
                                                            }}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Input
                                                            type="text"
                                                            value={formatNumber(item.realizado)}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (value === "" || /^[\d.,]*$/.test(value)) {
                                                                    const numValue = parseFormattedNumber(value);
                                                                    updateItem(item.id, "realizado", numValue);
                                                                }
                                                            }}
                                                            className="h-9 sm:h-10 text-xs sm:text-sm"
                                                            placeholder="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <div
                                                            className={`flex h-9 sm:h-10 items-center justify-center rounded-md border border-input bg-muted/50 px-2 sm:px-3 text-xs sm:text-sm font-semibold ${item.diferenca < 0
                                                                ? "text-destructive"
                                                                : item.diferenca > 0
                                                                    ? "text-success"
                                                                    : "text-success"
                                                                }`}
                                                        >
                                                            <span className="truncate">{formatNumber(item.diferenca)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        {/* Eficiência individual - calculada por item */}
                                                        {(() => {
                                                            const eficienciaItem = item.programado > 0
                                                                ? (item.realizado / item.programado) * 100
                                                                : 0;
                                                            return (
                                                                <div className="flex flex-col items-center justify-center">
                                                                    <div
                                                                        className={`text-xs sm:text-sm font-bold ${eficienciaItem >= 100
                                                                            ? "text-success"
                                                                            : eficienciaItem >= 80
                                                                                ? "text-warning"
                                                                                : "text-destructive"
                                                                            }`}
                                                                    >
                                                                        {eficienciaItem.toFixed(1)}%
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell className="p-2 sm:p-3">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeItem(item.id)}
                                                            className="h-9 w-9 sm:h-10 sm:w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            disabled={items.length === 1}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {/* Linha de Totais */}
                                            {(() => {
                                                const totais = calcularTotais();
                                                return (
                                                    <TableRow className="bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 border-t-2 border-primary/40">
                                                        <TableCell className="text-center text-xs sm:text-sm py-2 font-bold text-primary">
                                                            Total
                                                        </TableCell>
                                                        <TableCell className="p-1 sm:p-2"></TableCell>
                                                        <TableCell className="p-1 sm:p-2"></TableCell>
                                                        <TableCell className="p-1 sm:p-2"></TableCell>
                                                        <TableCell className="p-1 sm:p-2"></TableCell>
                                                        <TableCell className="p-1 sm:p-2"></TableCell>
                                                        <TableCell className="p-1 sm:p-2">
                                                            <div className="flex h-8 sm:h-9 items-center justify-center rounded border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                                                                {formatTotal(totais.totalCapacidade)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="p-1 sm:p-2"></TableCell>
                                                        <TableCell className="p-1 sm:p-2">
                                                            <div className="flex h-8 sm:h-9 items-center justify-center rounded border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                                                                {formatTotal(totais.totalCorte)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="p-1 sm:p-2">
                                                            <div className="flex h-8 sm:h-9 items-center justify-center rounded border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                                                                {formatTotal(totais.totalProgramado)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="p-1 sm:p-2">
                                                            <div className="flex h-8 sm:h-9 items-center justify-center rounded border border-primary/20 bg-primary/10 px-2 text-xs sm:text-sm font-bold text-primary">
                                                                {formatTotal(totais.totalRealizado)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="p-1 sm:p-2">
                                                            <div
                                                                className={`flex h-8 sm:h-9 items-center justify-center rounded border px-2 text-xs sm:text-sm font-bold ${totais.diferencaTotal < 0
                                                                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                                                                    : totais.diferencaTotal > 0
                                                                        ? "border-success/30 bg-success/10 text-success"
                                                                        : "border-success/30 bg-success/10 text-success"
                                                                    }`}
                                                            >
                                                                {formatTotal(totais.diferencaTotal)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="p-1 sm:p-2">
                                                            <div className="flex flex-col items-center justify-center">
                                                                <div className="text-[9px] sm:text-[10px] text-muted-foreground/70 font-medium leading-tight">
                                                                    Eficiência
                                                                </div>
                                                                <div
                                                                    className={`text-xs sm:text-sm font-bold leading-tight ${totais.eficiencia >= 100
                                                                        ? "text-success"
                                                                        : totais.eficiencia >= 80
                                                                            ? "text-warning"
                                                                            : "text-destructive"
                                                                        }`}
                                                                >
                                                                    {totais.eficiencia.toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="p-1 sm:p-2"></TableCell>
                                                    </TableRow>
                                                );
                                            })()}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
