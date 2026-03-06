import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { supabaseConfig, validateSupabaseConfig } from "../config/supabase.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_SECRET_KEY || "fallback-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

const router = express.Router();
const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_HOURS = 1;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Criar cliente Supabase com reconexão automática
let supabaseClient = null;
let lastHealthCheck = null;
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

/**
 * Verifica a saúde da conexão com Supabase
 */
async function checkConnectionHealth() {
  if (!supabaseClient) return false;
  
  try {
    // Faz uma query simples para verificar a conexão
    const { error } = await supabaseClient
      .from("OCLP")
      .select("id")
      .limit(1);
    
    if (error) {
      console.warn("Health check falhou, reconectando...", error.message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn("Erro no health check:", error.message);
    return false;
  }
}

/**
 * Reconecta ao Supabase
 */
function reconnectSupabase() {
  console.log("Reconectando ao Supabase...");
  supabaseClient = null;
  return getSupabaseClient();
}

/**
 * Obtém o cliente Supabase com reconexão automática
 */
function getSupabaseClient() {
  if (!supabaseClient) {
    try {
      validateSupabaseConfig();
      // Usa a secret key (service_role) para operações no backend
      const apiKey = supabaseConfig.secretKey || supabaseConfig.serviceRoleKey || supabaseConfig.publishableKey || supabaseConfig.anonKey;
      supabaseClient = createClient(
        supabaseConfig.url,
        apiKey,
        {
          // Configurações para manter conexão estável
          auth: {
            persistSession: false, // Não precisa persistir sessão no backend
            autoRefreshToken: true,
            detectSessionInUrl: false
          },
          // Timeout aumentado
          db: {
            schema: 'public',
          },
          global: {
            headers: {
              'x-client-info': 'erp-controller-petruz-server',
            },
          },
          // Configurações de retry
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        }
      );
      
      console.log("✅ Cliente Supabase inicializado com sucesso");
      lastHealthCheck = Date.now();
    } catch (error) {
      console.error("❌ Erro ao criar cliente Supabase:", error);
      throw error;
    }
  }
  
  // Health check periódico
  const now = Date.now();
  if (!lastHealthCheck || (now - lastHealthCheck) > HEALTH_CHECK_INTERVAL) {
    checkConnectionHealth().then((isHealthy) => {
      if (!isHealthy) {
        reconnectSupabase();
      } else {
        lastHealthCheck = now;
      }
    }).catch(() => {
      reconnectSupabase();
    });
  }
  
  return supabaseClient;
}

/**
 * Executa uma operação com retry automático
 */
async function executeWithRetry(operation, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const supabase = getSupabaseClient();
      const result = await operation(supabase);
      
      // Se sucesso, atualiza health check
      lastHealthCheck = Date.now();
      return result;
    } catch (error) {
      const isLastAttempt = i === retries - 1;
      const isConnectionError = 
        error.message?.includes('fetch') ||
        error.message?.includes('network') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('timeout') ||
        error.code === 'PGRST116' || // PostgREST connection error
        error.code === 'PGRST301';    // PostgREST timeout
      
      if (isConnectionError && !isLastAttempt) {
        console.warn(`⚠️ Erro de conexão (tentativa ${i + 1}/${retries}), reconectando...`, error.message);
        reconnectSupabase();
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
        continue;
      }
      
      if (isLastAttempt) {
        console.error("❌ Erro após todas as tentativas:", error);
        throw error;
      }
      
      throw error;
    }
  }
}

/**
 * Cadastro de usuário (tabela OCTU)
 * POST /api/supabase/auth/register
 * Body: { nome, email, password }
 */
router.post("/auth/register", async (req, res) => {
  try {
    const { nome, email, password } = req.body || {};
    const emailTrim = (email || "").toString().trim().toLowerCase();
    const nomeTrim = (nome || "").toString().trim();
    const passwordStr = (password || "").toString();

    if (!emailTrim) {
      return res.status(400).json({ success: false, error: "E-mail é obrigatório." });
    }
    if (!passwordStr || passwordStr.length < 6) {
      return res.status(400).json({ success: false, error: "Senha deve ter no mínimo 6 caracteres." });
    }

    const supabase = getSupabaseClient();
    const { data: existing } = await supabase.from("OCTU").select("id").eq("email", emailTrim).limit(1);
    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, error: "Este e-mail já está cadastrado." });
    }

    const password_hash = bcrypt.hashSync(passwordStr, BCRYPT_ROUNDS);
    const { data, error } = await supabase
      .from("OCTU")
      .insert({ email: emailTrim, password_hash, nome: nomeTrim || null, ativo: true })
      .select("id, email, nome, created_at")
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("Erro ao cadastrar usuário:", err);
    // Violação de e-mail único (constraint UNIQUE na OCTU) — não permitir cadastro duplicado
    const code = err.code || err?.code;
    if (code === "23505" || (err.message && String(err.message).includes("duplicate key") && String(err.message).includes("email"))) {
      return res.status(400).json({ success: false, error: "Este e-mail já está cadastrado. Use outro e-mail ou faça login." });
    }
    res.status(500).json({ success: false, error: err.message || "Erro ao cadastrar usuário." });
  }
});

/**
 * Login (tabela OCTU)
 * POST /api/supabase/auth/login
 * Body: { email, password }
 */
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const emailTrim = (email || "").toString().trim().toLowerCase();
    const passwordStr = (password || "").toString();

    if (!emailTrim || !passwordStr) {
      return res.status(400).json({ success: false, error: "E-mail e senha são obrigatórios." });
    }

    const supabase = getSupabaseClient();
    const { data: user, error: fetchError } = await supabase
      .from("OCTU")
      .select("id, email, nome, password_hash, ativo")
      .eq("email", emailTrim)
      .limit(1)
      .single();

    if (fetchError) {
      if (fetchError.code === "42P01" || fetchError.code === "PGRST204") {
        console.error("Tabela OCTU não existe ou não acessível:", fetchError.message);
        return res.status(500).json({
          success: false,
          error: "Tabela de usuários (OCTU) não encontrada. Execute o script SQL de criação no Supabase.",
        });
      }
      console.error("Erro Supabase no login:", fetchError);
      return res.status(401).json({ success: false, error: "E-mail ou senha inválidos." });
    }
    if (!user) {
      return res.status(401).json({ success: false, error: "E-mail ou senha inválidos." });
    }
    if (user.ativo === false) {
      return res.status(403).json({ success: false, error: "Usuário inativo." });
    }

    let ok = false;
    try {
      ok = bcrypt.compareSync(passwordStr, user.password_hash || "");
    } catch (bcryptErr) {
      console.error("Erro ao verificar senha (hash inválido?):", bcryptErr.message);
      return res.status(401).json({ success: false, error: "E-mail ou senha inválidos." });
    }
    if (!ok) {
      return res.status(401).json({ success: false, error: "E-mail ou senha inválidos." });
    }

    const { password_hash, ...safe } = user;
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ success: true, data: safe, token });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ success: false, error: err.message || "Erro ao fazer login." });
  }
});

/**
 * Rascunho por usuário e tela (mesmo usuário em turnos diferentes vê o estado deixado)
 * GET /api/supabase/draft?user_id=123&screen=producao
 */
