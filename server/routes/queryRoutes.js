import express from "express";
import odbc from "odbc";
import { getConnectionString, dbConfig } from "../config/database.js";

const router = express.Router();

// Pool de conexão
let connectionPool = null;

/**
 * Obtém ou cria uma conexão com o banco de dados
 */
async function getConnection() {
  try {
    if (!connectionPool) {
      const connectionString = getConnectionString();
      console.log("🔄 Tentando conectar ao banco de dados...");
      console.log("📋 String de conexão (sem senha):", connectionString.replace(/PWD=[^;]+/, "PWD=***"));

      connectionPool = await odbc.pool(connectionString);
      console.log("✅ Conexão com o banco de dados estabelecida");
    }
    return connectionPool;
  } catch (error) {
    console.error("❌ Erro ao conectar com o banco de dados:", error);

    let errorMessage = "Falha na conexão com o banco de dados";

    if (error.message.includes("driver") || error.message.includes("Driver")) {
      errorMessage = "Driver ODBC 'B1CRHPROXY' não encontrado. Verifique se o driver SAP Business One está instalado.";
    } else if (error.message.includes("server") || error.message.includes("Server")) {
      errorMessage = "Não foi possível conectar ao servidor SAP Business One. Verifique se o servidor está acessível em 'petruzh:30015'.";
    } else if (error.message.includes("login") || error.message.includes("authentication")) {
      errorMessage = "Erro de autenticação. Verifique as credenciais (usuário e senha) em server/config/database.js";
    } else if (error.message.includes("database") || error.message.includes("Database")) {
      errorMessage = "Banco de dados 'SBO_PETRUZ_BR_TST' não encontrado ou inacessível.";
    } else {
      errorMessage = `Falha na conexão: ${error.message}`;
    }

    throw new Error(errorMessage);
  }
}

/**
 * Executa uma consulta SELECT no banco de dados
 * @param {string} query - Query SQL (apenas SELECT permitido)
 * @returns {Promise<Array>} - Resultado da consulta
 */
async function executeQuery(query) {
  // Validação de segurança: apenas SELECT permitido
  const trimmedQuery = query.trim().toUpperCase();
  if (!trimmedQuery.startsWith("SELECT")) {
    throw new Error("Apenas consultas SELECT são permitidas");
  }

  // Validação adicional: bloqueia comandos perigosos
  const dangerousKeywords = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "CREATE",
    "ALTER",
    "TRUNCATE",
    "EXEC",
    "EXECUTE",
  ];

  for (const keyword of dangerousKeywords) {
    if (trimmedQuery.includes(keyword)) {
      throw new Error(`Operação não permitida: ${keyword}`);
    }
  }

  try {
    const pool = await getConnection();
    const result = await pool.query(query);
    return result;
  } catch (error) {
    console.error("❌ Erro ao executar consulta:", error);

    // Se o erro for de conexão, resetar o pool para tentar reconectar na próxima vez
    if (error.message.includes("conexão") || error.message.includes("connection")) {
      connectionPool = null;
    }

    throw new Error(`Erro na consulta: ${error.message}`);
  }
}

/**
 * Rota para executar consultas SQL (apenas SELECT)
 * POST /api/query
 * Body: { query: "SELECT * FROM TABLE" }
 */
router.post("/query", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        success: false,
        error: "Query SQL é obrigatória",
      });
    }

    const result = await executeQuery(query);

    res.json({
      success: true,
      data: result,
      count: Array.isArray(result) ? result.length : 0,
    });
  } catch (error) {
    console.error("Erro na rota /api/query:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao executar consulta",
    });
  }
});

/**
 * Rota de teste de conexão
 * GET /api/health
 */
router.get("/health", async (req, res) => {
  try {
    // Tenta executar uma consulta simples
    const result = await executeQuery("SELECT 1 AS test");
    res.json({
      success: true,
      message: "Conexão com o banco de dados está funcionando",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Erro na conexão com o banco",
    });
  }
});

/**
 * Rota para testar diferentes configurações de conexão
 * GET /api/test-connection
 */
router.get("/test-connection", async (req, res) => {
  try {
    const testConfigs = [
      // Configuração original
      {
        name: "Configuração original",
        connectionString: `${dbConfig.connectionString};UID=${dbConfig.user};PWD=${dbConfig.password}`
      },
      // Sem especificar o banco (conecta ao servidor primeiro)
      {
        name: "Sem especificar banco",
        connectionString: `DRIVER={B1CRHPROXY};SERVERNODE=petruzh:30015;UID=${dbConfig.user};PWD=${dbConfig.password}`
      },
      // Tentando com diferentes formatos do nome do banco
      {
        name: "Banco em minúsculas",
        connectionString: `DRIVER={B1CRHPROXY};SERVERNODE=petruzh:30015;DATABASE=sbo_petruz_br_tst;UID=${dbConfig.user};PWD=${dbConfig.password}`
      },
      {
        name: "Banco sem underscore",
        connectionString: `DRIVER={B1CRHPROXY};SERVERNODE=petruzh:30015;DATABASE=SBOPETRUZBRTST;UID=${dbConfig.user};PWD=${dbConfig.password}`
      }
    ];

    const results = [];

    for (const config of testConfigs) {
      try {
        console.log(`🔄 Testando: ${config.name}`);
        const pool = await odbc.pool(config.connectionString);
        await pool.query("SELECT 1 AS test");
        await pool.close();
        results.push({
          name: config.name,
          success: true,
          message: "Conexão bem-sucedida"
        });
        console.log(`✅ ${config.name}: Sucesso`);
      } catch (error) {
        results.push({
          name: config.name,
          success: false,
          message: error.message
        });
        console.log(`❌ ${config.name}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      results: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao testar conexões",
    });
  }
});

export default router;
