# Deploy: GitHub + Netlify (100% Supabase)

O app está adaptado para usar **Supabase direto do frontend**: autenticação (Supabase Auth) e dados (tabelas OCPD, OCLP, OCTI, OCTF, OCPR) via cliente JavaScript. **Não é necessário subir o backend Node** para login, painel, produção, relatórios e cadastro de linhas.

- **Esqueci a senha:** Supabase envia o e-mail; o usuário redefine a senha na própria URL do app.
- **Importar Excel:** 100% no frontend (lib xlsx + leitura/compare/insert direto no Supabase). Nada depende de backend.

---

## 0. Rodar o projeto localmente

1. **Crie um arquivo `.env` na raiz do projeto** (mesma pasta do `package.json`), com as variáveis do Supabase:
   - Copie o conteúdo de `.env.example` para `.env`.
   - Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (em **Supabase** → Project Settings → API: Project URL e chave **anon public**).

2. **Instale e rode o frontend:**
   ```bash
   npm install
   npm run dev
   ```

3. Acesse **http://localhost:8080** (ou a porta que o terminal mostrar). Faça login com um usuário já criado no Supabase (Authentication → Users) ou cadastre-se pela tela de registro.

Se aparecer "Falha de conexão" ou "Supabase não configurado", confira se o `.env` está na **raiz** do projeto e se as variáveis começam com `VITE_`.

---

## 1. Subir a aplicação para o GitHub

As **variáveis de ambiente ficam fora do Git** (estão no `.gitignore`). Nunca commite arquivos `.env` com senhas ou chaves.

### 1.1 Abrir o terminal na pasta do projeto

```bash
cd "C:\Users\TI-0216\Documents\Site ERP\ERP-Controller-Petruz"
```

### 1.2 Inicializar Git (se ainda não tiver)

```bash
git init
```

### 1.3 Adicionar o remote do GitHub

```bash
git remote add origin https://github.com/ALucas314/ERPControllerPetruz1.git
```

Se já existir um `origin`, troque por:

```bash
git remote set-url origin https://github.com/ALucas314/ERPControllerPetruz1.git
```

### 1.4 Adicionar arquivos, commit e push

```bash
git add .
git status
```

Confirme que **não** aparecem arquivos como `src/Data/.env` ou qualquer `.env`. Se aparecer, não faça `git add` neles.

```bash
git commit -m "Deploy: app ERP Controller Petruz para Netlify"
git branch -M main
git push -u origin main
```

Se o GitHub pedir autenticação, use um **Personal Access Token** (Settings → Developer settings → Personal access tokens) no lugar da senha.

---

## 2. Variáveis de ambiente (Git ignore)

Os arquivos de ambiente estão no **.gitignore** e **não** vão para o repositório:

- `.env`
- `.env.local`
- `src/Data/.env`
- `**/.env`
- etc.

Ou seja: **nunca** commite senhas, chaves do Supabase ou `JWT_SECRET`. Configure-as:

- **No seu PC:** em `src/Data/.env` (só local).
- **No Netlify:** no painel do site (variáveis do build).
- **No backend (Render/Railway/etc.):** no painel do serviço.

---

## 3. Deploy do frontend no Netlify

### 3.1 Conectar o repositório

