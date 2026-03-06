# Tabelas do banco (Supabase) – ERP Controller Petruz

Descrição de cada tabela do schema `public` e para que serve no sistema.

---

## OCPD – Programação diária de produção

| Campo (principais) | Descrição |
|--------------------|-----------|
| `data_dia`, `filial_nome` | Data e filial do dia |
| `op`, `codigo_item`, `descricao_item`, `linha` | OP, item, linha de produção |
| `qtd_planejada`, `qtd_realizada`, `diferenca` | Quantidades planejada, realizada e diferença |
| `reprocesso_*` | Campos de reprocesso (cortado/usado) no próprio registro |
| `estim_latas_*`, `latas_ja_batidas`, `total_ja_cortado` | Controle de latas e totais |

**Para que serve:** Registra a **produção diária** por data e filial: itens (OP, código, descrição, linha), quantidades planejada/realizada, reprocessos e totais. É a tabela principal da tela **Produção** e da base dos **relatórios**.

---

## OCLP – Linhas de produção

| Campo | Descrição |
|-------|-----------|
| `Code` | Código da linha (ex.: L01, L02) |
| `Name` | Nome/descrição da linha |

**Para que serve:** Cadastro de **linhas de produção**. Usada na tela **Cadastro de Linhas** e nos selects de linha na **Produção** e em filtros.

---

## OCTI – Itens (produtos)

| Campo | Descrição |
|-------|-----------|
| `Code` | Código do item |
| `Name` | Descrição do item |
| `U_Uom` | Unidade de medida |
| `U_ItemGroup` | Grupo de itens |

**Para que serve:** Cadastro de **itens/produtos**. Usada na tela de **Itens**, na **Produção** (busca por código) e na **Importar Excel** (comparação e inserção de novos itens).

---

## OCTF – Filiais

| Campo | Descrição |
|-------|-----------|
| `Code` | Código da filial |
| `Name` | Nome da filial |
| `Address` | Endereço |

**Para que serve:** Cadastro de **filiais**. Usada no **Dashboard** (filtro por filial), na **Produção** (seleção de filial) e em relatórios.

---

## OCTU – Usuários (espelho para relatórios/cadastro)

| Campo | Descrição |
|-------|-----------|
| `email` | E-mail (único) |
| `password_hash` | Senha hasheada (legado) |
| `nome` | Nome do usuário |
| `ativo` | Se o usuário está ativo |

**Para que serve:** Lista de **usuários do sistema**. O **login** é feito pelo **Supabase Auth** (`auth.users`). A OCTU pode ser mantida como espelho (ex.: trigger ao cadastrar no Auth) para relatórios ou cadastro interno. O app não usa OCTU para autenticação.

---

## OCTU_DRAFT_AUTH – Rascunho por usuário logado (Supabase Auth)

| Campo | Descrição |
|-------|-----------|
| `auth_user_id` | UUID do usuário no Supabase Auth |
| `screen` | Tela (ex.: `producao`) |
| `data` | Estado da tela em JSON (data, filial, itens, reprocessos, etc.) |
| `updated_at` | Última atualização |

**Para que serve:** Guarda o **rascunho** da tela **Produção** (e eventualmente de outras telas) por usuário. Assim, ao sair sem clicar em “Salvar” e voltar depois, o app restaura data, filial, itens e reprocessos a partir dessa tabela.

---

## OCTU_DRAFT – Rascunho (legado, por usuário OCTU)

| Campo | Descrição |
|-------|-----------|
| `user_id` | ID do usuário na tabela OCTU |
| `screen` | Tela (ex.: producao) |
| `data` | Estado em JSON |

**Para que serve:** Era usada quando o login era pela OCTU (backend). Hoje o app usa **OCTU_DRAFT_AUTH** (Supabase Auth). Pode ser mantida por compatibilidade ou removida se não houver outro uso.

---

## OCTU_RESET – Tokens de redefinição de senha (legado)

| Campo | Descrição |
|-------|-----------|
| `user_id` | ID do usuário na OCTU |
| `token_hash` | Hash do token de redefinição |
| `expires_at` | Data de expiração do token |

**Para que serve:** Era usada para o fluxo “Esqueci a senha” quando o login era pela OCTU + backend. Hoje o **Esqueci a senha** é feito pelo **Supabase** (e-mail + link). Pode ser mantida por histórico ou removida.

---

## Resumo rápido

| Tabela | Uso no app |
|--------|------------|
| **OCPD** | Produção diária (itens, quantidades, reprocessos, latas). |
| **OCLP** | Cadastro de linhas de produção. |
| **OCTI** | Cadastro de itens; Importar Excel. |
| **OCTF** | Cadastro de filiais; filtros no dashboard e produção. |
| **OCTU** | Lista de usuários (espelho/relatório); login é Supabase Auth. |
| **OCTU_DRAFT_AUTH** | Rascunho da tela Produção por usuário logado. |
| **OCTU_DRAFT** | Legado (rascunho por OCTU). |
| **OCTU_RESET** | Legado (tokens de redefinição de senha). |
