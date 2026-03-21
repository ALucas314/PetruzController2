import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef } from "react";
import { BarChart3, Bell, ChevronLeft, ChevronRight, CircleUser, LogOut, Menu, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocumentNav } from "@/contexts/DocumentNavContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useLoadNotifications, formatLoadNotificationDocLabel } from "@/contexts/LoadNotificationsContext";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

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

function formatDataDiaBR(iso: string): string {
  const day = iso.split("T")[0];
  const parts = day.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const pageTitle = routeTitles[pathname] || "";
  const { documentNav } = useDocumentNav();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { setMobileOpen } = useSidebarContext();
  const { notifications, clearLoadNotifications } = useLoadNotifications();
  const notifCount = notifications.length;
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
        "min-h-12 sm:min-h-14 lg:h-16 lg:min-h-0"
      )}
    >
      <div className="flex flex-nowrap min-h-12 sm:min-h-14 lg:min-h-0 lg:h-16 items-center gap-x-1.5 sm:gap-x-3 px-2 sm:px-4 lg:px-8 min-w-0 max-w-full py-1 sm:py-1.5 lg:py-0">
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

        <Popover>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "relative h-9 w-9 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 shrink-0 rounded-xl border transition-all duration-300",
                      "border-border/60 bg-background/80 backdrop-blur-sm hover:border-primary/40 hover:bg-primary/5",
                      notifCount > 0 && "border-primary/35 bg-primary/5"
                    )}
                    aria-label={
                      notifCount > 0
                        ? `Notificações de carregamento, ${notifCount} evento(s)`
                        : "Notificações de carregamento"
                    }
                  >
                    <Bell className="h-4 w-4 text-primary" />
                    {notifCount > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                        {notifCount > 99 ? "99+" : notifCount}
                      </span>
                    ) : null}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Carregamentos do banco (Produção)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <PopoverContent
            align="end"
            className="z-[100] w-[min(22rem,calc(100vw-2rem))] p-0"
            sideOffset={8}
          >
            <div className="border-b border-border/60 px-3 py-2.5">
              <p className="text-sm font-semibold leading-tight">Carregamentos</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Documento e quantidade de itens OCPD carregados
              </p>
            </div>
            <ScrollArea className="h-[min(20rem,50vh)]">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhum carregamento nesta sessão.
                </p>
              ) : (
                <ul className="space-y-1.5 p-2">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-lg border border-border/50 bg-muted/25 px-2.5 py-2 text-sm"
                    >
                      <div className="font-medium text-foreground leading-snug">
                        {formatLoadNotificationDocLabel(n)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground leading-snug">
                        <span className="font-medium text-foreground/90">{n.itemCount}</span>
                        {n.itemCount === 1 ? " item" : " itens"}
                        {" · "}
                        {formatDataDiaBR(n.dataDia)}
                        {n.filialNome ? (
                          <>
                            {" · "}
                            <span className="break-words" title={n.filialNome}>
                              {n.filialNome.length > 40 ? `${n.filialNome.slice(0, 38)}…` : n.filialNome}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground/85 tabular-nums">
                        {new Date(n.at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
            {notifications.length > 0 ? (
              <div className="border-t border-border/60 p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearLoadNotifications}
                >
                  Limpar lista
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        {/* Toggle modo escuro — estilo dashboard futurista */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
                className={cn(
                  "h-9 w-9 sm:h-9 sm:w-9 shrink-0 rounded-xl border transition-all duration-300",
                  "hover:scale-105 active:scale-95",
                  "border-border/60 bg-background/80 backdrop-blur-sm hover:border-primary/40 hover:bg-primary/5",
                  "dark:border-primary/30 dark:bg-primary/5 dark:shadow-[0_0_20px_rgba(var(--primary),0.15)] dark:hover:shadow-[0_0_24px_rgba(var(--primary),0.25)]"
                )}
              >
                {isDark ? (
                  <Sun className="h-4 w-4 text-amber-400/90 dark:text-amber-300" />
                ) : (
                  <Moon className="h-4 w-4 text-primary" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isDark ? "Modo claro" : "Modo escuro"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Salvar: só na área do documento (Produção / PCP), não no header — evita header apertado no celular */}

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