router.get("/draft", async (req, res) => {
  try {
    const userId = req.query.user_id;
    const screen = (req.query.screen || "").toString().trim();
    if (!userId || !screen) {
      return res.status(400).json({ success: false, error: "user_id e screen são obrigatórios." });
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("OCTU_DRAFT")
      .select("data, updated_at")
      .eq("user_id", userId)
      .eq("screen", screen)
      .limit(1)
      .maybeSingle();
    if (error) {
      if (error.code === "42P01") {
        return res.status(200).json({ success: true, data: null, message: "Tabela OCTU_DRAFT não existe. Execute OCTU_DRAFT_TABLE.sql no Supabase." });
      }
      throw error;
    }
    res.json({ success: true, data: data?.data ?? null, updated_at: data?.updated_at ?? null });
  } catch (err) {
    console.error("Erro ao buscar rascunho:", err);
    res.status(500).json({ success: false, error: err.message || "Erro ao buscar rascunho." });
  }
});

/**
 * Salvar rascunho por usuário e tela
 * POST /api/supabase/draft
 * Body: { user_id: number, screen: string, data: object }
 */
router.post("/draft", async (req, res) => {
  try {
    const { user_id: userId, screen, data } = req.body || {};
    const screenStr = (screen || "").toString().trim();
    if (userId == null || userId === "" || !screenStr) {
      return res.status(400).json({ success: false, error: "user_id e screen são obrigatórios." });
    }
    const payload = data != null && typeof data === "object" ? data : {};
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("OCTU_DRAFT")
      .upsert(
        { user_id: Number(userId), screen: screenStr, data: payload, updated_at: new Date().toISOString() },
        { onConflict: "user_id,screen" }
      );
    if (error) {
      if (error.code === "42P01") {
        return res.status(500).json({ success: false, error: "Tabela OCTU_DRAFT não existe. Execute OCTU_DRAFT_TABLE.sql no Supabase." });
      }
      throw error;
    }
    res.json({ success: true, message: "Rascunho salvo." });
  } catch (err) {
    console.error("Erro ao salvar rascunho:", err);
    res.status(500).json({ success: false, error: err.message || "Erro ao salvar rascunho." });
  }
});

/**
 * Esqueci a senha – gera token e retorna link (sem e-mail: frontend exibe o link)
 * POST /api/supabase/auth/forgot-password
 * Body: { email }
 */
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    const emailTrim = (email || "").toString().trim().toLowerCase();
    if (!emailTrim) {
      return res.status(400).json({ success: false, error: "E-mail é obrigatório." });
    }

    const supabase = getSupabaseClient();
    const { data: user } = await supabase.from("OCTU").select("id").eq("email", emailTrim).limit(1).single();

    if (!user?.id) {
      return res.json({ success: true, message: "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    try {
      await supabase.from("OCTU_RESET").insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });
    } catch (e) {
      if (e.code === "42P01") {
        return res.status(500).json({ success: false, error: "Tabela de redefinição de senha não existe. Execute o script OCTU_RESET_TABLE.sql no Supabase." });
      }
      throw e;
    }

    res.json({
      success: true,
      message: "Se este e-mail estiver cadastrado, use o link abaixo para redefinir sua senha.",
      token: rawToken,
    });
  } catch (err) {
    console.error("Erro em forgot-password:", err);
    res.status(500).json({ success: false, error: err.message || "Erro ao solicitar redefinição." });
  }
});

/**
 * Redefinir senha com token
 * POST /api/supabase/auth/reset-password
 * Body: { token, newPassword }
 */
router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    const tokenStr = (token || "").toString().trim();
    const passwordStr = (newPassword || "").toString();

    if (!tokenStr) {
      return res.status(400).json({ success: false, error: "Token inválido ou expirado." });
    }
    if (!passwordStr || passwordStr.length < 6) {
      return res.status(400).json({ success: false, error: "A nova senha deve ter no mínimo 6 caracteres." });
    }

    const supabase = getSupabaseClient();
    const tokenHash = hashToken(tokenStr);
    const now = new Date().toISOString();

    const { data: row, error: fetchErr } = await supabase
      .from("OCTU_RESET")
      .select("id, user_id")
      .eq("token_hash", tokenHash)
      .gt("expires_at", now)
      .limit(1)
      .single();

    if (fetchErr || !row) {
      return res.status(400).json({ success: false, error: "Token inválido ou expirado. Solicite um novo link." });
    }

    const password_hash = bcrypt.hashSync(passwordStr, BCRYPT_ROUNDS);
    const { error: updateErr } = await supabase.from("OCTU").update({ password_hash, updated_at: now }).eq("id", row.user_id);
    if (updateErr) throw updateErr;

    await supabase.from("OCTU_RESET").delete().eq("id", row.id);

    res.json({ success: true, message: "Senha alterada com sucesso. Faça login com a nova senha." });
  } catch (err) {
    console.error("Erro em reset-password:", err);
    res.status(500).json({ success: false, error: err.message || "Erro ao redefinir senha." });
  }
});

/**
 * Rota para buscar todos os itens do banco
 * GET /api/supabase/items
 *
 * OBS: Agora usa a tabela OCTI (modelo SAP-like) em vez da tabela "itens"
 */
router.get("/items", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("OCTI")
      .select('id, line_id, "Code", "Name", "U_Uom", "U_ItemGroup"')
      // Supabase retorna no máximo 1000 registros por padrão.
      // Usamos range para buscar até 6000 itens (ajuste se precisar de mais).
      .range(0, 5999)
      .order("Code");

    if (error) {
      throw error;
    }

    // Opcional: adaptar nomes para o frontend, se necessário
    const adapted = (data || []).map((item) => ({
      id: item.id,
      line_id: item.line_id,
      codigo_item: item.Code,
      nome_item: item.Name,
      unidade_medida: item.U_Uom,
      grupo_itens: item.U_ItemGroup,
    }));

    res.json({
      success: true,
      data: adapted,
      count: adapted.length,
    });
  } catch (error) {
    console.error("Erro ao buscar itens:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar itens do banco",
    });
  }
});

/**
 * Rota de teste para buscar descrição por código
 * GET /api/supabase/test-item/:code
 */
router.get("/test-item/:code", async (req, res) => {
  try {
    const rawCode = (req.params.code || "").toString().trim();
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("OCTI")
      .select('id, line_id, "Code", "Name", "U_Uom", "U_ItemGroup"')
      .eq("Code", rawCode)
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.json({
        success: false,
        message: `Nenhum item encontrado com código: ${rawCode}`,
        code: rawCode,
      });
    }

    const item = data[0];
    res.json({
      success: true,
      code: item.Code,
      description: item.Name,
      fullData: item,
    });
  } catch (error) {
    console.error("Erro ao buscar item:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar item por código",
    });
  }
});

/**
 * Rota para buscar um item específico por código (OCTI)
 * GET /api/supabase/items/by-code/:code
 */
