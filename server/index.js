import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import excelRoutes from "./routes/excelRoutes.js";
import supabaseRoutes from "./routes/supabaseRoutes.js";
import { requireAuth } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Carregar .env pelo caminho absoluto (não depende do cwd)
dotenv.config({ path: path.resolve(__dirname, "../src/Data/.env") });

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
// Aumentar limite do body para permitir upload de arquivos/JSON maiores (50mb para grandes volumes)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Configurar timeout maior para requisições (5 minutos)
app.use((req, res, next) => {
  req.setTimeout(5 * 60 * 1000); // 5 minutos
  res.setTimeout(5 * 60 * 1000); // 5 minutos
  next();
});

// Logging de requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check simples (não depende mais do SAP)
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API rodando",
    timestamp: new Date().toISOString(),
  });
});

// Health check do Supabase
app.get("/api/health/supabase", async (req, res) => {
  try {
    const { getSupabaseClient } = await import("./routes/supabaseRoutes.js");
    const supabase = getSupabaseClient();
    
    // Testa a conexão com uma query simples
    const { error } = await supabase
      .from("OCLP")
      .select("id")
      .limit(1);
    
    if (error) {
      return res.status(503).json({
        success: false,
        message: "Supabase desconectado",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
    
    res.json({
      success: true,
      message: "Supabase conectado",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Erro ao verificar conexão Supabase",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Rotas
// Rotas de consulta SAP desativadas: agora usamos apenas Supabase
// app.use("/api", queryRoutes);
// API exige login (JWT) — só usuários cadastrados acessam dados
app.use("/api/excel", requireAuth, excelRoutes);
app.use("/api/supabase", requireAuth, supabaseRoutes);

// Rota raiz
app.get("/", (req, res) => {
  res.json({
    message: "ERP Controller Petruz - API Server",
    version: "1.0.0",
    endpoints: {
      health: "GET /api/health",
      query: "POST /api/query",
      testConnection: "GET /api/test-connection",
      excelUpload: "POST /api/excel/upload",
      excelSheets: "POST /api/excel/sheets",
      supabaseItems: "GET /api/supabase/items",
      supabaseCompare: "POST /api/supabase/compare",
      supabaseInsert: "POST /api/supabase/insert",
      producaoSave: "POST /api/supabase/producao/save",
      producaoLoad: "GET /api/supabase/producao/load",
      producaoHistory: "GET /api/supabase/producao/history",
    },
  });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error("Erro não tratado:", err);
  res.status(500).json({
    success: false,
    error: "Erro interno do servidor",
    message: err.message,
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 API disponível em http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});
