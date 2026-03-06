# 🚀 Configuração Rápida do Supabase

## 📍 Onde Encontrar as Credenciais da API

### Passo 1: Acesse o Dashboard
1. Vá para: **https://supabase.com/dashboard**
2. Faça login
3. Selecione o projeto: **"ERP Controller Petruz"**

### Passo 2: Navegue até Settings > API
1. No menu lateral esquerdo, clique em **⚙️ Settings**
2. Clique em **🔑 API**

### Passo 3: Copie as Credenciais

Você verá uma página com as **NOVAS CHAVES** do Supabase:

```
┌─────────────────────────────────────────────────┐
│ Project URL                                      │
│ https://lijveprlmfmpejghmysn.supabase.co        │
│                                                  │
│ Publishable key                                  │
│ sb_publishable_mCTv1KKLA2GQjq0s_W7tzA_...      │
│ [Copy]                                           │
│                                                  │
│ Secret keys                                      │
│ sb_secret_Imqdi...                               │
│ [Reveal] [Copy]                                  │
└─────────────────────────────────────────────────┘
```

**Nota:** Se você ainda vê "anon public" e "service_role", essas são as chaves antigas e ainda funcionam!

### Passo 4: Configure no Projeto

1. **Crie o arquivo `.env` na pasta `server/`:**

```bash
cd server
```

2. **Crie o arquivo `.env`** (copie de `.env.example` se existir):

```env
SUPABASE_URL=https://lijveprlmfmpejghmysn.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3001
```

3. **Substitua os valores:**
   - `SUPABASE_URL` → Cole o **Project URL** completo
   - `SUPABASE_PUBLISHABLE_KEY` → Cole a chave **Publishable key** (começa com `sb_publishable_`)
   - `SUPABASE_SECRET_KEY` → Cole a chave **Secret key** (clique em "Reveal" primeiro, começa com `sb_secret_`)

   **OU** se você ainda usa as chaves antigas:
   - `SUPABASE_ANON_KEY` → Cole a chave **anon public**
   - `SUPABASE_SERVICE_ROLE_KEY` → Cole a chave **service_role**

### Passo 5: Testar

```bash
cd server
npm install  # Se ainda não instalou as dependências
npm run dev
```

Se tudo estiver correto, você verá:
```
🚀 Servidor rodando na porta 3001
📡 API disponível em http://localhost:3001
```

## ⚠️ Importante

- ✅ **Nunca** commite o arquivo `.env` no Git
- ✅ A chave **Secret key** (`SUPABASE_SECRET_KEY`) tem permissões totais - mantenha segredo!
- ✅ Use `SUPABASE_PUBLISHABLE_KEY` no frontend (se necessário, com RLS habilitado)
- ✅ Use `SUPABASE_SECRET_KEY` apenas no backend
- ✅ O sistema suporta tanto as novas chaves quanto as antigas (compatibilidade)

## 🔍 Verificar se está funcionando

Teste a conexão fazendo uma requisição:

```bash
curl http://localhost:3001/api/supabase/items
```

Ou acesse no navegador: `http://localhost:3001/api/supabase/items`

## 📝 Estrutura do Arquivo .env

```
server/
├── .env              ← Crie este arquivo aqui
├── .env.example      ← Exemplo (pode copiar)
├── config/
│   └── supabase.js   ← Lê as variáveis do .env
└── ...
```

## 🆘 Problemas Comuns

### Erro: "SUPABASE_URL não configurada"
- ✅ Verifique se o arquivo `.env` está na pasta `server/`
- ✅ Verifique se as variáveis estão escritas corretamente
- ✅ Reinicie o servidor após criar/editar o `.env`

### Erro: "Invalid API key"
- ✅ Verifique se copiou a chave completa (são muito longas)
- ✅ Certifique-se de que não há espaços extras
- ✅ Use a chave `service_role` para o backend

### Erro de conexão
- ✅ Verifique se o projeto Supabase está ativo
- ✅ Verifique se a URL está correta (sem barra no final)
- ✅ Teste a URL no navegador: deve mostrar uma página JSON
