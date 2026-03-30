import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, AlertCircle } from "lucide-react";

const CARD_CLASS =
  "relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] transition-all duration-500 overflow-hidden group/card";

type OctGradientCadastroLayoutProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  newButtonLabel: string;
  onNew: () => void;
  loading: boolean;
  isEmpty: boolean;
  emptyTitle: string;
  emptyHint: string;
  table: ReactNode;
  /** Dialogs / alertas após o card (fora do Card) */
  footer?: ReactNode;
};

export function OctGradientCadastroLayout({
  title,
  description,
  icon: Icon,
  newButtonLabel,
  onNew,
  loading,
  isEmpty,
  emptyTitle,
  emptyHint,
  table,
  footer,
}: OctGradientCadastroLayoutProps) {
  return (
    <AppLayout>
      <div className="space-y-6">
        <Card className={CARD_CLASS}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-primary/0.5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none z-0 rounded-2xl" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />

          <div className="relative z-10">
            <CardHeader className="relative w-full flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 sm:p-8 transition-all duration-500 group/button bg-gradient-to-r from-transparent via-primary/2 to-transparent gap-4 sm:gap-0">
              <div className="flex items-center gap-5 w-full sm:w-auto justify-center sm:justify-start">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 shadow-[0_4px_16px_rgba(59,130,246,0.2)] group-hover/button:shadow-[0_8px_24px_rgba(59,130,246,0.4)] group-hover/button:scale-110 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
                  <Icon className="relative h-7 w-7 text-primary drop-shadow-lg" />
                </div>
                <div className="text-center sm:text-left space-y-2">
                  <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover/button:from-primary group-hover/button:to-primary/80 transition-all duration-500">
                    {title}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground/80 font-medium">{description}</CardDescription>
                </div>
              </div>
              <div className="w-full sm:w-auto flex justify-center sm:justify-end">
                <Button
                  onClick={onNew}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  {newButtonLabel}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-4 sm:p-5 lg:p-7">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : isEmpty ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium">{emptyTitle}</p>
                  <p className="text-sm text-muted-foreground/80 mt-2">{emptyHint}</p>
                </div>
              ) : (
                table
              )}
            </CardContent>
          </div>
        </Card>
      </div>
      {footer}
    </AppLayout>
  );
}
