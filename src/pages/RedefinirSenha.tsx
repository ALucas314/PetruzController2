import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, ArrowLeft, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

const RedefinirSenha = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const isRecovery = typeof window !== "undefined" && window.location.hash.includes("type=recovery");
      if (session && isRecovery) setRecoveryReady(true);
      else if (!isRecovery && !session) setError("Link inválido ou expirado. Solicite um novo em Esqueci a senha.");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) {
        setError(err.message || "Erro ao redefinir senha. O link pode ter expirado.");
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (e) {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-muted/30 to-background">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-xl p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 text-green-600 dark:text-green-400 mb-4">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Senha alterada</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Sua senha foi redefinida. Redirecionando para o login...
          </p>
          <Button asChild className="mt-6 w-full rounded-xl">
            <Link to="/login">Ir para o login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-muted/30 to-background">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-md">
              <BarChart3 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">ERP Controller</span>
            <span className="text-xl font-semibold text-primary">Petruz</span>
          </Link>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card shadow-xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-foreground">Nova senha</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Digite e confirme sua nova senha. Ela deve ter no mínimo 6 caracteres.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 h-11 rounded-xl"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-11 rounded-xl"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showPw"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary"
              />
              <Label htmlFor="showPw" className="text-sm text-muted-foreground cursor-pointer">
                Mostrar senha
              </Label>
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full h-11 rounded-xl"
              disabled={loading || !recoveryReady}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : (
                "Redefinir senha"
              )}
            </Button>
          </form>

          <Button variant="ghost" asChild className="mt-4 w-full rounded-xl">
            <Link to="/login" className="flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RedefinirSenha;
