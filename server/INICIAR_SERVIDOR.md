# 🚀 Como Iniciar o Servidor Backend

## ⚠️ IMPORTANTE
O servidor backend **DEVE estar rodando** para que o frontend funcione corretamente!

## 📋 Passos para Iniciar

### 1. Abrir Terminal na Pasta do Servidor

```bash
cd server
```

### 2. Instalar Dependências (se ainda não instalou)

```bash
npm install
```

### 3. Iniciar o Servidor

**Modo Desenvolvimento (com auto-reload):**
```bash
npm run dev
```

**Modo Produção:**
```bash
npm start
```

### 4. Verificar se Está Rodando

Você deve ver no console:
```
🚀 Servidor rodando na porta 3001
📡 API disponível em http://localhost:3001
🔍 Health check: http://localhost:3001/api/health
```

### 5. Testar a Conexão

Abra no navegador: http://localhost:3001/api/health

Deve retornar:
```json
{
  "success": true,
  "message": "API rodando",
  "timestamp": "..."
}
```

## 🔧 Solução de Problemas

### Erro: "Port 3001 is already in use"
- Outro processo está usando a porta 3001
- Solução: Encerre o processo ou mude a porta no arquivo `.env`

### Erro: "Cannot find module"
- Execute: `npm install` na pasta `server/`

### Erro: "ERR_CONNECTION_REFUSED"
- O servidor não está rodando
- Verifique se executou `npm run dev` ou `npm start`

## 📝 Notas

- O servidor roda na porta **3001** por padrão
- Mantenha o terminal aberto enquanto o servidor estiver rodando
- Para parar o servidor: Pressione `Ctrl + C` no terminal
