/**
 * Configuração da API (legado — login e dados usam Supabase direto).
 * NÃO defina VITE_API_URL como URL do próprio site (Netlify ou localhost), senão dá 404.
 */
const envApiUrl = import.meta.env.VITE_API_URL?.trim() || "";
const defaultApi = "http://localhost:3001";
let API_BASE_URL = envApiUrl !== "" ? envApiUrl : defaultApi;
if (typeof window !== "undefined" && window.location?.origin && API_BASE_URL.startsWith(window.location.origin)) {
  API_BASE_URL = defaultApi;
}

/** URL pública do frontend para links (ex.: redefinir senha). Em produção usa a origem atual; localmente usa VITE_APP_URL ou localhost. */
function getAppBaseUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    const origin = window.location.origin;
    // Se estiver acessando de um domínio real (não localhost), o link deve ser online
    if (!origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return origin;
    }
  }
  return import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "") || "";
}

export const APP_BASE_URL = getAppBaseUrl();
const TOKEN_KEY = "erp_petruz_token";

export const apiConfig = {
  baseURL: API_BASE_URL,
  endpoints: {
    health: "/api/health",
    query: "/api/query",
  },
  timeout: 30000, // 30 segundos
};

/** Cabeçalhos de autenticação (JWT) para uso em requisições à API */
export function getAuthHeaders(): Record<string, string> {
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // ignore
  }
  return {};
}

/**
 * Tipos de resposta da API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

/**
 * Erro customizado da API
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}
