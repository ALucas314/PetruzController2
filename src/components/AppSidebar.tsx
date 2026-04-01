import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import {
  LayoutDashboard,
  Factory,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  LucideIcon,
  TrendingUp,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Package,
  Thermometer,
  Tags,
  ArrowLeftRight,
  Users,
  Timer,
  Briefcase,
  FolderOpen,
  Search,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface SubMenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  subItems?: SubMenuItem[];
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

const menuItems: MenuItem[] = [
  { title: "Painel de Controle", url: "/dashboard", icon: LayoutDashboard },
  {
    title: "Produção",
    url: "/producao",
    icon: Factory,
    subItems: [
      { title: "Acompanhamento diário da produção", url: "/analise-producao", icon: TrendingUp },
      { title: "Histórico de Análise de produção", url: "/historico-analise-producao", icon: TrendingUp },
      { title: "Bi-horária", url: "/bi-horaria", icon: Timer },
      { title: "Controle de empacotamento", url: "/controle-empacotamento", icon: Package },
      { title: "Planejamento de produção", url: "/planejamento-pcp", icon: Factory },
    ]
  },
  {
    title: "Estoque",
    url: "/estoque",
    icon: Package,
    subItems: [
      { title: "Controle de estoque", url: "/estoque/controle-estoque", icon: Package },
      { title: "Movimentação de Túneis", url: "/estoque/movimentacao-tuneis", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Cadastros",
    url: "/cadastro-linhas",
    icon: FolderOpen,
    subItems: [
      { title: "Cadastro de Linhas", url: "/cadastro-linhas", icon: Factory },
      { title: "Cadastro de Colaboradores", url: "/cadastro-colaboradores", icon: Users },
      { title: "Cadastro de funções", url: "/cadastro-funcoes", icon: Briefcase },
      { title: "Cadastro de Túneis", url: "/estoque/cadastro-tuneis", icon: Thermometer },
      { title: "Cadastro de tipo de produtos", url: "/estoque/cadastro-tipo-produto", icon: Tags },
    ],
  },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Importar Excel", url: "/importar-excel", icon: FileSpreadsheet },
];

// ============================================================================
// LOGO COMPONENT
// ============================================================================

const SidebarLogo = memo(({ collapsed, showLabels }: { collapsed: boolean; showLabels: boolean }) => (
  <div className={cn(
    "relative flex h-20 items-center border-b border-sidebar-border/60 bg-gradient-to-br from-sidebar/95 via-sidebar to-sidebar/90 transition-all duration-300 shadow-sm",
    collapsed ? "justify-center px-0" : "gap-3 px-4"
  )}>
    {/* Efeito de brilho sutil */}
    <div className="absolute inset-0 bg-gradient-to-r from-sidebar-primary/5 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />

    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary via-sidebar-primary/90 to-sidebar-primary/80 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 border border-sidebar-primary/20">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
      <BarChart3 className="relative h-5 w-5 text-sidebar-primary-foreground transition-transform duration-300 hover:rotate-12 drop-shadow-sm" />
    </div>
    {!collapsed && showLabels && (
      <div className="flex-1 min-w-0 relative z-10 animate-in fade-in duration-200">
        <div className="space-y-0.5">
          <span className="text-base font-bold text-sidebar-accent-foreground tracking-tight leading-tight block whitespace-nowrap">
            ERP Controladoria
          </span>
          <span className="text-sm font-semibold text-sidebar-primary block whitespace-nowrap bg-gradient-to-r from-sidebar-primary to-sidebar-primary/80 bg-clip-text text-transparent">
            Petruz
          </span>
        </div>
      </div>
    )}
  </div>
));
SidebarLogo.displayName = "SidebarLogo";

// ============================================================================
// SUB NAV ITEM COMPONENT WITH ANIMATIONS
// ============================================================================

interface SubNavItemProps {
  subItem: SubMenuItem;
  isActive: boolean;
  /** Ícone só + tooltip (sidebar fechada ou ainda abrindo) */
  iconOnly: boolean;
  onNavigate: () => void;
  currentPath: string; // Adicionar path atual como prop
}

const SubNavItem = memo(({ subItem, isActive, iconOnly, onNavigate, currentPath }: SubNavItemProps) => {
  const Icon = subItem.icon;
  const [isHovered, setIsHovered] = useState(false);

  const isCurrentlyActive =
    currentPath === subItem.url || currentPath.startsWith(subItem.url + "/");
  const effectiveIsActive = isActive || isCurrentlyActive;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate();
  }, [onNavigate]);

  const linkContent = (
    <NavLink
      to={subItem.url}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium min-w-0",
        "ml-6 transition-all duration-300 ease-out",
        "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-1 hover:shadow-md",
        iconOnly && "justify-center px-2 ml-0 hover:translate-x-0",
        effectiveIsActive && "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/90 text-sidebar-accent-foreground shadow-lg shadow-sidebar-primary/20"
      )}
      activeClassName="bg-gradient-to-r from-sidebar-accent to-sidebar-accent/90 text-sidebar-accent-foreground shadow-lg shadow-sidebar-primary/20"
    >
      {/* Active indicator */}
      {effectiveIsActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-gradient-to-b from-sidebar-primary via-sidebar-primary to-sidebar-primary/80 rounded-r-full shadow-lg shadow-sidebar-primary/50" />
      )}

      {/* Icon with animation */}
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-all duration-300",
        effectiveIsActive && "text-sidebar-primary scale-110",
        isHovered && "scale-110 rotate-3"
      )} />

      {!iconOnly && (
        <span className="flex-1 min-w-0 whitespace-normal break-words text-left leading-snug animate-in fade-in duration-200">
          {subItem.title}
        </span>
      )}

      {/* Hover effect background */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-sidebar-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </NavLink>
  );

  if (iconOnly) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {linkContent}
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover text-popover-foreground">
          <p>{subItem.title}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}, (prevProps, nextProps) => {
  // Sempre re-renderizar quando o estado ativo mudar para atualizar a borda azul
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }

  // Re-renderizar quando a rota atual mudar
  if (prevProps.currentPath !== nextProps.currentPath) {
    return false;
  }

  return (
    prevProps.subItem.url === nextProps.subItem.url &&
    prevProps.iconOnly === nextProps.iconOnly
  );
});
SubNavItem.displayName = "SubNavItem";