router.get("/items/by-code/:code", async (req, res) => {
  try {
    const rawCode = (req.params.code || "").toString().trim();
    if (!rawCode) {
      return res.status(400).json({
        success: false,
        error: "Código do item é obrigatório",
      });
    }

    const supabase = getSupabaseClient();

    // Tentar buscar pelo código exato e pela versão sem zeros à esquerda
    const normalized = rawCode.replace(/^0+/, "") || rawCode;
    const codesToSearch = Array.from(new Set([rawCode, normalized]));

    const { data, error } = await supabase
      .from("OCTI")
      .select('id, line_id, "Code", "Name", "U_Uom", "U_ItemGroup"')
      .in("Code", codesToSearch)
      .order("Code")
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.json({
        success: true,
        data: null,
      });
    }

    const item = data[0];
    const adapted = {
      id: item.id,
      line_id: item.line_id,
      codigo_item: item.Code,
      nome_item: item.Name,
      unidade_medida: item.U_Uom,
      grupo_itens: item.U_ItemGroup,
    };

    res.json({
      success: true,
      data: adapted,
    });
  } catch (error) {
    console.error("Erro ao buscar item por código:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar item por código",
    });
  }
});

/**
 * Rota para buscar linhas de produção (OCLP)
 * GET /api/supabase/lines
 */
router.get("/lines", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("OCLP")
      .select('id, line_id, "Code", "Name"');

    if (error) {
      throw error;
    }

    const adapted = (data || [])
      .map((line) => ({
        id: line.id,
        line_id: line.line_id,
        code: line.Code,
        name: line.Name,
      }))
      // Filtrar linhas com código válido (não vazio, não null, não "0")
      .filter((line) => line.code && line.code !== "0" && String(line.code).trim() !== "")
      // Ordenar numericamente pelo código (1,2,3,...10,11,12,13)
      .sort((a, b) => {
        const codeA = String(a.code).trim();
        const codeB = String(b.code).trim();
        
        // Extrair números dos códigos (aceita tanto números simples quanto formato L01)
        const numA = /^\d+$/.test(codeA) 
          ? parseInt(codeA, 10) 
          : (codeA.match(/L(\d+)/i) ? parseInt(codeA.match(/L(\d+)/i)[1], 10) : 0);
        const numB = /^\d+$/.test(codeB) 
          ? parseInt(codeB, 10) 
          : (codeB.match(/L(\d+)/i) ? parseInt(codeB.match(/L(\d+)/i)[1], 10) : 0);
        
        if (numA > 0 && numB > 0) return numA - numB;
        // fallback para ordenação alfabética se não forem numéricos
        return codeA.localeCompare(codeB);
      });

    res.json({
      success: true,
      data: adapted,
      count: adapted.length,
    });
  } catch (error) {
    console.error("Erro ao buscar linhas de produção:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar linhas de produção",
    });
  }
});

/**
 * Rota para criar uma nova linha de produção
 * POST /api/supabase/lines
 * Body: { name: string }
 * O código é gerado automaticamente
 */
router.post("/lines", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Nome é obrigatório",
      });
    }

    const supabase = getSupabaseClient();

    // Verificar se já existe uma linha com o mesmo nome (case-insensitive)
    const { data: existingByName, error: checkError } = await supabase
      .from("OCLP")
      .select('"Name"')
      .ilike("Name", name.trim());

    if (checkError) {
      throw checkError;
    }

    if (existingByName && existingByName.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Já existe uma linha com este nome",
      });
    }

    // Buscar todas as linhas para gerar o próximo código
    const { data: existingLines, error: fetchError } = await supabase
      .from("OCLP")
      .select('"Code"')
      .order("Code", { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    // Gerar código automático: números sequenciais (1, 2, 3, ..., 12, 13, etc.)
    // Se já existe 12, o próximo será 13
    let nextCode = "1";
    if (existingLines && existingLines.length > 0) {
      // Extrair números dos códigos existentes
      // Aceita tanto números simples (1, 2, 12) quanto formato L01, L12, etc.
      const codes = existingLines
        .map((line) => {
          if (!line.Code) return 0;
          const codeStr = String(line.Code).trim();
          
          // Se for apenas número (1, 2, 12, etc.)
          if (/^\d+$/.test(codeStr)) {
            return parseInt(codeStr, 10);
          }
          
          // Se for formato L seguido de números (L01, L12, etc.)
          const match = codeStr.match(/L(\d+)/i);
          if (match) {
            return parseInt(match[1], 10);
          }
          
          return 0;
        })
        .filter((num) => num > 0);

      if (codes.length > 0) {
        // Encontrar o maior número e incrementar
        const maxNumber = Math.max(...codes);
        const nextNumber = maxNumber + 1;
        // Gerar como número simples (sem prefixo L)
        nextCode = String(nextNumber);
      }
    }

    const { data, error } = await supabase
      .from("OCLP")
      .insert([
        {
          "Code": nextCode,
          "Name": name.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      // Verificar se é erro de duplicata
      if (error.code === "23505") {
        return res.status(400).json({
          success: false,
          error: "Já existe uma linha com este código",
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: {
        id: data.id,
        line_id: data.line_id,
        code: data.Code,
        name: data.Name,
      },
      message: "Linha cadastrada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao criar linha:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao criar linha no banco",
    });
  }
});

/**
 * Rota para atualizar uma linha de produção
 * PUT /api/supabase/lines/:id
 * Body: { name: string, code?: string }
 * O código não pode ser alterado (mantém o original)
 */
router.put("/lines/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Nome é obrigatório",
      });
    }

    const supabase = getSupabaseClient();

    // Buscar a linha atual para manter o código original
    const { data: currentLine, error: fetchError } = await supabase
      .from("OCLP")
      .select('"Code", "Name"')
      .eq("id", id)
      .single();

    if (fetchError || !currentLine) {
      return res.status(404).json({
        success: false,
        error: "Linha não encontrada",
      });
    }

    // Verificar se já existe outra linha com o mesmo nome (ignorando a linha atual)
    // Só valida se o nome foi alterado
    if (currentLine.Name.trim().toLowerCase() !== name.trim().toLowerCase()) {
      const { data: existingByName, error: checkError } = await supabase
        .from("OCLP")
        .select('"Name"')
        .ilike("Name", name.trim())
        .neq("id", id);

      if (checkError) {
        throw checkError;
      }

      if (existingByName && existingByName.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Já existe uma linha com este nome",
        });
      }
    }

    // Manter o código original, apenas atualizar o nome
    const { data, error } = await supabase
      .from("OCLP")
      .update({
        "Name": name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      // Verificar se é erro de duplicata
      if (error.code === "23505") {
        return res.status(400).json({
          success: false,
          error: "Já existe uma linha com este código",
        });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Linha não encontrada",
      });
    }

    res.json({
      success: true,
      data: {
        id: data.id,
        line_id: data.line_id,
        code: data.Code,
        name: data.Name,
      },
      message: "Linha atualizada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao atualizar linha:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao atualizar linha no banco",
    });
  }
});

/**
 * Rota para deletar uma linha de produção
 * DELETE /api/supabase/lines/:id
 */
router.delete("/lines/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("OCLP")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: "Linha deletada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao deletar linha:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao deletar linha do banco",
    });
  }
});

/**
 * Rota para comparar CSV com banco e identificar itens novos
 * POST /api/supabase/compare
 * Body: { items: [{ codigo, nome, unidade, grupo }] }
 * 
 * Diferencia itens por Code E Name juntos (evita duplicatas)
 */
