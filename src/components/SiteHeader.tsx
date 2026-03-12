import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef } from "react";
import { BarChart3, ChevronLeft, ChevronRight, CircleUser, Loader2, LogOut, Menu, Save } from "lucide-react";
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
  const headerRef = useRef<HTMLElement>(null);

  const hasDocNav = !!documentNav?.showNav;

  // Atualiza a variável CSS com a altura real do header para o main reservar o mesmo espaço (evita conteúdo atrás do header em 640px–1024px)
  const setHeaderHeight = () => {
    const el = headerRef.current;
    if (el) document.documentElement.style.setProperty("--app-header-height", `${el.offsetHeight}px`);
  };
  useLayoutEffect(() => {
    setHeaderHeight();
  }, [hasDocNav]);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(setHeaderHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasDocNav]);

  return (
    <header
      ref={headerRef}
      className={cn(
        "w-full max-w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "shadow-sm overflow-hidden",
        "fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] lg:sticky lg:top-0 lg:z-40",
        "min-h-14 sm:min-h-[5.25rem] lg:h-16 lg:min-h-0"
      )}
    >
      <div className="flex flex-nowrap min-h-14 sm:min-h-[5.25rem] lg:min-h-0 lg:h-16 items-center gap-x-1.5 sm:gap-x-3 px-2 sm:px-4 lg:px-8 min-w-0 max-w-full py-1.5 sm:py-1 lg:py-0">
        {/* Botão menu (hambúrguer) — uma linha no mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 min-h-[40px] min-w-[40px] sm:h-9 sm:w-9 shrink-0 rounded-lg lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
        {/* Logo */}
        <div className="flex shrink-0 items-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <BarChart3 className="h-4 w-4 text-primary-foreground" />
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

        {/* Navegação entre documentos (setas) - quando a tela de cadastro fornece; abaixo de 410px sem label para caber */}
        {documentNav?.showNav && (
          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 rounded-lg"
                    disabled={!documentNav.canGoPrev}
                    onClick={documentNav.onPrev}
                    aria-label="Documento anterior"
                  >
                    <ChevronLeft className="h-4 w-4 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Documento anterior</TooltipContent>
              </Tooltip>
              {documentNav.navLabel && (
                <span className="min-w-[3.5rem] sm:min-w-[4rem] text-center text-xs text-muted-foreground shrink-0">
                  {documentNav.navLabel}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 rounded-lg"
                    disabled={!documentNav.canGoNext}
                    onClick={documentNav.onNext}
                    aria-label="Próximo documento"
                  >
                    <ChevronRight className="h-4 w-4 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Próximo documento</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <div className="flex-1 min-w-0" />

        {/* Botão Salvar — visível apenas quando a tela for menor que 1024px */}
        {documentNav?.onSave && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="lg:hidden h-9 min-h-[40px] sm:min-h-0 sm:h-8 gap-1.5 px-3 rounded-lg border border-success/30 bg-success/5 text-success hover:bg-success/10 hover:border-success/50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 font-medium"
            title="Salvar no banco de dados"
            disabled={documentNav.saving || documentNav.canSave === false}
            onClick={() => documentNav.onSave?.()}
          >
            {documentNav.saving ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-success" />
            ) : (
              <Save className="h-4 w-4 shrink-0" />
            )}
            <span className="text-sm">Salvar</span>
          </Button>
        )}

        {/* Perfil — uma linha no mobile */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 rounded-full border border-border/60 hover:bg-primary/10 hover:border-primary/30 shrink-0"
                aria-label="Abrir perfil"
              >
                <CircleUser className="h-4 w-4 text-primary" />
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
          <Button variant="ghost" size="sm" className="min-h-[40px] sm:min-h-0 h-9 sm:h-8 px-3 rounded-lg shrink-0" onClick={() => navigate("/login")}>
            Entrar
          </Button>
        )}
      </div>
    </header>
  );
}
