import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const STORAGE_KEY = "erp_petruz_user";
const TOKEN_KEY = "erp_petruz_token";

export interface AuthUser {
  id: number;
  email: string;
  nome: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  setUser: (user: AuthUser | null, token?: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data.id === "number" && typeof data.email === "string") {
      return { id: data.id, email: data.email, nome: data.nome ?? null };
    }
  } catch {
    // ignore
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(loadStoredUser);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [user]);

  const setUser = (u: AuthUser | null, token?: string | null) => {
    setUserState(u);
    if (token !== undefined) {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    }
    if (!u) localStorage.removeItem(TOKEN_KEY);
  };
  const logout = () => {
    setUserState(null);
    localStorage.removeItem(TOKEN_KEY);
  };

  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

  return (
    <AuthContext.Provider value={{ user, token, setUser, logout }}>
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
