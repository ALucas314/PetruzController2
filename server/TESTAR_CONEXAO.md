# 🧪 Como Testar a Conexão com Supabase

## 1. Verificar se o .env existe

O arquivo `.env` deve estar na pasta `server/` com as credenciais.

## 2. Iniciar o servidor

```bash
cd server
npm run dev
```

## 3. Testar endpoints

### Teste 1: Health Check
```bash
curl http://localhost:3001/api/health
```

### Teste 2: Listar itens (testa Supabase)
```bash
curl http://localhost:3001/api/supabase/items
```

### Teste 3: Carregar produção
```bash
curl http://localhost:3001/api/supabase/producao/load
```

## 4. Verificar erros

Se aparecer erro de configuração:
- ✅ Verifique se o arquivo `.env` está na pasta `server/`
- ✅ Verifique se as chaves estão corretas (sem espaços extras)
- ✅ Verifique se a URL está correta (sem barra no final)
- ✅ Reinicie o servidor após criar/editar o `.env`

## 5. Testar no navegador

Acesse: http://localhost:3001/api/supabase/items

Se retornar JSON, está funcionando! ✅
