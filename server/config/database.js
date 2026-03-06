/**
 * Configuração de conexão com o banco de dados SAP Business One
 * Apenas para consultas (SELECT) - sem operações de escrita
 */

export const dbConfig = {
  connectionString: "DRIVER={B1CRHPROXY};SERVERNODE=petruzh:30015;DATABASE=SBO_PETRUZ_BR_TST",
  user: "B1ADMIN",
  password: "@uP7bNatq2Xcm5",
};

/**
 * Cria uma string de conexão ODBC completa
 */
export function getConnectionString() {
  return `${dbConfig.connectionString};UID=${dbConfig.user};PWD=${dbConfig.password}`;
}
