import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

/** Indica se o Supabase está configurado (para mensagens de erro no login). */
export const hasSupabaseConfig = url.length > 0 && anonKey.length > 0;

/** Chave usada para "Lembrar de mim": '1' = localStorage (persiste), '0' = sessionStorage (sessão só). */
const REMEMBER_KEY = "sb:remember";

/** Define se a próxima sessão deve persistir ao fechar o navegador (chamado antes do login). */
export function setRememberMe(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    // ignore
  }
}

/** Storage customizado: "Lembrar de mim" = localStorage; senão = sessionStorage. */
const customStorage = {
  getItem(key: string): string | null {
    try {
      const fromSession = sessionStorage.getItem(key);
      if (fromSession !== null) return fromSession;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      const remember = localStorage.getItem(REMEMBER_KEY) !== "0";
      if (remember) {
        sessionStorage.removeItem(key);
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
        sessionStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
  },
  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

if (!hasSupabaseConfig) {
  console.warn(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos. Crie um arquivo .env na raiz do projeto (veja .env.example)."
  );
}

export const supabase = createClient(
  url || "https://invalid.supabase.co",
  anonKey || "",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: customStorage,
    },
  }
);
