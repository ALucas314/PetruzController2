# Guia: Subir no Netlify + Supabase + Esqueci a senha

Este guia explica como publicar o app no Netlify e deixar o Supabase (login, dados e **Esqueci a senha**) funcionando. **Não é necessário subir o backend** para login, painel, produção, relatórios e redefinição de senha — tudo funciona direto do frontend com o Supabase.

---

## 1. Preparar o repositório no GitHub

Se ainda não fez:

1. Envie o código para o GitHub (ex.: `https://github.com/ALucas314/PetruzController2`).
2. **Nunca** commite arquivos `.env` com chaves do Supabase — eles devem ficar só no Netlify (e no seu PC para desenvolvimento).

---

## 2. Deploy no Netlify

### 2.1 Conectar o repositório

1. Acesse [netlify.com](https://www.netlify.com/) e faça login.
2. **Add new site** → **Import an existing project**.
3. Conecte o **GitHub** e escolha o repositório do projeto (ex.: `PetruzController2`).
4. O Netlify usa o `netlify.toml` da raiz do projeto. Confirme:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. **Deploy** (pode falhar na primeira vez se faltar variáveis — próximo passo).

### 2.2 Variáveis de ambiente no Netlify

Em **Site settings** → **Environment variables** → **Add a variable** (ou **Add multiple**), adicione:

| Variável                 | Obrigatório | Onde pegar | Exemplo |
|--------------------------|-------------|------------|---------|
| `VITE_SUPABASE_URL`      | **Sim**     | Supabase → **Project Settings** → **API** → Project URL | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **Sim**     | Supabase → **Project Settings** → **API** → anon **public** | `eyJhbGc...` |
| `VITE_APP_URL`           | Recomendado | URL do seu site no Netlify (aparece após o primeiro deploy) | `https://petruz-controller.netlify.app` |

- **Não** defina `VITE_API_URL` no Netlify (o app usa Supabase direto; definir como URL do site causa 404).
- Depois de salvar as variáveis, vá em **Deploys** → **Trigger deploy** → **Deploy site** para gerar um novo build.

---

## 3. Configurar o Supabase para o Esqueci a senha

O fluxo **Esqueci a senha** é assim: o usuário informa o e-mail no app → o Supabase envia o e-mail com um link → o link abre a sua aplicação em `/redefinir-senha` (no Netlify). Para isso funcionar, o Supabase precisa aceitar a URL do seu site.

### 3.1 URLs no Supabase

1. No **Supabase**, abra o projeto.
2. Vá em **Authentication** → **URL Configuration**.
3. Preencha (trocando pela URL real do seu site no Netlify):

| Campo            | Valor (exemplo) |
|------------------|------------------|
| **Site URL**     | `https://petruz-controller.netlify.app` |
| **Redirect URLs**| Adicione estas linhas (uma por linha):<br>• `https://petruz-controller.netlify.app`<br>• `https://petruz-controller.netlify.app/redefinir-senha`<br>• `https://petruz-controller.netlify.app/**` |

4. Salve.

Assim, quando o Supabase enviar o e-mail de redefinição, o link vai abrir o seu app no Netlify na rota `/redefinir-senha` e o usuário consegue trocar a senha.

### 3.2 (Opcional) E-mail de redefinição de senha

Em **Authentication** → **Email Templates** → **Reset Password** você pode editar o texto do e-mail. O link de redefinição é inserido automaticamente pelo Supabase.

---

## 4. Resumo do que fica onde

| Onde       | O que configurar |
|------------|-------------------|
| **GitHub** | Código do projeto (sem `.env`). |
| **Netlify**| Build do frontend + `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`. |
| **Supabase**| **Authentication** → **URL Configuration**: Site URL e Redirect URLs com a URL do site no Netlify (incluindo `/redefinir-senha`). |

- **Login, dados e Esqueci a senha:** o frontend no Netlify fala direto com o Supabase. Nada de backend extra.
- **Esqueci a senha:** o usuário clica em “Esqueci minha senha” → informa o e-mail → recebe o link no e-mail → abre no seu app (Netlify) e redefine a senha.

---

## 5. Checklist rápido

- [ ] Código no GitHub (sem `.env`).
- [ ] Site no Netlify conectado ao repositório.
- [ ] No Netlify: variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_APP_URL` (esta com a URL do site).
- [ ] No Supabase: **URL Configuration** com Site URL e Redirect URLs apontando para a URL do Netlify e para `/redefinir-senha`.
- [ ] Novo deploy no Netlify após salvar as variáveis.
- [ ] Testar: abrir o site no Netlify → Login → “Esqueci minha senha” → informar e-mail → abrir o link do e-mail e redefinir a senha.

---

## 6. Backend (API Node) — quando é necessário?

Só é necessário subir o backend (ex.: Render, Railway) se você for usar funcionalidades que dependem da **API Node** (por exemplo, importação de Excel via servidor). Para **login, painel, produção, relatórios e Esqueci a senha**, o frontend no Netlify + Supabase é suficiente.
