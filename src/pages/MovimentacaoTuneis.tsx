import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight } from "lucide-react";

export default function MovimentacaoTuneis() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <Card className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] transition-all duration-500 overflow-hidden group/card">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />
          <div className="relative z-10">
            <CardHeader className="relative w-full flex flex-col sm:flex-row sm:items-center gap-4 p-6 sm:p-8 transition-all duration-500 group/button bg-gradient-to-r from-transparent via-primary/2 to-transparent">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                <ArrowLeftRight className="relative h-7 w-7 text-primary drop-shadow-lg" />
              </div>
              <div className="text-center sm:text-left space-y-2 min-w-0">
                <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                  Movimentação de Túneis
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground/80 font-medium">
                  Registro de entradas, saídas e posição dos túneis no estoque
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-6 sm:p-8 text-sm text-muted-foreground">
              <p>
                Esta tela pode ser ligada à tabela de movimentação no Supabase (campos, RLS e telas de
                inclusão) quando o modelo estiver definido — alinhada ao cadastro de túneis (OCTT).
              </p>
            </CardContent>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
