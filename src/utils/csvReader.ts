/**
 * Utilitário para ler e parsear arquivos CSV
 */

export interface CSVRow {
  [key: string]: string;
}

/** Remove BOM UTF-8 e espaços nas extremidades (cabeçalhos vindo do Excel costumam ter \\uFEFF). */
function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "").trim();
}

/**
 * Lê uma célula tentando vários nomes de coluna e tolerando BOM / diferença de maiúsculas no header.
 */
export function getCsvCell(row: CSVRow, ...candidates: string[]): string {
  for (const key of candidates) {
    const v = row[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
    const bomKey = "\uFEFF" + key;
    const vBom = row[bomKey];
    if (vBom != null && String(vBom).trim() !== "") return String(vBom).trim();
  }
  const rowKeys = Object.keys(row);
  for (const rowKey of rowKeys) {
    const nk = stripBom(rowKey);
    for (const c of candidates) {
      const cc = stripBom(c);
      if (nk === cc || nk.toLowerCase() === cc.toLowerCase()) {
        const v = row[rowKey];
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
    }
  }
  return "";
}

/**
 * Parseia uma string CSV com delimitador ponto e vírgula
 */
export function parseCSV(csvContent: string): CSVRow[] {
  const content = stripBom(csvContent);
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  
  if (lines.length === 0) {
    return [];
  }

  // Primeira linha são os headers
  const headers = lines[0]
    .split(';')
    .map(header => stripBom(header))
    .filter(header => header !== '');

  // Parsear as linhas de dados
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    const row: CSVRow = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    
    // Só adiciona a linha se tiver pelo menos um valor não vazio
    if (Object.values(row).some(val => val !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Carrega um arquivo CSV do diretório público
 */
export async function loadCSVFile(filePath: string): Promise<CSVRow[]> {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Erro ao carregar arquivo: ${response.statusText}`);
    }
    
    const csvContent = await response.text();
    return parseCSV(csvContent);
  } catch (error) {
    console.error('Erro ao carregar CSV:', error);
    throw error;
  }
}
