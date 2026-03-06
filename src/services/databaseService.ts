import { post, get, ApiResponse } from "./api/client";
import { apiConfig } from "./api/config";

/**
 * Service layer para consultas ao banco de dados SAP Business One
 * Apenas operações de leitura (SELECT) são permitidas
 */

export interface QueryResult<T = any> {
  success: boolean;
  data: T[];
  count: number;
  error?: string;
}

/**
 * Executa uma consulta SQL no banco de dados
 * @param query - Query SQL (apenas SELECT permitido)
 * @returns Resultado da consulta
 */
export async function executeQuery<T = any>(
  query: string
): Promise<QueryResult<T>> {
  try {
    const response = await post<T[]>(apiConfig.endpoints.query, { query });

    if (!response.success) {
      return {
        success: false,
        data: [],
        count: 0,
        error: response.error || "Erro ao executar consulta",
      };
    }

    return {
      success: true,
      data: response.data || [],
      count: response.count || 0,
    };
  } catch (error: any) {
    console.error("Erro ao executar consulta:", error);
    return {
      success: false,
      data: [],
      count: 0,
      error: error.message || "Erro desconhecido ao executar consulta",
    };
  }
}

/**
 * Verifica se a conexão com o banco de dados está funcionando
 * @returns true se a conexão está OK, false caso contrário
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const response = await get(apiConfig.endpoints.health);
    return response.success === true;
  } catch (error) {
    console.error("Erro ao verificar conexão:", error);
    return false;
  }
}

/**
 * Exemplos de consultas comuns para SAP Business One
 */

/**
 * Consulta itens de produção
 */
export async function getProductionItems(filters?: {
  itemCode?: string;
  itemName?: string;
  limit?: number;
}): Promise<QueryResult> {
  let query = "SELECT TOP 100 * FROM OITM WHERE 1=1";

  if (filters?.itemCode) {
    query += ` AND ItemCode LIKE '%${filters.itemCode}%'`;
  }

  if (filters?.itemName) {
    query += ` AND ItemName LIKE '%${filters.itemName}%'`;
  }

  if (filters?.limit) {
    query = query.replace("TOP 100", `TOP ${filters.limit}`);
  }

  return executeQuery(query);
}

/**
 * Consulta ordens de produção
 */
export async function getProductionOrders(filters?: {
  docNum?: number;
  cardCode?: string;
  limit?: number;
}): Promise<QueryResult> {
  let query = "SELECT TOP 100 * FROM OWOR WHERE 1=1";

  if (filters?.docNum) {
    query += ` AND DocNum = ${filters.docNum}`;
  }

  if (filters?.cardCode) {
    query += ` AND CardCode = '${filters.cardCode}'`;
  }

  if (filters?.limit) {
    query = query.replace("TOP 100", `TOP ${filters.limit}`);
  }

  return executeQuery(query);
}

/**
 * Consulta clientes/fornecedores
 */
export async function getBusinessPartners(filters?: {
  cardCode?: string;
  cardName?: string;
  cardType?: string;
  limit?: number;
}): Promise<QueryResult> {
  let query = "SELECT TOP 100 * FROM OCRD WHERE 1=1";

  if (filters?.cardCode) {
    query += ` AND CardCode LIKE '%${filters.cardCode}%'`;
  }

  if (filters?.cardName) {
    query += ` AND CardName LIKE '%${filters.cardName}%'`;
  }

  if (filters?.cardType) {
    query += ` AND CardType = '${filters.cardType}'`;
  }

  if (filters?.limit) {
    query = query.replace("TOP 100", `TOP ${filters.limit}`);
  }

  return executeQuery(query);
}
