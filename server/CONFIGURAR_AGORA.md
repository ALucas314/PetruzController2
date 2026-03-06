# ⚡ CONFIGURAR SUPABASE AGORA

## Passo 1: Criar arquivo .env

Na pasta `server/`, crie um arquivo chamado `.env` (sem extensão)

## Passo 2: Copiar suas credenciais do Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione: **ERP Controller Petruz**
3. Vá em: **Settings > API Keys**
4. Copie:

### ✅ NOVAS CHAVES (Recomendado)
```env
SUPABASE_URL=https://lijveprlmfmpejghmysn.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_mCTv1KKLA2GQjq0s_W7tzA_RInwNr3Z
SUPABASE_SECRET_KEY=sb_secret_Imqdi...
```

### OU CHAVES ANTIGAS (Se ainda aparecer)
```env
SUPABASE_URL=https://lijveprlmfmpejghmysn.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Passo 3: Colar no arquivo .env

Crie o arquivo `server/.env` com o conteúdo acima, substituindo pelos seus valores reais.

## Passo 4: Testar

```bash
cd server
npm run dev
```

Se aparecer:
```
🚀 Servidor rodando na porta 3001
```

✅ **Está conectado!**
