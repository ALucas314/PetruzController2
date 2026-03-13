import { ReactNode, memo, useMemo } from "react";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";

export const AppLayout = memo(({ children }: { children: ReactNode }) => {
  const { collapsed } = useSidebarContext();
  const isMobile = useIsMobile();

  // Área de conteúdo se adapta: margem e largura = espaço ao lado da sidebar (não invade nem sobra)
  const contentClasses = useMemo(() => {
    if (isMobile) return "lg:ml-0 lg:w-full";
    if (collapsed) return "lg:ml-16 lg:w-[calc(100%-4rem)]"; // sidebar 4rem
    return "lg:ml-64 lg:w-[calc(100%-16rem)]"; // sidebar 16rem (w-64) para nomes completos
  }, [isMobile, collapsed]);

  return (
    <div className="min-h-screen max-w-full bg-gradient-to-br from-background via-background to-muted/20 overflow-x-hidden">
      <div
        className={cn(
          "min-h-screen w-full max-w-full min-w-0 overflow-x-hidden transition-[margin-left,width] duration-300 ease-in-out flex flex-col",
          contentClasses
        )}
      >
        <SiteHeader />
        {/* Reserva espaço quando o header é fixed (viewport < 1024px); em lg+ o header é sticky e este spacer some */}
        <div className="shrink-0 w-full lg:hidden app-header-spacer" aria-hidden />
        <main className="app-layout-main flex-1 min-h-0 pt-0 px-3 sm:pt-2 sm:px-6 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-[1920px] mx-auto w-full max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
});
AppLayout.displayName = "AppLayout";
