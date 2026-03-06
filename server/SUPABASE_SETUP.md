# Configuração do Supabase

## Passos para Configurar

### 1. Criar Tabelas no Supabase

Execute os seguintes SQLs no Supabase SQL Editor:

#### Tabela de Itens

```sql
CREATE TABLE IF NOT EXISTS itens (
  id BIGSERIAL PRIMARY KEY,
  codigo_item VARCHAR(50) UNIQUE NOT NULL,
  nome_item TEXT NOT NULL,
  unidade_medida VARCHAR(20),
  grupo_itens VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_codigo_item ON itens(codigo_item);
```

#### Tabela de Produção

Execute o arquivo completo `SUPABASE_PRODUCAO_TABLE.sql` ou copie o SQL abaixo:

```sql
CREATE TABLE IF NOT EXISTS producao (
  id BIGSERIAL PRIMARY KEY,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  numero INTEGER NOT NULL,
  op VARCHAR(50),
  codigo VARCHAR(100),
  descricao TEXT,
  linha VARCHAR(100),
  qtd_planejada DECIMAL(15, 2) DEFAULT 0,
  qtd_realizada DECIMAL(15, 2) DEFAULT 0,
  diferenca DECIMAL(15, 2) DEFAULT 0,
  calculo_1_horas DECIMAL(10, 2),
  restante_horas VARCHAR(50),
  hora_atual TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  hora_final_previsao TIMESTAMP WITH TIME ZONE,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_producao_data ON producao(data);
CREATE INDEX IF NOT EXISTS idx_producao_codigo ON producao(codigo);
CREATE INDEX IF NOT EXISTS idx_producao_op ON producao(op);
CREATE INDEX IF NOT EXISTS idx_producao_linha ON producao(linha);
CREATE INDEX IF NOT EXISTS idx_producao_data_numero ON producao(data, numero);
```

**Arquivo completo disponível em:** `server/SUPABASE_PRODUCAO_TABLE.sql`

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na pasta `server/` com as seguintes variáveis:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-key
```

**Onde encontrar essas informações:**
1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto "ERP Controller Petruz"
3. No menu lateral, clique em **Settings** (Configurações)
4. Clique em **API**
5. Copie as informações:
   - **Project URL** → `SUPABASE_URL` (exemplo: `https://lijveprlmfmpejghmysn.supabase.co`)
   - **anon public** → `SUPABASE_ANON_KEY` (chave longa começando com `eyJ...`)
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (chave longa começando com `eyJ...`) ⚠️ MANTENHA SECRETA!

**📖 Guia detalhado:** Veja o arquivo `COMO_ENCONTRAR_API_SUPABASE.md` para instruções passo a passo com imagens.

### 3. Instalar Dependências

```bash
cd server
npm install
```

### 4. Estrutura Esperada do CSV/Excel

O sistema espera as seguintes colunas (com nomes flexíveis):

- **Código do Item**: `Nº do item`, `codigo`, `codigo_item`
- **Nome do Item**: `Descrição do item`, `nome`, `descricao`, `nome_item`
- **Unidade de Medida**: `Unidade de medida de compra`, `unidade`, `unidade_medida`
- **Grupo de Itens**: `Grupo de itens`, `grupo`, `grupo_itens`

### 5. Como Usar

1. Acesse a página "Importar Excel" no sistema
2. Faça upload do arquivo CSV ou Excel
3. O sistema automaticamente compara com o banco
4. Veja os itens novos identificados
5. Clique em "Inserir Item(ns) no Banco" para cadastrar

## Notas Importantes

- A comparação é feita pelo **código do item**
- Itens com código duplicado no CSV serão tratados como um único item
- Apenas itens com código e nome válidos serão inseridos
- O sistema não atualiza itens existentes, apenas insere novos
