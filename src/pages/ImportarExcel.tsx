import { useState } from "react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Database,
  Plus,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import { getExistingOCTIPairs, insertOCTIItems, type NewItemForInsert } from "@/services/supabaseData";

interface ExcelData {
  fileName: string;
  sheetName: string;
  availableSheets: string[];
  data: Record<string, unknown>[];
  count: number;
  headers: string[];
}

interface NewItem {
  codigo_item: string;
  nome_item: string;
  unidade_medida: string;
  grupo_itens: string;
}

interface ComparisonResult {
  totalItems: number;
  existingItems: number;
  newItems: number;
  newItemsData: NewItem[];
}

export default function ImportarExcel() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [inserting, setInserting] = useState(false);
  const [insertResult, setInsertResult] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setExcelData(null);
    setComparisonResult(null);
    setInsertResult(null);
    setSelectedSheet("");

    // Verificar se é um arquivo Excel ou CSV
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv)");
      return;
    }

    // Carregar abas disponíveis (se for Excel)
    if (selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      loadSheets(selectedFile);
    } else {
      setAvailableSheets([]);
    }
  };

  const loadSheets = (fileToLoad: File) => {
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer;
        if (!ab) throw new Error("Arquivo não lido");
        const wb = XLSX.read(ab, { type: "array" });
        const names = wb.SheetNames || [];
        setAvailableSheets(names);
        if (names.length > 0) setSelectedSheet(names[0]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao carregar abas do arquivo");
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Erro ao ler arquivo");
      setLoading(false);
    };
    reader.readAsArrayBuffer(fileToLoad);
  };

  const parseFileToExcelData = (): Promise<ExcelData> => {
    if (!file) return Promise.reject(new Error("Nenhum arquivo"));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const ab = e.target?.result as ArrayBuffer;
          if (!ab) return reject(new Error("Arquivo não lido"));
          const wb = XLSX.read(ab, { type: "array", raw: false });
          const sheetName = file.name.match(/\.(xlsx|xls)$/i) ? (selectedSheet || wb.SheetNames[0]) : wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          if (!ws) return reject(new Error(`Aba '${sheetName}' não encontrada`));
          const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: "" });
          const headers = data.length > 0 ? Object.keys(data[0]) : [];
          resolve({
            fileName: file.name,
            sheetName: sheetName || "",
            availableSheets: wb.SheetNames || [],
            data,
            count: data.length,
            headers,
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Por favor, selecione um arquivo");
      return;
    }

    setLoading(true);
    setError(null);
    setComparisonResult(null);
    setInsertResult(null);

    try {
      const result = await parseFileToExcelData();
      setExcelData(result);
      await compareWithDatabase(result.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao processar arquivo Excel");
    } finally {
      setLoading(false);
    }
  };

  const normalizeRowToItem = (row: Record<string, unknown>): NewItem | null => {
    const codigo =
      (row.codigo as string)?.toString().trim() ||
      (row["Nº do item"] as string)?.toString().trim() ||
      (row.codigo_item as string)?.toString().trim();
    const nome =
      (row.nome as string)?.toString().trim() ||
      (row["Descrição do item"] as string)?.toString().trim() ||
      (row.descricao as string)?.toString().trim() ||
      (row.nome_item as string)?.toString().trim() ||
      "";
    if (!codigo) return null;
    return {
      codigo_item: codigo,
      nome_item: nome,
      unidade_medida:
        (row.unidade as string)?.trim() ||
        (row["Unidade de medida de compra"] as string)?.trim() ||
        (row.unidade_medida as string)?.trim() ||
        "",
      grupo_itens:
        (row.grupo as string)?.trim() ||
        (row["Grupo de itens"] as string)?.trim() ||
        (row.grupo_itens as string)?.trim() ||
        "",
    };
  };

  const compareWithDatabase = async (items: Record<string, unknown>[]) => {
    setComparing(true);
    setError(null);
    try {
      const existing = await getExistingOCTIPairs();
      const existingSet = new Set(
        existing.map((i) => `${(i.Code ?? "").toString().trim().toLowerCase()}|${(i.Name ?? "").toString().trim().toLowerCase()}`)
      );
      const newItemsData: NewItem[] = [];
      for (const row of items) {
        const item = normalizeRowToItem(row);
        if (!item) continue;
        const key = `${item.codigo_item.toLowerCase()}|${item.nome_item.toLowerCase()}`;
        if (!existingSet.has(key)) newItemsData.push(item);
      }
      setComparisonResult({
        totalItems: items.length,
        existingItems: existingSet.size,
        newItems: newItemsData.length,
        newItemsData,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao comparar com banco de dados");
      console.error("Erro na comparação:", err);
    } finally {
      setComparing(false);
    }
  };

  const handleInsertNewItems = async () => {
    if (!comparisonResult || comparisonResult.newItems === 0) {
      setError("Não há itens novos para inserir");
      return;
    }

    setInserting(true);
    setError(null);

    try {
      const payload: NewItemForInsert[] = comparisonResult.newItemsData.map((i) => ({
        codigo_item: i.codigo_item,
        nome_item: i.nome_item,
        unidade_medida: i.unidade_medida,
        grupo_itens: i.grupo_itens,
      }));
      const result = await insertOCTIItems(payload);
      setInsertResult({ inserted: result.inserted, total: result.total });
      if (excelData) await compareWithDatabase(excelData.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao inserir itens no banco");
    } finally {
      setInserting(false);
    }
  };

  const exportToJSON = () => {
    if (!excelData) return;

    const dataStr = JSON.stringify(excelData.data, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${excelData.fileName.replace(/\.[^/.]+$/, "")}_${excelData.sheetName}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Card: Importar Excel */}
        <Card className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] transition-all duration-500 overflow-hidden group/card">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

          <div className="relative z-10">
            <CardHeader className="relative w-full flex items-center justify-between p-6 sm:p-8 transition-all duration-500 group/button bg-gradient-to-r from-transparent via-primary/2 to-transparent">
              <div className="flex items-center gap-5">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                  <FileSpreadsheet className="relative h-7 w-7 text-primary drop-shadow-lg" />
                </div>

                <div className="text-left space-y-2">
                  <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                    Importar Excel/CSV
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground/80 font-medium">
                    Importe arquivos e sincronize com o banco de dados
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-5 sm:p-7">
              <div className="space-y-6">
                {/* Upload de Arquivo */}
                <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="file-upload" className="text-sm font-semibold">
                        Selecione o arquivo Excel ou CSV
                      </Label>
                      <div className="mt-2 flex items-center gap-4">
                        <Input
                          id="file-upload"
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileChange}
                          className="flex-1"
                          disabled={loading}
                        />
                        {file && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <span className="truncate max-w-xs">{file.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Seleção de Aba (apenas para Excel) */}
                    {availableSheets.length > 0 && (
                      <div>
                        <Label htmlFor="sheet-select" className="text-sm font-semibold">
                          Selecione a aba
                        </Label>
                        <Select
                          value={selectedSheet}
                          onValueChange={setSelectedSheet}
                          disabled={loading}
                        >
                          <SelectTrigger id="sheet-select" className="mt-2">
                            <SelectValue placeholder="Selecione uma aba" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSheets.map((sheet) => (
                              <SelectItem key={sheet} value={sheet}>
                                {sheet}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {availableSheets.length} aba(s) disponível(is)
                        </p>
                      </div>
                    )}

                    {/* Botão de Upload */}
                    <Button
                      onClick={handleUpload}
                      disabled={!file || loading || (availableSheets.length > 0 && !selectedSheet)}
                      className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Carregar e Comparar com Banco
                        </>
                      )}
                    </Button>

                    {/* Mensagem de Erro */}
                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">{error}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Resultado da Comparação */}
                {comparing && (
                  <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground font-medium">Comparando com banco de dados...</p>
                      {excelData && (
                        <p className="text-xs text-muted-foreground/70 mt-2">
                          Processando {excelData.count.toLocaleString("pt-BR")} registro(s). Isso pode levar alguns minutos.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {comparisonResult && (
                  <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                          <Database className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-card-foreground">
                            Comparação com Banco de Dados
                          </h3>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Itens novos identificados
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-sm text-muted-foreground mb-1">Total no CSV</p>
                        <p className="text-2xl font-bold text-foreground">
                          {comparisonResult.totalItems.toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-sm text-muted-foreground mb-1">Já no Banco</p>
                        <p className="text-2xl font-bold text-foreground">
                          {comparisonResult.existingItems.toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                        <p className="text-sm text-primary mb-1">Novos Itens</p>
                        <p className="text-2xl font-bold text-primary">
                          {comparisonResult.newItems.toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    {comparisonResult.newItems > 0 && (
                      <>
                        <div className="mb-4">
                          <Button
                            onClick={handleInsertNewItems}
                            disabled={inserting}
                            className="w-full bg-gradient-to-r from-success to-success/90 hover:from-success/90 hover:to-success shadow-md hover:shadow-lg transition-all duration-300"
                          >
                            {inserting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Inserindo...
                              </>
                            ) : (
                              <>
                                <Plus className="mr-2 h-4 w-4" />
                                Inserir {comparisonResult.newItems} Item(ns) no Banco
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-muted/50">
                                <TableHead className="font-bold text-primary">Código</TableHead>
                                <TableHead className="font-bold text-primary">Nome</TableHead>
                                <TableHead className="font-bold text-primary">Unidade</TableHead>
                                <TableHead className="font-bold text-primary">Grupo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {comparisonResult.newItemsData.map((item, index) => (
                                <TableRow
                                  key={`${item.codigo_item}-${index}`}
                                  className="hover:bg-muted/30 transition-colors"
                                >
                                  <TableCell className="font-medium font-mono">
                                    {item.codigo_item}
                                  </TableCell>
                                  <TableCell className="max-w-md">
                                    <div className="truncate" title={item.nome_item}>
                                      {item.nome_item}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                                      {item.unidade_medida || "-"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {item.grupo_itens || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}

                    {comparisonResult.newItems === 0 && (
                      <div className="flex flex-col items-center justify-center py-8">
                        <CheckCircle2 className="h-12 w-12 text-success mb-4" />
                        <p className="text-success font-semibold">Todos os itens já estão no banco!</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Não há itens novos para inserir.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Resultado da Inserção */}
                {insertResult && (
                  <div className="rounded-xl border border-success/30 bg-success/10 backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                      <h3 className="text-base sm:text-lg font-bold text-success">
                        Itens Inseridos com Sucesso!
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {insertResult.inserted} de {insertResult.total} itens foram inseridos no banco de dados.
                    </p>
                  </div>
                )}

                {/* Dados do Excel */}
                {excelData && (
                  <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-card-foreground">
                          Dados Importados
                        </h3>
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          {excelData.count} registro(s) da {excelData.sheetName ? `aba "${excelData.sheetName}"` : "arquivo"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => excelData && compareWithDatabase(excelData.data)}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={comparing}
                        >
                          <RefreshCw className={`h-4 w-4 ${comparing ? "animate-spin" : ""}`} />
                          Recomparar
                        </Button>
                        <Button
                          onClick={exportToJSON}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Exportar JSON
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-muted/50">
                            {excelData.headers.map((header) => (
                              <TableHead key={header} className="font-bold text-primary">
                                {header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {excelData.data.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={excelData.headers.length}
                                className="text-center py-10 text-muted-foreground"
                              >
                                Nenhum dado encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            excelData.data.slice(0, 100).map((row, index) => (
                              <TableRow
                                key={index}
                                className="hover:bg-muted/30 transition-colors"
                              >
                                {excelData.headers.map((header) => (
                                  <TableCell key={header} className="max-w-xs truncate">
                                    {row[header] !== undefined && row[header] !== null
                                      ? String(row[header])
                                      : "-"}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {excelData.data.length > 100 && (
                      <p className="text-xs text-muted-foreground mt-4 text-center">
                        Mostrando 100 de {excelData.data.length} registros
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
