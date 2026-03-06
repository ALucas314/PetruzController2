import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Mail, Lock, User, ArrowRight, Sparkles, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiConfig } from "@/services/api/config";
import { useAuth } from "@/contexts/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Preencha todos os campos.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (!acceptTerms) {
      setError("Aceite os termos para continuar.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseURL}/api/supabase/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: name.trim(), email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao cadastrar. Tente novamente.");
        return;
      }
      if (json.data?.id != null && json.data?.email) {
        setUser({ id: json.data.id, email: json.data.email, nome: json.data.nome ?? null });
      }
      navigate("/dashboard");
    } catch (e) {
      setError("Falha de conexão. Verifique se o servidor está rodando.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo: branding (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
        <div className="absolute inset-0 flex flex-col justify-center px-12 xl:px-20">
          <div className="max-w-md space-y-8">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
                <BarChart3 className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <span className="text-xl font-bold text-foreground">ERP Controller</span>
                <span className="ml-1.5 text-xl font-semibold text-primary">Petruz</span>
              </div>
            </div>
            <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-foreground">
              Crie sua conta e{" "}
              <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                comece a produzir
              </span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Cadastre-se em poucos passos para acessar o painel de controle e as ferramentas de produção.
            </p>
            <ul className="space-y-3 text-muted-foreground">
              {["Acesso ao dashboard", "Análise de produção", "Relatórios e exportação"].map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="absolute top-1/4 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Lado direito: formulário */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex flex-col justify-center items-center p-6 sm:p-8 lg:p-12 bg-background overflow-y-auto">
        <div className="w-full max-w-md space-y-8 py-4">
          <div className="lg:hidden text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">ERP Controller Petruz</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Criar conta</h1>
          </div>

          <div
            className={cn(
              "rounded-2xl border border-border/60 bg-card/95 backdrop-blur-sm p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
              "animate-fade-in-up"
            )}
          >
            <div className="hidden lg:block mb-6">
              <h1 className="text-2xl font-bold text-foreground">Cadastro</h1>
              <p className="text-muted-foreground mt-1">Preencha os dados abaixo para criar sua conta.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground font-medium">
                  Nome completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-11 border-border/80 focus-visible:ring-primary/50"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 border-border/80 focus-visible:ring-primary/50"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 border-border/80 focus-visible:ring-primary/50"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground font-medium">
                  Confirmar senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 border-border/80 focus-visible:ring-primary/50"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary/50"
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-tight">
                  Li e aceito os{" "}
                  <Link to="/termos" className="text-primary hover:underline">termos de uso</Link>
                  {" "}e a{" "}
                  <Link to="/privacidade" className="text-primary hover:underline">política de privacidade</Link>.
                </Label>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all duration-300"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Criando conta...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Criar conta
                    <ArrowRight className="h-5 w-5" />
                  </span>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/30 rounded">
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
