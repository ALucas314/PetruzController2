import { useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { DocumentNavProvider } from "@/contexts/DocumentNavContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppSidebar } from "@/components/AppSidebar";
import LandingPage from "./pages/LandingPage";
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

const queryClient = new QueryClient();

// Componente interno para ter acesso ao useLocation
const AppRoutes = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const isAuthPage = ["/login", "/cadastro", "/esqueci-senha", "/redefinir-senha"].includes(location.pathname);
  const isLegalPage = ["/termos", "/privacidade"].includes(location.pathname);
  const hideSidebar = isLandingPage || isAuthPage || isLegalPage;
  
  const sidebarElement = useMemo(() => {
    if (hideSidebar) return null;
    return <AppSidebar key="persistent-sidebar" />;
  }, [hideSidebar]);
  
  return (
    <>
      {sidebarElement}
      
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/esqueci-senha" element={<ForgotPassword />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/termos" element={<TermosUso />} />
        <Route path="/privacidade" element={<PoliticaPrivacidade />} />
        <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/producao" element={<ProtectedRoute><Producao /></ProtectedRoute>} />
        <Route path="/analise-producao" element={<ProtectedRoute><Producao /></ProtectedRoute>} />
        <Route path="/planejamento-pcp" element={<ProtectedRoute><PlanejamentoProducao /></ProtectedRoute>} />
        <Route path="/cadastro-linhas" element={<ProtectedRoute><CadastroLinhas /></ProtectedRoute>} />
        <Route path="/itens" element={<ProtectedRoute><Itens /></ProtectedRoute>} />
        <Route path="/importar-excel" element={<ProtectedRoute><ImportarExcel /></ProtectedRoute>} />
        <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
        <Route path="/financeiro" element={<ProtectedRoute><PlaceholderPage title="Financeiro" /></ProtectedRoute>} />
        <Route path="/estoque" element={<ProtectedRoute><PlaceholderPage title="Estoque" /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><PlaceholderPage title="Configurações" /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SidebarProvider>
        <DocumentNavProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </DocumentNavProvider>
      </SidebarProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;