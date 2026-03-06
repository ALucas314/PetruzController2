import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiConfig } from "@/services/api/config";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseURL}/api/supabase/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao entrar. Tente novamente.");
        return;
      }
      if (json.data?.id != null && json.data?.email) {
        setUser(
          { id: json.data.id, email: json.data.email, nome: json.data.nome ?? null },
          json.token ?? null
        );
      }
      navigate("/dashboard");
    } catch (e) {
      setError("Falha de conexão. Verifique se o servidor está rodando.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Lado esquerdo: branding */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-background">
        <div className="absolute inset-0 flex flex-col justify-center px-14 xl:px-24">
          <div className="max-w-md space-y-10">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/25">
                <BarChart3 className="h-9 w-9 text-primary-foreground" />
              </div>
              <div>
                <span className="text-2xl font-bold text-foreground tracking-tight">ERP Controller</span>
                <span className="ml-2 text-2xl font-semibold text-primary">Petruz</span>
              </div>
            </div>
            <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-foreground leading-tight">
              Controle total da sua{" "}
              <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                produção
              </span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Faça login para acessar o painel, análises em tempo real e o planejamento PCP.
            </p>
            <ul className="space-y-4 text-muted-foreground">
              {["Análises em tempo real", "Planejamento PCP", "Dashboards e relatórios"].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary/25 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-10 w-72 h-72 bg-primary/15 rounded-full blur-3xl" />
      </div>

      {/* Lado direito: formulário */}
      <div className="flex-1 flex flex-col justify-center items-center min-h-screen p-4 pt-6 sm:p-8 lg:p-12 pb-[env(safe-area-inset-bottom)] bg-gradient-to-b from-background to-muted/20 w-full max-w-full">
        <div className="w-full max-w-[400px] min-w-0 px-1">
          {/* Mobile: logo e título */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-md">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">ERP Controller</span>
              <span className="text-xl font-semibold text-primary">Petruz</span>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Entrar na sua conta</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">Use seu e-mail e senha para acessar o painel.</p>
          </div>

          {/* Card do formulário */}
          <div
            className={cn(
              "rounded-2xl border border-border/60 bg-card shadow-xl shadow-black/5",
              "ring-1 ring-black/5",
              "animate-fade-in-up"
            )}
          >
            <div className="p-5 sm:p-6 lg:p-8">
              <div className="hidden lg:block mb-7">
                <h1 className="text-2xl font-bold text-foreground">Entrar</h1>
                <p className="text-muted-foreground mt-1.5">Use seu e-mail e senha para acessar o painel.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-start gap-3 text-sm text-destructive">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-medium">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11 h-12 border-border/80 focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl bg-background/50"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground font-medium">
                      Senha
                    </Label>
                    <Link
                      to="/esqueci-senha"
                      className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/30 rounded font-medium"
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 pr-12 h-12 border-border/80 focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl bg-background/50"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/30"
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">
                    Lembrar de mim
                  </Label>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full min-h-[48px] h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-70"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Entrando...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Entrar
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Não tem uma conta?{" "}
                <Link
                  to="/cadastro"
                  className="font-semibold text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/30 rounded"
                >
                  Cadastre-se
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Ao entrar, você concorda com nossos{" "}
            <Link to="/termos" className="text-primary hover:underline">termos de uso</Link>
            {" "}e{" "}
            <Link to="/privacidade" className="text-primary hover:underline">política de privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
