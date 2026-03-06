# ERP Controller Petruz - Backend Server

Backend API para conexão com o banco de dados SAP Business One.

## Instalação

```bash
cd server
npm install
```

## Configuração

As credenciais de conexão estão configuradas em `config/database.js`.

**IMPORTANTE**: Este servidor permite apenas consultas (SELECT). Operações de escrita (INSERT, UPDATE, DELETE) são bloqueadas por segurança.

## Executar

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

O servidor será iniciado na porta 3001 (ou a porta definida na variável de ambiente PORT).

## Endpoints

### GET /api/health
Verifica se a conexão com o banco de dados está funcionando.

**Resposta:**
```json
{
  "success": true,
  "message": "Conexão com o banco de dados está funcionando",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/query
Executa uma consulta SQL (apenas SELECT).

**Body:**
```json
{
  "query": "SELECT * FROM OITM WHERE ItemCode = 'ITEM001'"
}
```

**Resposta:**
```json
{
  "success": true,
  "data": [...],
  "count": 1
}
```

## Segurança

- Apenas consultas SELECT são permitidas
- Comandos perigosos (INSERT, UPDATE, DELETE, DROP, etc.) são bloqueados
- Validação de entrada em todas as requisições