router.post("/compare", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: "Array de itens é obrigatório",
      });
    }

    console.log(`Iniciando comparação de ${items.length} itens...`);

    const supabase = getSupabaseClient();

    // Buscar TODOS os itens existentes no banco (tabela OCTI)
    // Buscar Code E Name para comparar ambos
    // Buscar em lotes para não ter limite (Supabase retorna max 1000 por padrão)
    console.log("Buscando todos os itens existentes no banco...");
    const existingItems = [];
    const batchSize = 1000; // Supabase limita a 1000 por padrão
    let from = 0;
    let hasMore = true;
    let totalFetched = 0;

    while (hasMore) {
      const { data: batch, error: fetchError } = await supabase
        .from("OCTI")
        .select('"Code", "Name"')
        .range(from, from + batchSize - 1)
        .order("id", { ascending: true });

      if (fetchError) {
        console.error("Erro ao buscar itens existentes:", fetchError);
        throw fetchError;
      }

      if (batch && batch.length > 0) {
        existingItems.push(...batch);
        totalFetched += batch.length;
        from += batchSize;
        
        // Log de progresso a cada 2000 itens
        if (totalFetched % 2000 === 0 || batch.length < batchSize) {
          console.log(`Buscados ${totalFetched} itens do banco...`);
        }
        
        // Se retornou menos que o batchSize, não há mais itens
        if (batch.length < batchSize) {
          hasMore = false;
        }
        
        // Limite de segurança: se já buscou mais de 100.000 itens, parar
        if (totalFetched >= 100000) {
          console.warn("Limite de segurança atingido (100.000 itens). Parando busca.");
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`Total de ${existingItems.length} itens encontrados no banco`);

    // Criar um Set com chave composta "Code|Name" (case-insensitive)
    // Isso permite verificar se já existe um item com o mesmo Code E Name
    console.log("Criando mapa de itens existentes...");
    const existingItemsMap = new Set(
      (existingItems || []).map((item) => {
        const code = (item.Code?.toString().trim() || "").toLowerCase();
        const name = (item.Name?.toString().trim() || "").toLowerCase();
        return `${code}|${name}`;
      })
    );

    console.log(`Mapa criado com ${existingItemsMap.size} itens únicos`);

    // Identificar itens novos (que não existem com Code E Name iguais)
    // Processar em lotes para evitar problemas de memória
    console.log("Processando itens do CSV...");
    // Reutilizar batchSize já declarado acima
    const newItems = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchNewItems = batch
        .map((item) => {
          const codigo = item.codigo?.toString().trim() ||
            item["Nº do item"]?.toString().trim() ||
            item.codigo_item?.toString().trim();

          const nome = item.nome?.toString().trim() ||
            item["Descrição do item"]?.toString().trim() ||
            item.descricao?.toString().trim() ||
            item.nome_item?.toString().trim() ||
            "";

          if (!codigo) return null;

          // Criar chave composta para comparação
          const codeKey = codigo.toLowerCase();
          const nameKey = nome.toLowerCase();
          const compositeKey = `${codeKey}|${nameKey}`;

          // Verificar se já existe no banco (Code E Name iguais)
          const exists = existingItemsMap.has(compositeKey);

          if (exists) return null; // Já existe, não incluir

          return {
            codigo_item: codigo,
            nome_item: nome,
            unidade_medida: item.unidade?.trim() ||
              item["Unidade de medida de compra"]?.trim() ||
              item.unidade_medida?.trim() ||
              "",
            grupo_itens: item.grupo?.trim() ||
              item["Grupo de itens"]?.trim() ||
              item.grupo_itens?.trim() ||
              "",
          };
        })
        .filter((item) => item !== null); // Filtrar nulos

      newItems.push(...batchNewItems);
      
      // Log de progresso
      if ((i + batchSize) % 2000 === 0 || i + batchSize >= items.length) {
        console.log(`Processados ${Math.min(i + batchSize, items.length)} de ${items.length} itens...`);
      }
    }

    console.log(`Comparação concluída: ${newItems.length} itens novos encontrados`);

    res.json({
      success: true,
      totalItems: items.length,
      existingItems: existingItemsMap.size,
      newItems: newItems.length,
      newItemsData: newItems,
    });
  } catch (error) {
    console.error("Erro ao comparar itens:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao comparar itens",
    });
  }
});

/**
 * Rota para inserir itens novos no banco
 * POST /api/supabase/insert
 * Body: { items: [{ codigo_item, nome_item, unidade_medida, grupo_itens }] }
 * 
 * Verifica duplicatas por Code E Name antes de inserir
 */
router.post("/insert", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Array de itens é obrigatório e não pode estar vazio",
      });
    }

    const supabase = getSupabaseClient();

    // Validar estrutura dos itens recebidos do frontend
    const validItems = items.filter((item) => {
      return item.codigo_item && item.nome_item;
    });

    if (validItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Nenhum item válido encontrado. Itens devem ter código e nome.",
      });
    }

    // Buscar itens existentes para verificar duplicatas (Code E Name)
    const { data: existingItems, error: fetchError } = await supabase
      .from("OCTI")
      .select('"Code", "Name"');

    if (fetchError) {
      throw fetchError;
    }

    // Criar mapa de itens existentes (Code|Name como chave)
    const existingItemsMap = new Set(
      (existingItems || []).map((item) => {
        const code = (item.Code?.toString().trim() || "").toLowerCase();
        const name = (item.Name?.toString().trim() || "").toLowerCase();
        return `${code}|${name}`;
      })
    );

    // Filtrar apenas itens que não existem (Code E Name diferentes)
    const itemsToInsert = validItems.filter((item) => {
      const code = (item.codigo_item?.toString().trim() || "").toLowerCase();
      const name = (item.nome_item?.toString().trim() || "").toLowerCase();
      const compositeKey = `${code}|${name}`;
      return !existingItemsMap.has(compositeKey);
    });

    if (itemsToInsert.length === 0) {
      return res.json({
        success: true,
        inserted: 0,
        total: validItems.length,
        skipped: validItems.length,
        message: "Todos os itens já existem no banco (mesmo Code e Name)",
        data: [],
      });
    }

    // Adaptar para estrutura da tabela OCTI
    const octiItems = itemsToInsert.map((item) => ({
      Code: item.codigo_item,
      Name: item.nome_item,
      U_Uom: item.unidade_medida,
      U_ItemGroup: item.grupo_itens,
    }));

    // Inserir apenas itens novos no banco (tabela OCTI)
    const { data, error } = await supabase
      .from("OCTI")
      .insert(octiItems)
      .select();

    if (error) {
      // Se for erro de duplicata (mesmo Code), ainda assim retornar sucesso parcial
      if (error.code === "23505") {
        console.warn("Alguns itens já existiam (duplicata por Code):", error.message);
        return res.json({
          success: true,
          inserted: 0,
          total: validItems.length,
          skipped: validItems.length,
          message: "Itens já existem no banco (duplicata detectada)",
          data: [],
        });
      }
      throw error;
    }

    const skipped = validItems.length - itemsToInsert.length;

    res.json({
      success: true,
      inserted: data?.length || 0,
      total: validItems.length,
      skipped: skipped,
      data: data,
    });
  } catch (error) {
    console.error("Erro ao inserir itens:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao inserir itens no banco",
    });
  }
});

