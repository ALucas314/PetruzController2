import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface AuthUser {
  id: string;
  email: string;
  nome: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSessionToUser(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const u: SupabaseUser = session.user;
  const nome = (u.user_metadata?.nome as string) ?? (u.user_metadata?.name as string) ?? null;
  return {
    id: u.id,
    email: u.email ?? "",
    nome: nome || null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUserState(mapSessionToUser(s));
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUserState(mapSessionToUser(s));
    });

    return () => subscription.unsubscribe();
  }, []);

  const setUser = (u: AuthUser | null) => {
    setUserState(u);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserState(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
