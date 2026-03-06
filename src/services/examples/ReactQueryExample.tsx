/**
 * Exemplo de uso da service layer com React Query
 * Este componente demonstra como usar os serviços em componentes React
 */

import { useQuery } from "@tanstack/react-query";
import { executeQuery, getProductionItems, checkConnection } from "../index";

/**
 * Exemplo 1: Componente que busca itens de produção
 */
export function ProductionItemsExample() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["production-items"],
    queryFn: async () => {
      const result = await getProductionItems({ limit: 50 });
      if (!result.success) {
        throw new Error(result.error || "Erro ao buscar itens");
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  if (isLoading) {
    return <div>Carregando itens...</div>;
  }

  if (error) {
    return <div>Erro: {error.message}</div>;
  }

  return (
    <div>
      <h2>Itens de Produção ({data?.length || 0})</h2>
      <button onClick={() => refetch()}>Atualizar</button>
      <ul>
        {data?.map((item: any) => (
          <li key={item.ItemCode}>
            {item.ItemCode} - {item.ItemName}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Exemplo 2: Componente que verifica conexão
 */
export function ConnectionStatusExample() {
  const { data: isConnected, isLoading } = useQuery({
    queryKey: ["db-connection"],
    queryFn: checkConnection,
    refetchInterval: 30000, // Verifica a cada 30 segundos
  });

  if (isLoading) {
    return <div>Verificando conexão...</div>;
  }

  return (
    <div>
      Status da conexão:{" "}
      <span style={{ color: isConnected ? "green" : "red" }}>
        {isConnected ? "✅ Conectado" : "❌ Desconectado"}
      </span>
    </div>
  );
}

/**
 * Exemplo 3: Componente com consulta customizada
 */
export function CustomQueryExample() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["custom-query", "items-stock"],
    queryFn: async () => {
      const result = await executeQuery(
        "SELECT TOP 20 ItemCode, ItemName, OnHand FROM OITM WHERE OnHand > 0 ORDER BY OnHand DESC"
      );
      if (!result.success) {
        throw new Error(result.error || "Erro na consulta");
      }
      return result.data;
    },
  });

  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error.message}</div>;

  return (
    <div>
      <h2>Itens com Estoque</h2>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nome</th>
            <th>Estoque</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((item: any) => (
            <tr key={item.ItemCode}>
              <td>{item.ItemCode}</td>
              <td>{item.ItemName}</td>
              <td>{item.OnHand}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