/**
 * Rota para salvar dados de produção
 * POST /api/supabase/producao/save
 * Body: { items: [{ numero, op, codigo, descricao, linha, qtd_planejada, qtd_realizada, diferenca, calculo_1_horas, restante_horas, hora_final_previsao }] }
 * 
 * OBS: Agora salva na tabela OCPD (modelo SAP-like) em vez da tabela "producao"
 */
router.post("/producao/save", async (req, res) => {
  try {
    const { items, reprocessos, data: dataParam, latasPrevista, latasRealizadas, latasBatidas, totalCortado, percentualMeta, totalReprocesso, filialNome, existingOcpdIds } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Array de itens de produção é obrigatório",
      });
    }

    const supabase = getSupabaseClient();

    // existingOcpdIds: array paralelo a items; se item[i] já existe no banco, existingOcpdIds[i] é o id OCPD; senão null
    const existingIds = Array.isArray(existingOcpdIds) ? existingOcpdIds : [];

    // Buscar linhas de produção (OCLP) para resolver line_id a partir do código/nome da linha
    let oclpLines = [];
    try {
      const { data: oclpData } = await supabase.from("OCLP").select('id, "Code", "Name"');
      oclpLines = oclpData || [];
    } catch (e) {
      console.warn("Erro ao carregar OCLP para line_id:", e);
    }

    const resolveLineId = (linhaStr) => {
      if (!linhaStr) return 0;
      const s = String(linhaStr).trim();
      const found = oclpLines.find((l) => String(l.Code) === s || String(l.Name) === s);
      return found ? Number(found.id) : 0;
    };

    // Data e hora do cabeçalho (momento do salvamento)
    const now = new Date();
    const dataCabecalho = now.toISOString().split('T')[0]; // YYYY-MM-DD para DATE
    const horaCabecalho = now.toTimeString().split(' ')[0]; // HH:MM:SS para TIME

    // Data do dia (pode vir do parâmetro ou usar a atual)
    const dataDia = dataParam || dataCabecalho;

    // Calcular totais de reprocesso (uma vez para todos os itens)
    const reprocessoTotalCortado = reprocessos && reprocessos.length > 0 
      ? reprocessos.filter(r => r.tipo === "Cortado").reduce((sum, r) => sum + (parseFloat(r.quantidade) || 0), 0) 
      : 0;
    const reprocessoTotalUsado = reprocessos && reprocessos.length > 0 
      ? reprocessos.filter(r => r.tipo === "Usado").reduce((sum, r) => sum + (parseFloat(r.quantidade) || 0), 0) 
      : 0;

    // Função para montar o payload de um item (comum para update e insert)
    const buildOcpdPayload = (item, index) => {
      let horaFinalPrevisao = null;
      if (item.horaFinal && item.horaFinal !== "---" && item.horaFinal.trim() !== "") {
        try {
          const timeParts = item.horaFinal.split(':');
          if (timeParts.length >= 2) {
            const hours = parseInt(timeParts[0]) || 0;
            const minutes = parseInt(timeParts[1]) || 0;
            const seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;
            const finalDate = new Date();
            finalDate.setHours(hours, minutes, seconds, 0);
            if (finalDate.getTime() < new Date().getTime()) {
              finalDate.setDate(finalDate.getDate() + 1);
            }
            horaFinalPrevisao = finalDate.toISOString();
          }
        } catch (e) {
          console.warn("Erro ao parsear hora final:", e);
        }
      }
      const lineId = resolveLineId(item.linha);
      const isFirstItem = index === 0;
      return {
        line_id: lineId,
        hora_cabecalho: horaCabecalho,
        data_cabecalho: dataCabecalho,
        data_dia: item.dataDia || dataDia,
        op: item.op || "",
        codigo_item: item.codigoItem || "",
        descricao_item: item.descricaoItem || "",
        linha: item.linha || "",
        qtd_planejada: parseFloat(item.quantidadePlanejada) || 0,
        qtd_realizada: parseFloat(item.quantidadeRealizada) || 0,
        diferenca: parseFloat(item.diferenca) || 0,
        calculo_1_horas: item.horasTrabalhadas ? parseFloat(String(item.horasTrabalhadas).replace(",", ".")) : null,
        restante_horas: item.restanteHoras || "",
        hora_atual: new Date().toISOString(),
        hora_final: horaFinalPrevisao,
        observacao: item.observacao || "",
        total_qtd_planejada: 0,
        total_qtd_realizada: 0,
        total_diferenca: 0,
        total_reprocesso_usado: parseFloat(totalReprocesso) || 0,
        estim_latas_previstas: parseFloat(latasPrevista) || 0,
        estim_latas_realizadas: parseFloat(latasRealizadas) || 0,
        latas_ja_batidas: parseFloat(latasBatidas) || 0,
        total_ja_cortado: parseFloat(totalCortado) || 0,
        percentual_meta: parseFloat(percentualMeta) || 0,
        filial_nome: filialNome || null,
        reprocesso_numero: isFirstItem && reprocessos && reprocessos.length > 0 ? reprocessos[0].numero : null,
        reprocesso_tipo: isFirstItem && reprocessos && reprocessos.length > 0 ? reprocessos[0].tipo : null,
        reprocesso_codigo: isFirstItem && reprocessos && reprocessos.length > 0 ? reprocessos[0].codigo : null,
        reprocesso_descricao: isFirstItem && reprocessos && reprocessos.length > 0 ? reprocessos[0].descricao : null,
        reprocesso_quantidade: isFirstItem && reprocessos && reprocessos.length > 0 ? parseFloat(reprocessos[0].quantidade) || 0 : 0,
        reprocesso_total_cortado: isFirstItem ? reprocessoTotalCortado : 0,
        reprocesso_total_usado: isFirstItem ? reprocessoTotalUsado : 0,
      };
    };

    let updated = 0;
    let inserted = 0;
    let firstOcpdId = null; // usado para vincular OCPR

    // 1) Atualizar linhas que já existem (existingOcpdIds[i] válido)
    for (let i = 0; i < items.length; i++) {
      const ocpdId = existingIds[i] != null && Number.isInteger(Number(existingIds[i])) ? Number(existingIds[i]) : null;
      if (ocpdId) {
        const payload = buildOcpdPayload(items[i], i);
        const { error: updateError } = await supabase
          .from("OCPD")
          .update(payload)
          .eq("id", ocpdId);
        if (updateError) throw updateError;
        updated++;
        if (firstOcpdId == null) firstOcpdId = ocpdId;
      }
    }

    // 2) Inserir linhas novas (sem existingOcpdIds)
    const toInsert = items
      .map((item, index) => ({ item, index }))
      .filter(({ index: origIndex }) => !(existingIds[origIndex] != null && Number.isInteger(Number(existingIds[origIndex]))));
    const ocpdItemsNew = toInsert.map(({ item, index }) => buildOcpdPayload(item, index));

    let insertedData = null;
    if (ocpdItemsNew.length > 0) {
      const { data: insertData, error: insertError } = await supabase
        .from("OCPD")
        .insert(ocpdItemsNew)
        .select();
      if (insertError) throw insertError;
      insertedData = insertData;
      inserted = insertData?.length || 0;
      if (firstOcpdId == null && insertData && insertData.length > 0) firstOcpdId = insertData[0].id;
    }

    // 3) Remover do banco linhas que existiam mas foram removidas na tela (menos itens que existingOcpdIds)
    const idsToDelete = existingIds.slice(items.length).filter(id => id != null && Number.isInteger(Number(id)));
    for (const id of idsToDelete) {
      const { error: delError } = await supabase.from("OCPD").delete().eq("id", id);
      if (delError) console.warn("Erro ao deletar OCPD id", id, delError.message);
    }

    // 4) Reprocessos: remover antigos vinculados a este documento e inserir os atuais
    const allOcpdIdsForDoc = [...existingIds.slice(0, items.length).filter(id => id != null && Number.isInteger(Number(id))), ...(insertedData || []).map(r => r.id)];
    const anchorOcpdId = firstOcpdId || (allOcpdIdsForDoc.length > 0 ? allOcpdIdsForDoc[0] : null);
    if (anchorOcpdId && allOcpdIdsForDoc.length > 0) {
      try {
        await supabase.from("OCPR").delete().in("ocpd_id", allOcpdIdsForDoc);
      } catch (e) {
        console.warn("Erro ao deletar OCPR antigos:", e.message);
      }
    }
    if (reprocessos && Array.isArray(reprocessos) && reprocessos.length > 0 && anchorOcpdId) {
      const ocprRows = reprocessos.map((r) => ({
        ocpd_id: anchorOcpdId,
        data_dia: dataDia,
        filial_nome: filialNome || null,
        numero: r.numero ?? 1,
        tipo: r.tipo || "Cortado",
        codigo: r.codigo || null,
        descricao: r.descricao || null,
        quantidade: parseFloat(r.quantidade) || 0,
      }));
      try {
        await supabase.from("OCPR").insert(ocprRows);
      } catch (ocprErr) {
        console.warn("OCPR (reprocessos) não inserido – tabela pode não existir:", ocprErr.message);
      }
    }

    res.json({
      success: true,
      inserted,
      updated,
      total: items.length,
      data: insertedData || [],
    });
  } catch (error) {
    console.error("Erro ao salvar produção:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao salvar dados de produção",
    });
  }
});

