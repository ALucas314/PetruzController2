import { useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
  Outlet,
  Navigate,
} from "react-router-dom";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { DocumentNavProvider } from "@/contexts/DocumentNavContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppSidebar } from "@/components/AppSidebar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import RedefinirSenha from "./pages/RedefinirSenha";
import TermosUso from "./pages/TermosUso";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlaceholderPage from "./pages/PlaceholderPage";
import Producao from "./pages/Producao";
import PlanejamentoProducao from "./pages/PlanejamentoProducao";
import Itens from "./pages/Itens";
import ImportarExcel from "./pages/ImportarExcel";
import CadastroLinhas from "./pages/CadastroLinhas";
import Relatorios from "./pages/Relatorios";
import GuiaDesenvolvedor from "./pages/GuiaDesenvolvedor";

const queryClient = new QueryClient();

const AppLayout = () => {
  const location = useLocation();
  const isAuthPage = ["/login", "/cadastro", "/esqueci-senha", "/redefinir-senha"].includes(location.pathname);
  const isLegalPage = ["/termos", "/privacidade"].includes(location.pathname);
  const hideSidebar = isAuthPage || isLegalPage;

  const sidebarElement = useMemo(() => {
    if (hideSidebar) return null;
    return <AppSidebar key="persistent-sidebar" />;
  }, [hideSidebar]);

  return (
    <>
      {sidebarElement}
      <Outlet />
    </>
  );
};

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: "login", element: <Login /> },
      { path: "cadastro", element: <Register /> },
      { path: "esqueci-senha", element: <ForgotPassword /> },
      { path: "redefinir-senha", element: <RedefinirSenha /> },
      { path: "termos", element: <TermosUso /> },
      { path: "privacidade", element: <PoliticaPrivacidade /> },
      { path: "dashboard", element: <ProtectedRoute><Index /></ProtectedRoute> },
      { path: "producao", element: <ProtectedRoute><Producao /></ProtectedRoute> },
      { path: "analise-producao", element: <ProtectedRoute><Producao /></ProtectedRoute> },
      { path: "planejamento-pcp", element: <ProtectedRoute><PlanejamentoProducao /></ProtectedRoute> },
      { path: "cadastro-linhas", element: <ProtectedRoute><CadastroLinhas /></ProtectedRoute> },
      { path: "itens", element: <ProtectedRoute><Itens /></ProtectedRoute> },
      { path: "importar-excel", element: <ProtectedRoute><ImportarExcel /></ProtectedRoute> },
      { path: "relatorios", element: <ProtectedRoute><Relatorios /></ProtectedRoute> },
      { path: "guia-desenvolvedor", element: <ProtectedRoute><GuiaDesenvolvedor /></ProtectedRoute> },
      { path: "financeiro", element: <ProtectedRoute><PlaceholderPage title="Financeiro" /></ProtectedRoute> },
      { path: "estoque", element: <ProtectedRoute><PlaceholderPage title="Estoque" /></ProtectedRoute> },
      { path: "configuracoes", element: <ProtectedRoute><PlaceholderPage title="Configurações" /></ProtectedRoute> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <SidebarProvider>
            <DocumentNavProvider>
              <Toaster />
              <Sonner />
              <RouterProvider router={router} />
            </DocumentNavProvider>
          </SidebarProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;