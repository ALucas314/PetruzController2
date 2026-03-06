# Service Layer - ERP Controller Petruz

Service layer para comunicação com o banco de dados SAP Business One através da API backend.

## Estrutura

```
src/services/
├── api/
│   ├── config.ts      # Configuração da API
│   └── client.ts      # Cliente HTTP
├── databaseService.ts # Serviços de consulta ao banco
└── index.ts           # Exportações principais
```

## Uso Básico

### Executar uma consulta SQL

```typescript
import { executeQuery } from "@/services";

// Consulta simples
const result = await executeQuery("SELECT * FROM OITM WHERE ItemCode = 'ITEM001'");

if (result.success) {
  console.log("Dados:", result.data);
  console.log("Total de registros:", result.count);
} else {
  console.error("Erro:", result.error);
}
```

### Verificar conexão

```typescript
import { checkConnection } from "@/services";

const isConnected = await checkConnection();
if (isConnected) {
  console.log("✅ Conexão OK");
} else {
  console.log("❌ Erro na conexão");
}
```

### Usar funções pré-definidas

```typescript
import { getProductionItems, getProductionOrders, getBusinessPartners } from "@/services";

// Buscar itens de produção
const items = await getProductionItems({
  itemCode: "ITEM",
  limit: 50
});

// Buscar ordens de produção
const orders = await getProductionOrders({
  cardCode: "C001"
});

// Buscar parceiros de negócio
const partners = await getBusinessPartners({
  cardType: "C" // C = Cliente, S = Fornecedor
});
```

## Uso com React Query

```typescript
import { useQuery } from "@tanstack/react-query";
import { executeQuery } from "@/services";

function MyComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["production-items"],
    queryFn: async () => {
      const result = await executeQuery("SELECT * FROM OITM");
      if (!result.success) throw new Error(result.error);
      return result.data;
    }
  });

  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error.message}</div>;

  return (
    <div>
      {data?.map(item => (
        <div key={item.ItemCode}>{item.ItemName}</div>
      ))}
    </div>
  );
}
```

## Segurança

⚠️ **IMPORTANTE**: A service layer permite apenas consultas SELECT. Operações de escrita (INSERT, UPDATE, DELETE) são bloqueadas no backend por segurança.

## Configuração

A URL da API pode ser configurada através da variável de ambiente `VITE_API_URL` ou será usada a URL padrão `http://localhost:3001`.