/**
 * Rota para buscar dados de produção
 * GET /api/supabase/producao/load?data=YYYY-MM-DD
 * 
 * OBS: Agora busca da tabela OCPD (modelo SAP-like) em vez da tabela "producao"
 */
router.get("/producao/load", async (req, res) => {
  try {
    const { data, filialNome } = req.query;
    const supabase = getSupabaseClient();

    let query = supabase
      .from("OCPD")
      .select("*")
      .order("id", { ascending: true });

    // Se especificou data, filtrar por data_dia
    if (data) {
      query = query.eq("data_dia", data);
    } else {
      // Senão, buscar apenas do dia atual
      const today = new Date().toISOString().split('T')[0];
      query = query.eq("data_dia", today);
    }

    // Filtrar por filial se especificado
    if (filialNome) {
      query = query.eq("filial_nome", filialNome);
    }

    const { data: producaoData, error } = await query;

    if (error) {
      throw error;
    }

    // Buscar reprocessos da tabela OCPR (múltiplos por data_dia)
    let reprocessosLoad = [];
    try {
      let oprQuery = supabase
        .from("OCPR")
        .select("numero, tipo, codigo, descricao, quantidade")
        .eq("data_dia", data || new Date().toISOString().split("T")[0])
        .order("numero", { ascending: true });
      if (filialNome) oprQuery = oprQuery.eq("filial_nome", filialNome);
      const { data: oprData } = await oprQuery;
      reprocessosLoad = oprData || [];
    } catch (e) {
      console.warn("Erro ao carregar OCPR (reprocessos):", e.message);
    }

    res.json({
      success: true,
      data: producaoData || [],
      count: producaoData?.length || 0,
      reprocessos: reprocessosLoad,
    });
  } catch (error) {
    console.error("Erro ao carregar produção:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao carregar dados de produção",
    });
  }
});

/**
 * Rota para buscar histórico de produção
 * GET /api/supabase/producao/history?limit=50
 */
/**
 * Rota para buscar histórico de produção
 * GET /api/supabase/producao/history?limit=50
 * 
 * OBS: Agora busca na tabela OCPD (modelo SAP-like) em vez da tabela "producao"
 */
router.get("/producao/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const dataFilter = req.query.data; // YYYY-MM-DD - filtra por data_dia (data única, legado)
    const dataInicio = req.query.dataInicio; // YYYY-MM-DD - início do intervalo
    const dataFim = req.query.dataFim; // YYYY-MM-DD - fim do intervalo
    const linha = req.query.linha; // Filtro por linha (código ou nome da linha)
    const filialCodigo = req.query.filialCodigo;
    const filialNome = req.query.filialNome;
    const supabase = getSupabaseClient();

    let query = supabase
      .from("OCPD")
      .select("*")
      .order("data_dia", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    // Intervalo de datas (prioridade sobre data única)
    if (dataInicio && dataFim) {
      query = query.gte("data_dia", dataInicio).lte("data_dia", dataFim);
    } else if (dataInicio) {
      query = query.gte("data_dia", dataInicio);
    } else if (dataFim) {
      query = query.lte("data_dia", dataFim);
    } else if (dataFilter) {
      query = query.eq("data_dia", dataFilter);
    }

    // Filtro por linha (código ou nome da linha)
    if (linha && String(linha).trim() !== "") {
      query = query.eq("linha", String(linha).trim());
    }

    if (filialNome) {
      query = query.eq("filial_nome", filialNome);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao carregar histórico de produção",
    });
  }
});

/**
 * Rota para buscar todas as filiais (OCTF)
 * GET /api/supabase/filiais
 */
router.get("/filiais", async (req, res) => {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("OCTF")
      .select('id, line_id, "Code", "Name", "Address"')
      .order("Code");

    if (error) {
      throw error;
    }

    const adapted = (data || []).map((filial) => ({
      id: filial.id,
      line_id: filial.line_id,
      codigo: filial.Code,
      nome: filial.Name,
      endereco: filial.Address || "",
    }));

    res.json({
      success: true,
      data: adapted,
      count: adapted.length,
    });
  } catch (error) {
    console.error("Erro ao buscar filiais:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar filiais do banco",
    });
  }
});

/**
 * Rota para buscar uma filial específica por código (OCTF)
 * GET /api/supabase/filiais/by-code/:code
 */