// ============================================================================
// NAV ITEM WITH SUBMENU COMPONENT WITH ANIMATIONS
// ============================================================================

interface NavItemWithSubmenuProps {
  item: MenuItem;
  isActive: boolean;
  iconOnly: boolean;
  onNavigate: () => void;
  location: { pathname: string };
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const NavItemWithSubmenu = memo(({
  item,
  isActive,
  iconOnly,
  onNavigate,
  location,
  isExpanded,
  onToggleExpand
}: NavItemWithSubmenuProps) => {
  const Icon = item.icon;
  const hasSubItems = item.subItems && item.subItems.length > 0;
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const submenuRef = useRef<HTMLDivElement>(null);

  const isSubItemActive = useMemo(() => {
    if (!hasSubItems) return false;
    return (
      item.subItems?.some(
        (subItem) => location.pathname === subItem.url || location.pathname.startsWith(subItem.url + "/")
      ) || false
    );
  }, [hasSubItems, item.subItems, location.pathname]);

  const handleItemClick = useCallback((e: React.MouseEvent) => {
    // Para itens com subitens, alterna a expansão
    if (hasSubItems && !iconOnly) {
      e.preventDefault();
      e.stopPropagation();
      onToggleExpand();
    } else {
      onNavigate();
    }
  }, [hasSubItems, iconOnly, onToggleExpand, onNavigate]);

  // Para itens com subitens, usa o primeiro subitem como URL se não houver URL próprio
  const getNavLinkTo = () => {
    if (hasSubItems && item.subItems && item.subItems.length > 0 && !item.url) {
      return item.subItems[0].url;
    }
    return item.url;
  };

  const navLink = (
    <NavLink
      to={getNavLinkTo()}
      end
      onClick={handleItemClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold min-w-0",
        "transition-all duration-300 ease-out",
        "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-1 hover:shadow-md",
        iconOnly && "justify-center px-2 hover:translate-x-0",
        (isActive || isSubItemActive) && "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/90 text-sidebar-accent-foreground shadow-lg shadow-sidebar-primary/20"
      )}
      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground shadow-md"
    >
      {/* Active indicator */}
      {(isActive || isSubItemActive) && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-gradient-to-b from-sidebar-primary via-sidebar-primary to-sidebar-primary/80 rounded-r-full shadow-lg shadow-sidebar-primary/50" />
      )}

      {/* Icon with animation */}
      <Icon className={cn(
        "h-5 w-5 shrink-0 transition-all duration-300",
        (isActive || isSubItemActive) && "text-sidebar-primary scale-110",
        isHovered && "scale-110 rotate-3"
      )} />

      {!iconOnly && (
        <>
          <span className="flex-1 min-w-0 whitespace-normal break-words text-left leading-snug animate-in fade-in duration-200">
            {item.title}
          </span>
          {hasSubItems && (
            <ChevronDown className={cn(
              "h-4 w-4 shrink-0 transition-all duration-300 ease-out",
              isExpanded && "rotate-180",
              isHovered && "scale-110"
            )} />
          )}
        </>
      )}

      {/* Hover effect background */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-sidebar-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </NavLink>
  );

  if (iconOnly) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {navLink}
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover text-popover-foreground">
          <p>{item.title}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-1">
      {navLink}
      {hasSubItems && (
        <div
          ref={submenuRef}
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            isExpanded ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"
          )}
        >
          <div className="space-y-1 pl-2">
            {item.subItems?.map((subItem) => {
              const isSubActive =
                location.pathname === subItem.url || location.pathname.startsWith(subItem.url + "/");
              return (
                <SubNavItem
                  key={subItem.url}
                  subItem={subItem}
                  isActive={isSubActive}
                  iconOnly={iconOnly}
                  onNavigate={onNavigate}
                  currentPath={location.pathname}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  if (
    prevProps.item.title !== nextProps.item.title ||
    prevProps.iconOnly !== nextProps.iconOnly ||
    prevProps.isExpanded !== nextProps.isExpanded
  ) {
    return false;
  }

  // Sempre re-renderizar quando a rota mudar para atualizar o indicador ativo
  if (prevProps.location.pathname !== nextProps.location.pathname) {
    return false; // Força re-renderização para atualizar indicador ativo
  }

  // Verificar se o estado ativo mudou
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }

  return true;
});
NavItemWithSubmenu.displayName = "NavItemWithSubmenu";

// ============================================================================
// NAV ITEM COMPONENT (SIMPLE) WITH ANIMATIONS
// ============================================================================

interface NavItemProps {
  item: MenuItem;
  isActive: boolean;
  iconOnly: boolean;
  onNavigate: () => void;
}

const NavItem = memo(({ item, isActive, iconOnly, onNavigate }: NavItemProps) => {
  const Icon = item.icon;
  const [isHovered, setIsHovered] = useState(false);

  const navLink = (
    <NavLink
      to={item.url}
      end
      onClick={onNavigate}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold min-w-0",
        "transition-all duration-300 ease-out",
        "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-1 hover:shadow-md",
        iconOnly && "justify-center px-2 hover:translate-x-0",
        isActive && "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/90 text-sidebar-accent-foreground shadow-lg shadow-sidebar-primary/20"
      )}
      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground shadow-md"
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-gradient-to-b from-sidebar-primary via-sidebar-primary to-sidebar-primary/80 rounded-r-full shadow-lg shadow-sidebar-primary/50" />
      )}

      {/* Icon with animation */}
      <Icon className={cn(
        "h-5 w-5 shrink-0 transition-all duration-300",
        isActive && "text-sidebar-primary scale-110",
        isHovered && "scale-110 rotate-3"
      )} />

      {!iconOnly && (
        <span className="flex-1 min-w-0 whitespace-normal break-words text-left leading-snug animate-in fade-in duration-200">
          {item.title}
        </span>
      )}

      {/* Hover effect background */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-sidebar-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </NavLink>
  );

  if (iconOnly) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {navLink}
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-popover text-popover-foreground">
          <p>{item.title}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return navLink;
}, (prevProps, nextProps) => {
  // Sempre re-renderizar quando o estado ativo mudar para atualizar a borda azul
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }

