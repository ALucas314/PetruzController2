import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Factory, 
  TrendingUp, 
  Target, 
  BarChart3, 
  ArrowRight, 
  CheckCircle2,
  Zap,
  Shield,
  Users,
  Sparkles,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: Factory,
      title: "Controle de Produção",
      description: "Gerencie sua produção com análises em tempo real e planejamento PCP avançado",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: TrendingUp,
      title: "Análises Avançadas",
      description: "Dashboards interativos com gráficos e métricas detalhadas do seu negócio",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Target,
      title: "Planejamento Estratégico",
      description: "Planejamento PCP completo para otimizar sua produção e recursos",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: BarChart3,
      title: "Relatórios Inteligentes",
      description: "Gere relatórios completos e exporte dados para análise detalhada",
      color: "from-green-500 to-emerald-500"
    }
  ];

  const benefits = [
    "Interface moderna e intuitiva",
    "Análises em tempo real",
    "Planejamento PCP automatizado",
    "Exportação de dados em múltiplos formatos",
    "Dashboard personalizável",
    "Suporte completo ao processo produtivo"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header: logo + Entrar / Cadastrar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-3 sm:px-6 lg:px-8 flex h-14 sm:h-16 items-center justify-between min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-base sm:text-lg font-bold text-foreground truncate">ERP Controller</span>
            <span className="text-base sm:text-lg font-semibold text-primary shrink-0">Petruz</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Button variant="ghost" asChild className="text-foreground hover:bg-primary/10 min-h-[44px] sm:min-h-0 px-3">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px] sm:min-h-0 px-4">
              <Link to="/cadastro">Cadastrar</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
            style={{ transform: `translateY(${scrollY * 0.5}px)` }}
          />
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm animate-fade-in">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">ERP Controller Petruz</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight animate-fade-in-up">
              <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                Controle Total da Sua
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent animate-gradient">
                Produção Industrial
              </span>
            </h1>

            {/* Description */}
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto animate-fade-in-up delay-200">
              Sistema completo de gestão de produção com análises em tempo real, 
              planejamento PCP e dashboards interativos para otimizar seus resultados.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 animate-fade-in-up delay-300">
              <Button
                size="lg"
                onClick={() => navigate("/dashboard")}
                className="group h-14 px-8 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Começar Agora
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/analise-producao")}
                className="h-14 px-8 text-lg font-semibold border-2 hover:bg-primary/10 transition-all duration-300"
              >
                Ver Demonstração
              </Button>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-muted-foreground text-sm pt-2 sm:pt-0">
                <Link to="/login" className="font-semibold text-primary hover:underline">Entrar</Link>
                <span className="text-border">·</span>
                <Link to="/cadastro" className="font-semibold text-primary hover:underline">Cadastrar</Link>
              </div>
            </div>

            {/* Scroll Indicator */}
            <div className="pt-16 animate-bounce">
              <ChevronDown className="h-8 w-8 mx-auto text-muted-foreground" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Recursos Poderosos
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para gerenciar sua produção de forma eficiente
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:scale-105"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Gradient Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-500`} />
                  
                  <div className="relative z-10">
                    <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${feature.color} mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-card-foreground group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative py-24 sm:py-32 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">Vantagens</span>
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Por que escolher nosso sistema?
                </h2>
                <p className="text-lg text-muted-foreground">
                  Uma solução completa que transforma a forma como você gerencia sua produção industrial.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3 group">
                      <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <span className="text-lg text-card-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  onClick={() => navigate("/dashboard")}
                  className="mt-6 group h-12 px-8 font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary"
                >
                  Acessar Sistema
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              <div className="relative">
                <div className="relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 shadow-2xl">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                        <Factory className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-card-foreground">Produção em Tempo Real</h4>
                        <p className="text-sm text-muted-foreground">Monitoramento 24/7</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-card-foreground">Análises Avançadas</h4>
                        <p className="text-sm text-muted-foreground">Insights inteligentes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-card-foreground">Segurança Total</h4>
                        <p className="text-sm text-muted-foreground">Dados protegidos</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-12 sm:p-16 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-3xl blur-2xl opacity-50" />
              <div className="relative z-10 space-y-6">
                <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Pronto para transformar sua produção?
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Comece agora e veja a diferença que um sistema completo de gestão pode fazer.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <Button
                    size="lg"
                    onClick={() => navigate("/dashboard")}
                    className="group h-14 px-8 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl"
                  >
                    Começar Agora
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/analise-producao")}
                    className="h-14 px-8 text-lg font-semibold border-2"
                  >
                    Ver Demonstração
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border/50 bg-muted/30 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span className="text-base font-bold text-foreground">ERP Controller</span>
                <span className="text-primary block">Petruz</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 ERP Controller Petruz. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
