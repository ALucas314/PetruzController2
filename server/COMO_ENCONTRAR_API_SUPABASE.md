# Como Encontrar as Credenciais da API do Supabase

## Passo a Passo

### 1. Acesse o Dashboard do Supabase

1. Vá para: https://supabase.com/dashboard
2. Faça login na sua conta
3. Selecione o projeto **"ERP Controller Petruz"**

### 2. Navegue até Settings > API

1. No menu lateral esquerdo, clique em **"Settings"** (Configurações)
2. Clique em **"API"** no submenu

### 3. Encontre as Credenciais

Você verá uma página com as seguintes informações:

#### Project URL
```
https://lijveprlmfmpejghmysn.supabase.co
```
**Esta é a sua `SUPABASE_URL`**

#### API Keys

Você verá duas chaves principais:

1. **anon public** (Chave Pública)
   - Esta é a `SUPABASE_ANON_KEY`
   - Pode ser usada no frontend (menos permissões)
   - Formato: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

2. **service_role** (Chave de Serviço)
   - Esta é a `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ **MANTENHA SECRETA!** Use apenas no backend
   - Tem permissões completas (bypassa RLS)
   - Formato: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 4. Configurar no Projeto

#### Opção 1: Arquivo .env (Recomendado)

1. Na pasta `server/`, crie um arquivo chamado `.env`
2. Copie o conteúdo de `.env.example`
3. Preencha com suas credenciais:

```env
SUPABASE_URL=https://lijveprlmfmpejghmysn.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Opção 2: Configuração Direta (Apenas para testes)

Se preferir, você pode editar diretamente o arquivo `server/config/supabase.js`:

```javascript
export const supabaseConfig = {
  url: "https://lijveprlmfmpejghmysn.supabase.co",
  anonKey: "sua-chave-anon-key",
  serviceRoleKey: "sua-chave-service-role-key",
};
```

⚠️ **ATENÇÃO**: Não commite credenciais no Git! Use sempre `.env` e adicione `.env` ao `.gitignore`.

### 5. Verificar se está funcionando

Após configurar, teste a conexão:

```bash
cd server
npm run dev
```

Se houver erros de conexão, verifique:
- ✅ As credenciais estão corretas
- ✅ O arquivo `.env` está na pasta `server/`
- ✅ O projeto Supabase está ativo
- ✅ A tabela `producao` foi criada no banco

## Localização Visual no Dashboard

```
Supabase Dashboard
├── Projects
│   └── ERP Controller Petruz
│       ├── Table Editor
│       ├── SQL Editor
│       ├── Authentication
│       ├── Storage
│       └── Settings ⬅️ CLIQUE AQUI
│           ├── General
│           ├── API ⬅️ CLIQUE AQUI
│           ├── Database
│           └── ...
```

## Exemplo de Credenciais

Baseado na sua URL (`https://lijveprlmfmpejghmysn.supabase.co`), suas credenciais estarão assim:

- **Project URL**: `https://lijveprlmfmpejghmysn.supabase.co`
- **Project API keys**: Duas chaves longas começando com `eyJ...`

## Segurança

- ✅ Use `SUPABASE_SERVICE_ROLE_KEY` apenas no backend
- ✅ Nunca exponha a `service_role` key no frontend
- ✅ Adicione `.env` ao `.gitignore`
- ✅ Use `SUPABASE_ANON_KEY` no frontend (se necessário)