  return (
    prevProps.item.url === nextProps.item.url &&
    prevProps.iconOnly === nextProps.iconOnly
  );
});
NavItem.displayName = "NavItem";

// ============================================================================
// SIDEBAR CONTENT COMPONENT
// ============================================================================

interface SidebarContentProps {
  collapsed: boolean;
  /** Textos do menu só depois da animação de largura (evita texto espremido ao expandir) */
  showExpandedLabels: boolean;
  /** Drawer mobile: sempre ícone + texto (não herdar `collapsed` do desktop) */
  isInMobileSheet?: boolean;
  location: { pathname: string };
  onNavigate: () => void;
  onToggleCollapse: () => void;
  expandedItems: Set<string>;
  onToggleExpand: (title: string) => () => void;
}

const SidebarContent = memo(({
  collapsed,
  showExpandedLabels,
  isInMobileSheet = false,
  location,
  onNavigate,
  onToggleCollapse,
  expandedItems,
  onToggleExpand
}: SidebarContentProps) => {
  const iconOnly = isInMobileSheet ? false : collapsed || !showExpandedLabels;
  const logoCollapsed = isInMobileSheet ? false : collapsed;
  const logoShowLabels = isInMobileSheet ? true : showExpandedLabels;
  const [menuSearch, setMenuSearch] = useState("");
  const normalizedSearch = normalizeSearchText(menuSearch);
  const expandedItemsKey = useMemo(() => {
    return Array.from(expandedItems).sort().join(',');
  }, [expandedItems]);

  const navItems = useMemo(() =>
    menuItems
    .map((item) => {
      const parentMatch = normalizeSearchText(item.title).includes(normalizedSearch);
      const filteredSubItems = item.subItems
        ? (normalizedSearch
          ? item.subItems.filter((subItem) => normalizeSearchText(subItem.title).includes(normalizedSearch))
          : item.subItems)
        : undefined;

      const hasVisibleSubItems = !!filteredSubItems && filteredSubItems.length > 0;
      const visible = normalizedSearch.length === 0 || parentMatch || hasVisibleSubItems;
      if (!visible) return null;

      const effectiveItem: MenuItem = filteredSubItems ? { ...item, subItems: filteredSubItems } : item;
      const isActive = location.pathname === item.url;
      const isSubItemActive = effectiveItem.subItems?.some(
        (subItem) => location.pathname === subItem.url || location.pathname.startsWith(subItem.url + "/")
      );
      return {
        item: effectiveItem,
        isActive: isActive || isSubItemActive || false,
        isExpanded: normalizedSearch.length > 0 ? hasVisibleSubItems : expandedItems.has(item.title),
      };
    })
    .filter((entry): entry is { item: MenuItem; isActive: boolean; isExpanded: boolean } => entry !== null),
    [location.pathname, expandedItemsKey, normalizedSearch]
  );

  return (
    <>
      <SidebarLogo collapsed={logoCollapsed} showLabels={logoShowLabels} />

      {!iconOnly && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-muted-foreground" />
            <Input
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              placeholder="Buscar menu..."
              className="h-9 pl-9 bg-sidebar-accent/30 border-sidebar-border/60"
              aria-label="Buscar opções da sidebar"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-2 py-4 overflow-y-auto overflow-x-hidden min-w-0 px-3 scrollbar-thin scrollbar-thumb-sidebar-accent/50 scrollbar-track-transparent hover:scrollbar-thumb-sidebar-accent transition-colors">
        {!iconOnly && normalizedSearch.length > 0 && navItems.length === 0 ? (
          <p className="px-1 text-xs text-sidebar-muted-foreground">Nenhuma opção encontrada.</p>
        ) : null}
        {navItems.map(({ item, isActive, isExpanded }) => {
          if (item.subItems && item.subItems.length > 0) {
            return (
              <NavItemWithSubmenu
                key={item.title}
                item={item}
                isActive={isActive}
                iconOnly={iconOnly}
                onNavigate={onNavigate}
                location={location}
                isExpanded={isExpanded}
                onToggleExpand={onToggleExpand(item.title)}
              />
            );
          }
          return (
            <NavItem
              key={item.title}
              item={item}
              isActive={isActive}
              iconOnly={iconOnly}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>

      <div className="hidden lg:block border-t border-sidebar-border/60 bg-gradient-to-br from-sidebar/95 via-sidebar to-sidebar/90 overflow-hidden">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="group relative flex h-14 w-full items-center justify-center text-sidebar-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 transition-all duration-300 overflow-hidden"
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          type="button"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-sidebar-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {collapsed ? (
            <ChevronRight className="relative h-5 w-5 transition-all duration-300 group-hover:translate-x-1 group-hover:scale-110" />
          ) : (
            <ChevronLeft className="relative h-5 w-5 transition-all duration-300 group-hover:-translate-x-1 group-hover:scale-110" />
          )}
        </button>
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  // Sempre re-renderizar quando a rota mudar para atualizar indicadores ativos
  if (prevProps.location.pathname !== nextProps.location.pathname) {
    return false;
  }

  const prevExpanded = Array.from(prevProps.expandedItems).sort().join(',');
  const nextExpanded = Array.from(nextProps.expandedItems).sort().join(',');

  return (
    prevProps.collapsed === nextProps.collapsed &&
    prevProps.showExpandedLabels === nextProps.showExpandedLabels &&
    prevProps.isInMobileSheet === nextProps.isInMobileSheet &&
    prevExpanded === nextExpanded
  );
});
SidebarContent.displayName = "SidebarContent";

// ============================================================================
// MAIN SIDEBAR COMPONENT
// ============================================================================

/** Igual à transição `duration-300` da largura do aside desktop */
const SIDEBAR_WIDTH_TRANSITION_MS = 320;

export const AppSidebar = memo(function AppSidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarContext();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showExpandedLabels, setShowExpandedLabels] = useState(!collapsed);
  /** Primeira vez já expandida no mount: não atrasar rótulos com timeout */
  const skipExpandLabelDelayRef = useRef(!collapsed);
  const location = useLocation();

  // Ao expandir a sidebar (desktop), só mostrar textos depois da animação de largura
  useEffect(() => {
    if (collapsed) {
      setShowExpandedLabels(false);
      return;
    }
    if (skipExpandLabelDelayRef.current) {
      skipExpandLabelDelayRef.current = false;
      setShowExpandedLabels(true);
      return;
    }
    const id = window.setTimeout(() => setShowExpandedLabels(true), SIDEBAR_WIDTH_TRANSITION_MS);
    return () => window.clearTimeout(id);
  }, [collapsed]);

  // Expandir automaticamente itens que têm subitens ativos
  useEffect(() => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      menuItems.forEach(item => {
        if (
          item.subItems &&
          item.subItems.some(
            (subItem) => location.pathname === subItem.url || location.pathname.startsWith(subItem.url + "/")
          )
        ) {
          newSet.add(item.title);
        }
      });
      return newSet;
    });
  }, [location.pathname]);

  const handleMobileNavigate = useCallback(() => {
    setMobileOpen(false);
  }, [setMobileOpen]);

  const handleToggleExpand = useCallback((title: string) => {
    return () => {
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(title)) {
          newSet.delete(title);
        } else {
          newSet.add(title);
        }
        return newSet;
      });
    };
  }, []);

  const expandedItemsKey = useMemo(() => {
    return Array.from(expandedItems).sort().join(',');
  }, [expandedItems]);

  const sidebarContentProps = useMemo(() => ({
    collapsed,
    showExpandedLabels,
    location,
    onNavigate: handleMobileNavigate,
    onToggleCollapse: toggleCollapsed,
    expandedItems,
    onToggleExpand: handleToggleExpand,
  }), [collapsed, showExpandedLabels, location, handleMobileNavigate, toggleCollapsed, expandedItemsKey, handleToggleExpand]);

  return (
    <>
      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[280px] max-w-[85vw] p-0 pt-[env(safe-area-inset-top)] bg-sidebar text-sidebar-foreground lg:hidden [&>button]:z-50"
          onInteractOutside={(e) => {
            // Permitir fechar ao clicar fora
            setMobileOpen(false);
          }}
        >
          <div className="flex h-full flex-col">
            <SidebarContent {...sidebarContentProps} isInMobileSheet />
          </div>
        </SheetContent>
      </Sheet>

      {/* Botão do menu mobile fica no header (SiteHeader) */}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col bg-gradient-to-b from-sidebar via-sidebar/98 to-sidebar text-sidebar-foreground",
          "transition-[width] duration-300 ease-in-out will-change-[width] lg:flex",
          "border-r border-sidebar-border/60 shadow-2xl backdrop-blur-sm overflow-hidden",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent {...sidebarContentProps} />
      </aside>

    </>
  );
});
