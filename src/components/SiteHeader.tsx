import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, ChevronLeft, ChevronRight, FilePlus, CircleUser, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocumentNav } from "@/contexts/DocumentNavContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const routeTitles: Record<string, string> = {
  "/dashboard": "Painel de Controle",
  "/producao": "Produção",
  "/analise-producao": "Análise de produção",
  "/planejamento-pcp": "Planejamento (PCP)",
  "/cadastro-linhas": "Cadastro de Linhas",
  "/itens": "Itens",
  "/importar-excel": "Importar Excel",
  "/relatorios": "Relatórios",
};

export function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const pageTitle = routeTitles[pathname] || "";
  const { documentNav } = useDocumentNav();
  const { user, logout } = useAuth();
  const { setMobileOpen } = useSidebarContext();

  const handleNewDocument = () => {
    if (documentNav?.onNewDocument) {
      documentNav.onNewDocument();
    } else {
      navigate("/analise-producao");
    }
  };

  return (
    <header
      className={cn(
        "w-full max-w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "shadow-sm overflow-hidden",
        "fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] lg:sticky lg:pt-0 lg:z-40 lg:top-0"
      )}
    >
      <div className="flex h-14 lg:h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6 lg:px-8 min-w-0 max-w-full">
        {/* Botão menu (hambúrguer) - só no mobile, integrado ao header */}
        <Button
          variant="ghost"
          size="icon"
          className="h-14 w-14 min-h-[56px] min-w-[56px] shrink-0 rounded-lg lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-10 w-10" />
        </Button>
        {/* Logo / marca */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-bold tracking-tight text-foreground">
              ERP Controller
            </span>
            <span className="ml-1.5 text-sm font-semibold text-primary">
              Petruz
            </span>
          </div>
        </div>

        {/* Título da página atual */}
        {pageTitle && (
          <>
            <div className="h-4 w-px shrink-0 bg-border hidden sm:block" aria-hidden />
            <span className="truncate text-sm font-medium text-muted-foreground max-w-[140px] sm:max-w-[220px] lg:max-w-[280px] min-w-0">
              {pageTitle}
            </span>
          </>
        )}

        {/* Navegação entre documentos (setas) - quando a tela de cadastro fornece */}
        {documentNav?.showNav && (
          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0"
                    disabled={!documentNav.canGoPrev}
                    onClick={documentNav.onPrev}
                    aria-label="Documento anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Documento anterior</TooltipContent>
              </Tooltip>
              {documentNav.navLabel && (
                <span className="min-w-[4rem] text-center text-xs text-muted-foreground">
                  {documentNav.navLabel}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0"
                    disabled={!documentNav.canGoNext}
                    onClick={documentNav.onNext}
                    aria-label="Próximo documento"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Próximo documento</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <div className="flex-1" />

        {/* Botão Novo documento */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 min-h-[44px] sm:h-8 sm:min-h-0 px-3"
                onClick={handleNewDocument}
                aria-label="Novo documento"
              >
                <FilePlus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo documento</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Criar novo documento / cadastro</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Perfil: código = ID do usuário */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px] sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0 rounded-full border border-border/60 hover:bg-primary/10 hover:border-primary/30"
                aria-label="Abrir perfil"
              >
                <CircleUser className="h-5 w-5 text-primary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-foreground truncate">
                    {user.nome || "Perfil"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                  <span className="text-xs text-muted-foreground font-mono mt-1">
                    Código: {user.id}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => navigate("/login")}>
            Entrar
          </Button>
        )}
      </div>
    </header>
  );
}
