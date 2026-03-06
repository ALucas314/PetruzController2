# Service Layer - Guia de Instalação e Uso

Este guia explica como configurar e usar a service layer para conectar com o banco de dados SAP Business One.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Driver ODBC para SAP Business One (B1CRHPROXY) instalado no sistema
- Acesso ao servidor SAP Business One

## 🚀 Instalação

### 1. Instalar dependências do backend

```bash
cd server
npm install
```

### 2. Configurar variáveis de ambiente (opcional)

Crie um arquivo `.env` na pasta `server/`:

```env
PORT=3001
```

### 3. Iniciar o servidor backend

```bash
cd server
npm run dev
```

O servidor será iniciado na porta 3001 (ou a porta configurada).

### 4. Configurar URL da API no frontend (opcional)

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_API_URL=http://localhost:3001
```

## 📡 Endpoints da API

### GET /api/health
Verifica se a conexão com o banco está funcionando.

**Exemplo:**
```bash
curl http://localhost:3001/api/health
```

### POST /api/query
Executa uma consulta SQL (apenas SELECT).

**Exemplo:**
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT TOP 10 * FROM OITM"}'
```

## 💻 Uso no Frontend

### Exemplo básico

```typescript
import { executeQuery } from "@/services";

// Executar consulta
const result = await executeQuery("SELECT * FROM OITM WHERE ItemCode = 'ITEM001'");

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

### Exemplo com React Query

```typescript
import { useQuery } from "@tanstack/react-query";
import { getProductionItems } from "@/services";

function ProductionList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["production-items"],
    queryFn: () => getProductionItems({ limit: 100 })
  });

  // ... renderizar dados
}
```

## 🔒 Segurança

- ✅ Apenas consultas SELECT são permitidas
- ✅ Comandos perigosos (INSERT, UPDATE, DELETE, DROP, etc.) são bloqueados
- ✅ Validação de entrada em todas as requisições
- ✅ Timeout de 30 segundos nas requisições

## 📁 Estrutura de Arquivos

```
.
├── server/                    # Backend Node.js/Express
│   ├── config/
│   │   └── database.js        # Configuração de conexão
│   ├── services/
│   │   └── databaseService.js # Serviço de banco de dados
│   ├── routes/
│   │   └── queryRoutes.js     # Rotas da API
│   ├── index.js               # Servidor Express
│   └── package.json
│
└── src/
    └── services/              # Service layer do frontend
        ├── api/
        │   ├── config.ts      # Configuração da API
        │   └── client.ts      # Cliente HTTP
        ├── databaseService.ts # Serviços de consulta
        └── index.ts           # Exportações
```

## 🐛 Troubleshooting

### Erro: "Falha na conexão com o banco"
- Verifique se o driver ODBC está instalado
- Verifique se as credenciais em `server/config/database.js` estão corretas
- Verifique se o servidor SAP Business One está acessível

### Erro: "Timeout na requisição"
- Verifique se o servidor backend está rodando
- Verifique a URL da API no frontend
- Aumente o timeout se necessário (em `src/services/api/config.ts`)

### Erro: "Operação não permitida"
- Lembre-se: apenas SELECT é permitido
- Verifique se a query não contém comandos perigosos

## 📝 Notas

- As credenciais estão em `server/config/database.js` - considere usar variáveis de ambiente em produção
- O servidor usa connection pooling para melhor performance
- Todas as consultas são validadas antes da execução