router.get("/filiais/by-code/:code", async (req, res) => {
  try {
    const rawCode = (req.params.code || "").toString().trim();
    if (!rawCode) {
      return res.status(400).json({
        success: false,
        error: "Código da filial é obrigatório",
      });
    }

    const supabase = getSupabaseClient();

    // Tentar buscar pelo código exato e pela versão sem zeros à esquerda
    const normalized = rawCode.replace(/^0+/, "") || rawCode;
    const codesToSearch = Array.from(new Set([rawCode, normalized]));

    const { data, error } = await supabase
      .from("OCTF")
      .select('id, line_id, "Code", "Name", "Address"')
      .in("Code", codesToSearch)
      .order("Code")
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.json({
        success: true,
        data: null,
      });
    }

    const filial = data[0];
    const adapted = {
      id: filial.id,
      line_id: filial.line_id,
      codigo: filial.Code,
      nome: filial.Name,
      endereco: filial.Address || "",
    };

    res.json({
      success: true,
      data: adapted,
    });
  } catch (error) {
    console.error("Erro ao buscar filial por código:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar filial por código",
    });
  }
});

/**
 * Rota para inserir uma nova filial (OCTF)
 * POST /api/supabase/filiais
 * Body: { codigo, nome, endereco }
 */
router.post("/filiais", async (req, res) => {
  try {
    const { codigo, nome, endereco } = req.body;

    if (!codigo || !nome) {
      return res.status(400).json({
        success: false,
        error: "Código e nome da filial são obrigatórios",
      });
    }

    const supabase = getSupabaseClient();

    // Adaptar para estrutura da tabela OCTF
    const octfItem = {
      Code: codigo.toString().trim(),
      Name: nome.toString().trim(),
      Address: endereco ? endereco.toString().trim() : null,
    };

    // Inserir filial no banco (tabela OCTF)
    const { data, error } = await supabase
      .from("OCTF")
      .insert(octfItem)
      .select();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      inserted: data?.length || 0,
      data: data,
    });
  } catch (error) {
    console.error("Erro ao inserir filial:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao inserir filial no banco",
    });
  }
});

/**
 * Rota para atualizar uma filial existente (OCTF)
 * PUT /api/supabase/filiais/:id
 * Body: { codigo?, nome?, endereco? }
 */
router.put("/filiais/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nome, endereco } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "ID da filial é obrigatório",
      });
    }

    const supabase = getSupabaseClient();

    // Preparar objeto de atualização
    const updateData = {};
    if (codigo !== undefined) updateData.Code = codigo.toString().trim();
    if (nome !== undefined) updateData.Name = nome.toString().trim();
    if (endereco !== undefined) updateData.Address = endereco ? endereco.toString().trim() : null;
    updateData.updated_at = new Date().toISOString();

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Nenhum campo para atualizar",
      });
    }

    // Atualizar filial no banco (tabela OCTF)
    const { data, error } = await supabase
      .from("OCTF")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Filial não encontrada",
      });
    }

    res.json({
      success: true,
      data: data[0],
    });
  } catch (error) {
    console.error("Erro ao atualizar filial:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao atualizar filial no banco",
    });
  }
});

/**
 * Rota para deletar uma filial (OCTF)
 * DELETE /api/supabase/filiais/:id
 */
router.delete("/filiais/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "ID da filial é obrigatório",
      });
    }

    const supabase = getSupabaseClient();

    // Deletar filial do banco (tabela OCTF)
    const { error } = await supabase
      .from("OCTF")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: "Filial deletada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao deletar filial:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao deletar filial do banco",
    });
  }
});

/**
 * Rota para buscar estatísticas do dashboard
 * GET /api/supabase/dashboard/stats?filialNome=XXX&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
 * 
 * Retorna: total planejado, total realizado, diferença, percentual meta
 */
