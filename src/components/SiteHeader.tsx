import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, ChevronLeft, ChevronRight, FilePlus, CircleUser, LogOut, Menu, Save, Loader2 } from "lucide-react";
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
      <div className="flex flex-wrap min-h-[56px] lg:h-16 items-center gap-x-2 gap-y-1 sm:gap-x-4 px-3 sm:px-6 lg:px-8 min-w-0 max-w-full">
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
        {/* Logo (apenas ícone, sem texto – nome já aparece na sidebar) */}
        <div className="flex shrink-0 items-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>

        {/* Título da página atual (somente em telas maiores, fora da experiência mobile) */}
        {pageTitle && (
          <div className="hidden lg:flex items-center gap-2 min-w-0">
            <div className="h-4 w-px shrink-0 bg-border" aria-hidden />
            <span className="truncate text-sm font-medium text-muted-foreground max-w-[280px] min-w-0">
              {pageTitle}
            </span>
          </div>
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

        {/* Botões de ação do documento */}
        <div className="flex items-center gap-2">
          {documentNav?.onSave && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success z-20 relative backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed h-9 sm:h-8"
                    onClick={documentNav.onSave}
                    disabled={documentNav.saving}
                    aria-label="Salvar documento"
                  >
                    {documentNav.saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Salvar no banco de dados</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 min-h-[44px] w-9 min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0"
                  onClick={handleNewDocument}
                  aria-label="Novo documento"
                >
                  <FilePlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Criar novo documento / cadastro</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

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
                  <span className="text-xs text-muted-foreground font-mono mt-1 truncate max-w-[140px]" title={user.id}>
                    ID: {String(user.id).slice(0, 8)}…
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10 data-[highlighted]:bg-destructive/10 cursor-pointer"
                onClick={async () => {
                  await logout();
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
