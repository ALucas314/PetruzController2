/**
 * Exemplos de uso da service layer
 * Este arquivo serve como referência de como usar os serviços
 */

import {
  executeQuery,
  checkConnection,
  getProductionItems,
  getProductionOrders,
  getBusinessPartners,
} from "../index";

/**
 * Exemplo 1: Verificar conexão
 */
export async function exemploVerificarConexao() {
  const isConnected = await checkConnection();
  if (isConnected) {
    console.log("✅ Conexão com o banco de dados está OK");
  } else {
    console.error("❌ Erro na conexão com o banco de dados");
  }
}

/**
 * Exemplo 2: Consulta SQL simples
 */
export async function exemploConsultaSimples() {
  const result = await executeQuery(
    "SELECT TOP 10 ItemCode, ItemName, OnHand FROM OITM WHERE OnHand > 0"
  );

  if (result.success) {
    console.log(`Encontrados ${result.count} itens:`);
    result.data.forEach((item: any) => {
      console.log(`- ${item.ItemCode}: ${item.ItemName} (Estoque: ${item.OnHand})`);
    });
  } else {
    console.error("Erro:", result.error);
  }
}

/**
 * Exemplo 3: Buscar itens de produção
 */
export async function exemploBuscarItens() {
  const result = await getProductionItems({
    itemCode: "ITEM",
    limit: 20,
  });

  if (result.success) {
    console.log(`Encontrados ${result.count} itens`);
    return result.data;
  } else {
    console.error("Erro:", result.error);
    return [];
  }
}

/**
 * Exemplo 4: Buscar ordens de produção
 */
export async function exemploBuscarOrdens() {
  const result = await getProductionOrders({
    limit: 50,
  });

  if (result.success) {
    console.log(`Encontradas ${result.count} ordens de produção`);
    return result.data;
  } else {
    console.error("Erro:", result.error);
    return [];
  }
}

/**
 * Exemplo 5: Buscar clientes
 */
export async function exemploBuscarClientes() {
  const result = await getBusinessPartners({
    cardType: "C", // C = Cliente
    limit: 100,
  });

  if (result.success) {
    console.log(`Encontrados ${result.count} clientes`);
    return result.data;
  } else {
    console.error("Erro:", result.error);
    return [];
  }
}

/**
 * Exemplo 6: Consulta com filtros complexos
 */
export async function exemploConsultaComplexa() {
  const query = `
    SELECT 
      T0.ItemCode,
      T0.ItemName,
      T0.OnHand,
      T1.WhsCode,
      T1.OnHand AS EstoqueAlmoxarifado
    FROM OITM T0
    INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode
    WHERE T0.OnHand > 0
    ORDER BY T0.ItemCode
  `;

  const result = await executeQuery(query);

  if (result.success) {
    console.log(`Consulta executada com sucesso. ${result.count} registros encontrados.`);
    return result.data;
  } else {
    console.error("Erro:", result.error);
    return [];
  }
}
