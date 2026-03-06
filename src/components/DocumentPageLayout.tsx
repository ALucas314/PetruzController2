import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface DocumentPageLayoutProps {
  title: string;
  subtitle?: string;
  updatedAt?: string;
  icon: ReactNode;
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
}

export function DocumentPageLayout({
  title,
  subtitle = "ERP Controller Petruz",
  updatedAt,
  icon,
  backTo = "/cadastro",
  backLabel = "Voltar ao cadastro",
  children,
}: DocumentPageLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
            <Link to={backTo}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          </Button>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Documento legal
          </span>
        </div>
      </header>

      {/* Document card */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="rounded-2xl border border-border/60 bg-card shadow-lg shadow-black/5 overflow-hidden">
          {/* Document header */}
          <div className="px-6 sm:px-10 pt-8 sm:pt-10 pb-6 bg-gradient-to-b from-primary/5 to-transparent border-b border-border/40">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                {icon}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {title}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                {updatedAt && (
                  <p className="text-xs text-muted-foreground/80 mt-2 font-medium">
                    Última atualização: {updatedAt}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Document body */}
          <div className="px-6 sm:px-10 py-8 sm:py-10">
            <div className="document-content">{children}</div>
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-10 py-6 bg-muted/30 border-t border-border/40">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link to={backTo}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <style>{`
        .document-content h2 {
          font-size: 1.0625rem;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin-top: 2rem;
          margin-bottom: 0.5rem;
          padding-left: 0.75rem;
          border-left: 3px solid hsl(var(--primary) / 0.6);
        }
        .document-content h2:first-child { margin-top: 0; }
        .document-content p {
          font-size: 0.9375rem;
          line-height: 1.7;
          color: hsl(var(--muted-foreground));
          margin-bottom: 1rem;
        }
        .document-content p:last-child { margin-bottom: 0; }
      `}</style>
    </div>
  );
}