router.get("/dashboard/stats", async (req, res) => {
  try {
    const { filialNome, dataInicio, dataFim } = req.query;
    const supabase = getSupabaseClient();

    // Data padrão: hoje se não especificado
    const hoje = new Date().toISOString().split('T')[0];
    const dataInicioFiltro = dataInicio || hoje;
    const dataFimFiltro = dataFim || hoje;

    let query = supabase
      .from("OCPD")
      .select("qtd_planejada, qtd_realizada, diferenca, percentual_meta, data_dia")
      .gte("data_dia", dataInicioFiltro)
      .lte("data_dia", dataFimFiltro);

    // Filtrar por filial se especificado
    if (filialNome) {
      query = query.eq("filial_nome", filialNome);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Calcular totais agregados
    const totalPlanejado = (data || []).reduce((sum, item) => sum + parseFloat(item.qtd_planejada || 0), 0);
    const totalRealizado = (data || []).reduce((sum, item) => sum + parseFloat(item.qtd_realizada || 0), 0);
    const diferenca = totalPlanejado - totalRealizado;
    
    // Calcular percentual meta médio (ou usar o último valor se disponível)
    const percentuaisMeta = (data || []).map(item => parseFloat(item.percentual_meta || 0)).filter(p => p > 0);
    const percentualMeta = percentuaisMeta.length > 0 
      ? (percentuaisMeta.reduce((sum, p) => sum + p, 0) / percentuaisMeta.length).toFixed(2)
      : "0.00";

    // Calcular variação percentual (comparar realizado vs planejado)
    const variacaoPercentual = totalPlanejado > 0 
      ? (((totalRealizado - totalPlanejado) / totalPlanejado) * 100).toFixed(2)
      : "0.00";

    res.json({
      success: true,
      data: {
        totalPlanejado: totalPlanejado.toFixed(2),
        totalRealizado: totalRealizado.toFixed(2),
        diferenca: diferenca.toFixed(2),
        percentualMeta: parseFloat(percentualMeta).toFixed(2),
        variacaoPercentual: parseFloat(variacaoPercentual),
        registros: data?.length || 0,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas do dashboard:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar estatísticas do dashboard",
    });
  }
});

/**
 * Rota para buscar dados de produção por data para gráficos
 * GET /api/supabase/dashboard/production-chart?filialNome=XXX&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
 * 
 * Retorna: dados agrupados por data para o gráfico de produção
 */
router.get("/dashboard/production-chart", async (req, res) => {
  try {
    const { filialNome, dataInicio, dataFim } = req.query;
    const supabase = getSupabaseClient();

    // Data padrão: últimos 7 dias se não especificado
    const hoje = new Date();
    const dataFimFiltro = dataFim || hoje.toISOString().split('T')[0];
    const dataInicioFiltro = dataInicio || (() => {
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      return seteDiasAtras.toISOString().split('T')[0];
    })();

    let query = supabase
      .from("OCPD")
      .select("qtd_planejada, qtd_realizada, data_dia")
      .gte("data_dia", dataInicioFiltro)
      .lte("data_dia", dataFimFiltro)
      .order("data_dia", { ascending: true });

    // Filtrar por filial se especificado
    if (filialNome) {
      query = query.eq("filial_nome", filialNome);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Agrupar por data
    const dadosAgrupados = (data || []).reduce((acc, item) => {
      const dataStr = item.data_dia;
      if (!acc[dataStr]) {
        acc[dataStr] = { data: dataStr, planejado: 0, realizado: 0 };
      }
      acc[dataStr].planejado += parseFloat(item.qtd_planejada || 0);
      acc[dataStr].realizado += parseFloat(item.qtd_realizada || 0);
      return acc;
    }, {});

    // Converter para array e formatar datas
    const chartData = Object.values(dadosAgrupados).map((item) => {
      const [y, m, d] = item.data.split('-').map(Number);
      const dataObj = new Date(y, m - 1, d);
      const mesAbrev = dataObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const dia = dataObj.getDate();
      return {
        month: `${dia} ${mesAbrev}`,
        receita: parseFloat(item.planejado.toFixed(2)),
        despesas: parseFloat(item.realizado.toFixed(2)),
      };
    });

    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do gráfico de produção:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar dados do gráfico",
    });
  }
});

/**
 * Rota para buscar dados de produção por linha para gráfico de barras
 * GET /api/supabase/dashboard/production-lines?filialNome=XXX&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
 * 
 * Retorna: dados agrupados por linha de produção
 */
router.get("/dashboard/production-lines", async (req, res) => {
  try {
    const { filialNome, dataInicio, dataFim } = req.query;
    const supabase = getSupabaseClient();

    // Data padrão: hoje se não especificado
    const hoje = new Date().toISOString().split('T')[0];
    const dataInicioFiltro = dataInicio || hoje;
    const dataFimFiltro = dataFim || hoje;

    let query = supabase
      .from("OCPD")
      .select("qtd_planejada, qtd_realizada, linha")
      .gte("data_dia", dataInicioFiltro)
      .lte("data_dia", dataFimFiltro);

    // Filtrar por filial se especificado
    if (filialNome) {
      query = query.eq("filial_nome", filialNome);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Buscar nomes das linhas (OCLP) para exibir nome em vez do código no gráfico
    let linhasMap = {};
    try {
      const { data: oclpData } = await supabase.from("OCLP").select('id, "Code", "Name"');
      if (oclpData && oclpData.length) {
        oclpData.forEach((l) => {
          if (l.Code != null) linhasMap[String(l.Code).trim()] = l.Name || l.Code;
          if (l.Name != null) linhasMap[String(l.Name).trim()] = l.Name;
        });
      }
    } catch (e) {
      console.warn("Erro ao carregar OCLP para nomes das linhas:", e);
    }

    // Agrupar por linha (usar nome da OCLP quando existir)
    const dadosAgrupados = (data || []).reduce((acc, item) => {
      const linha = item.linha != null ? String(item.linha).trim() : "";
      const key = linha || "Sem linha";
      if (!acc[key]) {
        const displayName = linha ? (linhasMap[linha] || linha) : "Sem linha";
        acc[key] = { name: displayName, valor: 0, meta: 0 };
      }
      acc[key].valor += parseFloat(item.qtd_realizada || 0);
      acc[key].meta += parseFloat(item.qtd_planejada || 0);
      return acc;
    }, {});

    // Converter para array
    const chartData = Object.values(dadosAgrupados).map((item) => ({
      name: item.name,
      valor: parseFloat(item.valor.toFixed(2)),
      meta: parseFloat(item.meta.toFixed(2)),
    }));

    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    console.error("Erro ao buscar dados de linhas de produção:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar dados de linhas",
    });
  }
});

/**
 * Rota para buscar estatísticas do dashboard
 * GET /api/supabase/dashboard/stats?filialNome=XXX&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
 * 
 * Retorna: total planejado, total realizado, diferença, percentual meta
 */
router.get("/dashboard/stats", async (req, res) => {
  try {
    const { filialNome, dataInicio, dataFim } = req.query;
    const supabase = getSupabaseClient();

    // Data padrão: hoje se não especificado
    const hoje = new Date().toISOString().split('T')[0];
    const dataInicioFiltro = dataInicio || hoje;
    const dataFimFiltro = dataFim || hoje;

    let query = supabase
      .from("OCPD")
      .select("qtd_planejada, qtd_realizada, diferenca, percentual_meta, data_dia")
      .gte("data_dia", dataInicioFiltro)
      .lte("data_dia", dataFimFiltro);

    // Filtrar por filial se especificado
    if (filialNome) {
      query = query.eq("filial_nome", filialNome);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Calcular totais agregados
    const totalPlanejado = (data || []).reduce((sum, item) => sum + parseFloat(item.qtd_planejada || 0), 0);
    const totalRealizado = (data || []).reduce((sum, item) => sum + parseFloat(item.qtd_realizada || 0), 0);
    const diferenca = totalPlanejado - totalRealizado;
    
    // Calcular percentual meta médio (ou usar o último valor se disponível)
    const percentuaisMeta = (data || []).map(item => parseFloat(item.percentual_meta || 0)).filter(p => p > 0);
    const percentualMeta = percentuaisMeta.length > 0 
      ? (percentuaisMeta.reduce((sum, p) => sum + p, 0) / percentuaisMeta.length).toFixed(2)
      : "0.00";

    // Calcular variação percentual (comparar realizado vs planejado)
    const variacaoPercentual = totalPlanejado > 0 
      ? (((totalRealizado - totalPlanejado) / totalPlanejado) * 100).toFixed(2)
      : "0.00";

    res.json({
      success: true,
      data: {
        totalPlanejado: totalPlanejado.toFixed(2),
        totalRealizado: totalRealizado.toFixed(2),
        diferenca: diferenca.toFixed(2),
        percentualMeta: parseFloat(percentualMeta).toFixed(2),
        variacaoPercentual: parseFloat(variacaoPercentual),
        registros: data?.length || 0,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas do dashboard:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar estatísticas do dashboard",
    });
  }
});

/**
 * Rota para buscar dados de produção por data para gráficos
 * GET /api/supabase/dashboard/production-chart?filialNome=XXX&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
 * 
 * Retorna: dados agrupados por data para o gráfico de produção
 */
router.get("/dashboard/production-chart", async (req, res) => {
  try {
    const { filialNome, dataInicio, dataFim } = req.query;
    const supabase = getSupabaseClient();

    // Data padrão: últimos 7 dias se não especificado
    const hoje = new Date();
    const dataFimFiltro = dataFim || hoje.toISOString().split('T')[0];
    const dataInicioFiltro = dataInicio || (() => {
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      return seteDiasAtras.toISOString().split('T')[0];
    })();

    let query = supabase
      .from("OCPD")
      .select("qtd_planejada, qtd_realizada, data_dia")
      .gte("data_dia", dataInicioFiltro)
      .lte("data_dia", dataFimFiltro)
      .order("data_dia", { ascending: true });

    // Filtrar por filial se especificado
    if (filialNome) {
      query = query.eq("filial_nome", filialNome);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Agrupar por data
    const dadosAgrupados = (data || []).reduce((acc, item) => {
      const dataStr = item.data_dia;
      if (!acc[dataStr]) {
        acc[dataStr] = { data: dataStr, planejado: 0, realizado: 0 };
      }
      acc[dataStr].planejado += parseFloat(item.qtd_planejada || 0);
      acc[dataStr].realizado += parseFloat(item.qtd_realizada || 0);
      return acc;
    }, {});

    // Converter para array e formatar datas
    const chartData = Object.values(dadosAgrupados).map((item) => {
      const [y, m, d] = item.data.split('-').map(Number);
      const dataObj = new Date(y, m - 1, d);
      const mesAbrev = dataObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const dia = dataObj.getDate();
      return {
        month: `${dia} ${mesAbrev}`,
        receita: parseFloat(item.planejado.toFixed(2)),
        despesas: parseFloat(item.realizado.toFixed(2)),
      };
    });

    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do gráfico de produção:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao buscar dados do gráfico",
    });
  }
});

export default router;
