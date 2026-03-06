import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configuração do multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use .xlsx, .xls ou .csv"));
    }
  },
});

/**
 * Rota para fazer upload e ler arquivo Excel
 * POST /api/excel/upload
 * FormData: { file: File, sheetName?: string }
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Nenhum arquivo foi enviado",
      });
    }

    const { sheetName } = req.body;
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    // Ler o arquivo Excel
    const workbook = xlsx.read(fileBuffer, { type: "buffer" });

    // Listar todas as abas disponíveis
    const sheetNames = workbook.SheetNames;

    // Se não especificou a aba, usar a primeira
    const targetSheetName = sheetName || sheetNames[0];

    // Verificar se a aba existe
    if (!sheetNames.includes(targetSheetName)) {
      return res.status(400).json({
        success: false,
        error: `Aba '${targetSheetName}' não encontrada. Abas disponíveis: ${sheetNames.join(", ")}`,
        availableSheets: sheetNames,
      });
    }

    // Converter a aba para JSON
    const worksheet = workbook.Sheets[targetSheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, {
      raw: false, // Converter valores para string
      defval: "", // Valor padrão para células vazias
    });

    res.json({
      success: true,
      fileName: fileName,
      sheetName: targetSheetName,
      availableSheets: sheetNames,
      data: data,
      count: data.length,
      headers: data.length > 0 ? Object.keys(data[0]) : [],
    });
  } catch (error) {
    console.error("Erro ao processar arquivo Excel:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao processar arquivo Excel",
    });
  }
});

/**
 * Rota para listar abas de um arquivo Excel
 * POST /api/excel/sheets
 * FormData: { file: File }
 */
router.post("/sheets", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Nenhum arquivo foi enviado",
      });
    }

    const fileBuffer = req.file.buffer;
    const workbook = xlsx.read(fileBuffer, { type: "buffer" });

    res.json({
      success: true,
      fileName: req.file.originalname,
      sheets: workbook.SheetNames.map((name, index) => ({
        name: name,
        index: index,
      })),
    });
  } catch (error) {
    console.error("Erro ao ler abas do Excel:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Erro ao ler arquivo Excel",
    });
  }
});

export default router;
