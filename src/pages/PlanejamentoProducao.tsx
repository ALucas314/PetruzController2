import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Construction, ArrowLeft } from "lucide-react";

export default function PlanejamentoProducao() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="pt-6 sm:pt-8 px-2 sm:px-0 space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Voltar ao menu"
            className="mt-6 mb-2 size-11 min-h-[44px] rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-accent hover:border-primary/30 hover:shadow-md transition-all"
          >
            <ArrowLeft className="size-5 text-foreground" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Planejamento de Produção
          </h1>
        </div>
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/50">
          <Construction className="h-4 w-4" />
          <AlertTitle>Em desenvolvimento</AlertTitle>
          <AlertDescription>
            Esta tela está em construção. Em breve você terá acesso às funcionalidades de planejamento de produção.
          </AlertDescription>
        </Alert>
      </div>
    </AppLayout>
  );
}

