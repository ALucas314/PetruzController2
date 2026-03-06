/**
 * Utilitário para ler e parsear arquivos CSV
 */

export interface CSVRow {
  [key: string]: string;
}

/**
 * Parseia uma string CSV com delimitador ponto e vírgula
 */
export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return [];
  }

  // Primeira linha são os headers
  const headers = lines[0]
    .split(';')
    .map(header => header.trim())
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
