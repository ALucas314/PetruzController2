/**
 * Configuração de conexão com Supabase
 * Configure as variáveis de ambiente no arquivo .env (src/Data/.env)
 *
 * NOTA: Supabase agora usa "Publishable key" e "Secret key" em vez de "anon" e "service_role"
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../src/Data/.env") });

export const supabaseConfig = {
  url: process.env.SUPABASE_URL || "",
  // Suporta tanto as novas chaves quanto as antigas (para compatibilidade)
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  secretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  // Mantém compatibilidade com nomes antigos
  anonKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  serviceRoleKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

/**
 * Valida se a configuração do Supabase está completa
 */
export function validateSupabaseConfig() {
  if (!supabaseConfig.url) {
    throw new Error("SUPABASE_URL não configurada. Configure no arquivo .env ou em server/config/supabase.js");
  }
  if (!supabaseConfig.secretKey && !supabaseConfig.serviceRoleKey) {
    throw new Error("SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) não configurada. Configure no arquivo .env ou em server/config/supabase.js");
  }
  return true;
}