1. Acesse [netlify.com](https://www.netlify.com/) e faça login.
2. **Add new site** → **Import an existing project**.
3. Conecte o **GitHub** e escolha o repositório **ALucas314/ERPControllerPetruz1**.
4. O Netlify usa o `netlify.toml` na raiz. Confirme:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Avance sem preencher variáveis ainda (próximo passo).

### 3.2 Variáveis de ambiente no Netlify (100% Supabase)

Em **Site settings → Environment variables**, adicione **apenas** estas:

| Variável                 | Obrigatório | Uso |
|--------------------------|-------------|-----|
| `VITE_SUPABASE_URL`      | Sim         | URL do projeto no Supabase (ex.: `https://xxxx.supabase.co`). Em **Supabase → Project Settings → API**. |
| `VITE_SUPABASE_ANON_KEY` | Sim         | Chave **anon (public)** do Supabase. Em **Project Settings → API**. Não use a secret key aqui. |
| `VITE_APP_URL`            | Recomendado | URL do site no Netlify (ex.: `https://erppetruzcontroller.netlify.app`). Usada no **Esqueci a senha** (redirect). |

**Importante:** **Não defina `VITE_API_URL`** no Netlify. O app não usa backend para login nem dados; se `VITE_API_URL` for a URL do próprio site, o navegador tenta chamar `https://seu-site.netlify.app/api/supabase/auth/login` e dá **404**. Remova `VITE_API_URL` se existir e faça um novo deploy.

Depois de salvar, faça **Trigger deploy** para um novo build.

**No Supabase (Authentication → URL Configuration):** defina **Site URL** e **Redirect URLs** com a URL do seu app no Netlify (ex.: `https://erppetruzcontroller.netlify.app` e `https://erppetruzcontroller.netlify.app/redefinir-senha`).

---

## 4. Backend (API) — banco e “Esqueci a senha”

O Netlify só publica o frontend (HTML/JS). O **backend (Node/Express)** precisa estar em outro serviço para o banco e o “Esqueci a senha” funcionarem.

### 4.1 RLS no Supabase

No **Supabase → SQL Editor**, execute `src/Data/PostgressSQL/SUPABASE_RLS_AND_DRAFT_AUTH.sql` para criar OCTU_DRAFT_AUTH e políticas RLS (OCPD, OCLP, OCTI, OCTF, OCPR).

### 5.1 Onde hospedar a API (se precisar de Importar Excel)

- [Render](https://render.com) (Web Service, plano gratuito)
- [Railway](https://railway.app)
- [Fly.io](https://fly.io)
- Ou um VPS/servidor seu

### 5.2 No serviço do backend

1. Conecte o **mesmo repositório** (ou só a pasta `server/`).
2. Defina **root** ou **start command** para a pasta do backend (ex.: `server` no Render).
3. Configure as **variáveis de ambiente** no painel (não use `.env` no repositório):

| Variável                  | Uso |
|---------------------------|-----|
| `SUPABASE_URL`            | URL do projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY`| Chave pública (anon) |
| `SUPABASE_SECRET_KEY`     | Chave de serviço (service_role) |
| `JWT_SECRET`              | Chave para tokens JWT (produção) |
| `PORT`                    | Geralmente definido pelo host (ex.: Render) |

4. Obtenha a **URL pública** da API (ex.: `https://erp-petruz-api.onrender.com`) e use como **VITE_API_URL** no Netlify.

### 5.3 Caminho do .env no servidor

O código do backend pode carregar `../src/Data/.env` em relação à pasta `server/`. Em Render/Railway é mais seguro **não** depender desse arquivo e configurar tudo pelas **variáveis de ambiente do painel**. Assim o banco e o “Esqueci a senha” funcionam sem colocar `.env` no Git.

---

## 6. Resumo: o que precisa funcionar

| Onde        | O que configurar |
|------------|-------------------|
| **GitHub** | Código da aplicação (sem `.env`). |
| **Netlify** | Build do frontend + `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`. |
| **Supabase** | RLS + OCTU_DRAFT_AUTH (rodar `SUPABASE_RLS_AND_DRAFT_AUTH.sql`); Auth → URL Configuration com a URL do Netlify. |

- **Banco e login:** o frontend fala direto com o Supabase (Auth + tabelas). Não é preciso backend para isso.
- **Esqueci a senha:** Supabase envia o e-mail; o usuário redefine a senha na página `/redefinir-senha` do seu app.

---

## 7. Checklist rápido

- [ ] `.gitignore` inclui `.env` e `src/Data/.env` (já configurado).
- [ ] Nenhum `.env` com senhas foi commitado.
- [ ] Código enviado para `https://github.com/ALucas314/ERPControllerPetruz1`.
- [ ] Site no Netlify conectado a esse repositório.
- [ ] No Netlify: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`.
- [ ] No Supabase: executar `SUPABASE_RLS_AND_DRAFT_AUTH.sql`; Auth → URL Configuration com a URL do Netlify.
- [ ] Novo deploy no Netlify após definir as variáveis.

---

## 8. Para funcionar no celular

- [ ] **Usar a URL do Netlify no celular**  
  No celular, abra o app pela URL de produção (ex.: `https://erppetruzcontroller.netlify.app`). Não use `localhost` no celular para login — o Supabase redireciona para a URL configurada (Netlify).

- [ ] **Supabase → Authentication → URL Configuration**  
  Em **Redirect URLs** deve constar exatamente a URL do seu site (ex.: `https://erppetruzcontroller.netlify.app` e `https://erppetruzcontroller.netlify.app/**` e `https://erppetruzcontroller.netlify.app/redefinir-senha`). Assim login e “Esqueci a senha” funcionam ao abrir pelo celular.

- [ ] **HTTPS**  
  O Netlify já serve em HTTPS. Em redes públicas ou 4G, o app e o Supabase funcionam normalmente.

- [ ] **Testar em modo anônimo/privado**  
  Se der problema de sessão no celular, teste em uma aba anônima ou limpe cookies do site.

- [ ] **Opcional: “Adicionar à tela inicial”**  
  No navegador do celular: menu → “Adicionar à tela inicial” (ou “Instalar app”). O app usa um manifest básico para abrir em tela cheia.
