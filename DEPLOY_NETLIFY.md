# Deploy: GitHub + Netlify + Backend

Guia para subir a aplicação no [GitHub (ERPControllerPetruz1)](https://github.com/ALucas314/ERPControllerPetruz1), fazer deploy no Netlify e deixar banco e **Esqueci a senha** funcionando.

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

### 3.2 Variáveis de ambiente no Netlify

Em **Site settings → Environment variables → Add a variable** (ou **Add from .env**), adicione:

| Variável         | Obrigatório | Valor de exemplo | Uso |
|------------------|-------------|------------------|-----|
| `VITE_APP_URL`   | Recomendado | `https://seu-app.netlify.app` | URL do site no Netlify. Usada no **Esqueci a senha** para o link de redefinição (ex.: `https://seu-app.netlify.app/redefinir-senha?token=...`). |
| `VITE_API_URL`   | Sim         | `https://sua-api.onrender.com` | URL do backend (API). O frontend usa para login, redefinir senha, produção, relatórios, etc. |

Substitua pelos seus valores reais:

- **VITE_APP_URL:** depois do primeiro deploy, use a URL que o Netlify der (ex.: `https://erpcontrollerpetruz1.netlify.app`).
- **VITE_API_URL:** URL pública do backend (veja seção 4).

Depois de salvar, faça **Trigger deploy** para um novo build com essas variáveis.

---

## 4. Backend (API) — banco e “Esqueci a senha”

O Netlify só publica o frontend (HTML/JS). O **backend (Node/Express)** precisa estar em outro serviço para o banco e o “Esqueci a senha” funcionarem.

### 4.1 Onde hospedar a API

- [Render](https://render.com) (Web Service, plano gratuito)
- [Railway](https://railway.app)
- [Fly.io](https://fly.io)
- Ou um VPS/servidor seu

### 4.2 No serviço do backend

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

### 4.3 Caminho do .env no servidor

O código do backend pode carregar `../src/Data/.env` em relação à pasta `server/`. Em Render/Railway é mais seguro **não** depender desse arquivo e configurar tudo pelas **variáveis de ambiente do painel**. Assim o banco e o “Esqueci a senha” funcionam sem colocar `.env` no Git.

---

## 5. Resumo: o que precisa funcionar

| Onde        | O que configurar |
|------------|-------------------|
| **GitHub** | Código da aplicação (sem `.env`). |
| **Netlify** | Build do frontend + `VITE_APP_URL` e `VITE_API_URL`. |
| **Backend (Render etc.)** | API no ar + variáveis Supabase e `JWT_SECRET`. |

- **Banco:** o backend usa as variáveis do Supabase no serviço onde a API roda.
- **Esqueci a senha:** o link de redefinição usa a URL do site (Netlify); a geração e validação do token são feitas na API (backend). Com `VITE_APP_URL` e `VITE_API_URL` corretos, o fluxo fica 100% online.

---

## 6. Checklist rápido

- [ ] `.gitignore` inclui `.env` e `src/Data/.env` (já configurado).
- [ ] Nenhum `.env` com senhas foi commitado.
- [ ] Código enviado para `https://github.com/ALucas314/ERPControllerPetruz1`.
- [ ] Site no Netlify conectado a esse repositório.
- [ ] No Netlify: `VITE_APP_URL` = URL do site; `VITE_API_URL` = URL do backend.
- [ ] Backend publicado (Render/Railway/etc.) com variáveis do Supabase e `JWT_SECRET`.
- [ ] Novo deploy no Netlify após definir as variáveis.
