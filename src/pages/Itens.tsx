import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Package, Loader2, AlertCircle, RefreshCw, FileText, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseCSV } from "@/utils/csvReader";

interface CSVItem {
  "Nº do item": string;
  "Descrição do item": string;
  "Unidade de medida de compra": string;
  "Grupo de itens": string;
  [key: string]: string;
}

interface DatabaseItem {
  ItemCode: string;
  ItemName: string;
  OnHand?: number;
  InvntItem?: string;
  SalUnitMsr?: string;
  [key: string]: any;
}

export default function Itens() {
  const [csvItems, setCsvItems] = useState<CSVItem[]>([]);
  const [csvLoading, setCsvLoading] = useState(true);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("csv");

  // Carregar dados do CSV
  useEffect(() => {
    const loadCSVData = async () => {
      try {
        setCsvLoading(true);
        setCsvError(null);
        
        // Carregar o CSV da pasta public
        const response = await fetch("/Banco de dados.csv");
        if (!response.ok) {
          throw new Error(`Erro ao carregar arquivo: ${response.statusText}`);
        }
        
        const csvContent = await response.text();
        const parsedData = parseCSV(csvContent);
        setCsvItems(parsedData);
      } catch (error: any) {
        console.error("Erro ao carregar CSV:", error);
        setCsvError(error.message || "Erro ao carregar dados do CSV");
      } finally {
        setCsvLoading(false);
      }
    };

    loadCSVData();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Card: Itens Cadastrados */}
        <Card className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] transition-all duration-500 overflow-hidden group/card">
          {/* Efeito de brilho sutil */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
          {/* Borda superior com gradiente */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

          <div className="relative z-10">
            <CardHeader className="relative w-full flex items-center justify-between p-6 sm:p-8 transition-all duration-500 group/button bg-gradient-to-r from-transparent via-primary/2 to-transparent">
              <div className="flex items-center gap-5">
                {/* Ícone com efeito glassmorphism melhorado */}
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                  <Package className="relative h-7 w-7 text-primary drop-shadow-lg" />
                </div>

                <div className="text-left space-y-2">
                  <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                    Itens Cadastrados
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground/80 font-medium">
                    Visualização de itens do banco de dados e CSV
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent
              className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-5 sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                  <TabsTrigger value="csv" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Dados CSV
                  </TabsTrigger>
                  <TabsTrigger value="database" className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Banco de Dados
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Dados CSV */}
                <TabsContent value="csv" className="space-y-4">
                  {/* Loading State */}
                  {csvLoading && (
                    <div className="flex flex-col items-center justify-center py-20">
                      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground">Carregando dados do CSV...</p>
                    </div>
                  )}

                  {/* Error State */}
                  {csvError && (
                    <div className="flex flex-col items-center justify-center py-20">
                      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                      <p className="text-destructive font-semibold mb-2">
                        Erro ao carregar CSV
                      </p>
                      <p className="text-muted-foreground text-sm mb-4 text-center max-w-md">
                        {csvError}
                      </p>
                    </div>
                  )}

                  {/* Success State - Tabela CSV */}
                  {!csvLoading && !csvError && csvItems.length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30 shadow-sm">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-bold text-card-foreground">
                              Dados do CSV
                            </h3>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              {csvItems.length.toLocaleString("pt-BR")} itens encontrados
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => window.location.reload()}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Atualizar
                        </Button>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-muted/50">
                              <TableHead className="font-bold text-primary min-w-[120px]">
                                Nº do Item
                              </TableHead>
                              <TableHead className="font-bold text-primary min-w-[300px]">
                                Descrição do Item
                              </TableHead>
                              <TableHead className="font-bold text-primary min-w-[150px]">
                                Unidade de Medida
                              </TableHead>
                              <TableHead className="font-bold text-primary min-w-[200px]">
                                Grupo de Itens
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvItems.map((item, index) => (
                              <TableRow
                                key={`${item["Nº do item"]}-${index}`}
                                className="hover:bg-muted/30 transition-colors"
                              >
                                <TableCell className="font-medium font-mono text-sm">
                                  {item["Nº do item"] || "-"}
                                </TableCell>
                                <TableCell className="max-w-md">
                                  <div className="truncate" title={item["Descrição do item"]}>
                                    {item["Descrição do item"] || "-"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">
                                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                                    {item["Unidade de medida de compra"] || "-"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {item["Grupo de itens"] || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {csvItems.length > 100 && (
                        <p className="text-xs text-muted-foreground mt-4 text-center">
                          Mostrando todos os {csvItems.length.toLocaleString("pt-BR")} registros
                        </p>
                      )}
                    </div>
                  )}

                  {!csvLoading && !csvError && csvItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhum dado encontrado no CSV</p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Banco de Dados */}
                <TabsContent value="database" className="space-y-4">
                  <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/90 via-card/95 to-card backdrop-blur-sm p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                    <div className="flex flex-col items-center justify-center py-20">
                      <Database className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center">
                        Integração com banco de dados em desenvolvimento
                      </p>
                      <p className="text-sm text-muted-foreground/70 mt-2 text-center">
                        Use a aba "Dados CSV" para visualizar os itens do arquivo CSV
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
