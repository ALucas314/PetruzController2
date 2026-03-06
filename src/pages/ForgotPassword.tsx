import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, ArrowLeft, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiConfig, APP_BASE_URL } from "@/services/api/config";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) return;
    setLoading(true);
    setError("");
    setResetLink("");
    setMessage("");
    try {
      const res = await fetch(`${apiConfig.baseURL}/api/supabase/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrim }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erro ao solicitar link. Tente novamente.");
        return;
      }
      setMessage(json.message || "Se este e-mail estiver cadastrado, use o link abaixo.");
      if (json.token) {
        // Usa APP_BASE_URL: em produção (Netlify) use VITE_APP_URL; local usa window.location.origin
        setResetLink(`${APP_BASE_URL}/redefinir-senha?token=${json.token}`);
      }
    } catch (e) {
      setError("Falha de conexão. Verifique se o servidor está rodando.");
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">Esqueceu a senha?</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Informe seu e-mail. Se estiver cadastrado, você verá um link para redefinir sua senha.
          </p>

          {!resetLink ? (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    required
                  />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full h-11 rounded-xl" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  "Gerar link de redefinição"
                )}
              </Button>
            </form>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-success/10 border border-success/20 px-4 py-3 flex items-start gap-2 text-sm text-green-800 dark:text-green-200">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
              <p className="text-sm font-medium text-foreground">Clique no link abaixo (válido por 1 hora):</p>
              <a
                href={resetLink}
                className="block break-all rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                {resetLink}
              </a>
              <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={() => navigate("/login")}>
                Ir para o login
              </Button>
            </div>
          )}

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

export default ForgotPassword;
