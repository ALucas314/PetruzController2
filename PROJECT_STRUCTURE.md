# 📁 Estrutura do Projeto

## 🎯 Visão Geral

```
scope-evolve-panel-main/
├── 📂 src/                    # Frontend (React + TypeScript)
│   ├── components/            # Componentes React
│   │   ├── dashboard/         # Componentes do dashboard
│   │   └── ui/                # Componentes UI (shadcn/ui)
│   ├── contexts/              # Contextos React
│   ├── data/                  # Arquivos de dados estáticos
│   ├── hooks/                 # Custom hooks
│   ├── lib/                   # Utilitários e bibliotecas
│   ├── pages/                 # Páginas da aplicação
│   ├── services/              # Serviços e APIs
│   ├── types/                 # Definições de tipos TypeScript
│   └── utils/                 # Funções utilitárias
│
├── 📂 server/                 # Backend (Node.js + Express)
│   ├── config/                # Configurações
│   │   ├── database.js        # Config do banco (legado)
│   │   └── supabase.js        # Config do Supabase
│   ├── docs/                  # 📚 Documentação
│   ├── routes/                # Rotas da API
│   │   ├── excelRoutes.js     # Rotas de Excel/CSV
│   │   ├── queryRoutes.js    # Rotas de queries SQL
│   │   └── supabaseRoutes.js # Rotas do Supabase
│   ├── scripts/               # 📜 Scripts SQL
│   ├── services/              # Serviços do backend
│   └── index.js               # Entry point do servidor
│
├── 📂 public/                 # Arquivos públicos estáticos
└── 📄 Arquivos de configuração
```

## 📂 Detalhamento das Pastas

### Frontend (`src/`)

#### `components/`
- **AppLayout.tsx** - Layout principal da aplicação
- **AppSidebar.tsx** - Sidebar de navegação
- **dashboard/** - Componentes específicos do dashboard
- **ui/** - Componentes UI reutilizáveis (shadcn/ui)

#### `pages/`
- **Index.tsx** - Dashboard principal
- **Producao.tsx** - Página de produção
- **Itens.tsx** - Página de itens
- **ImportarExcel.tsx** - Página de importação
- **LandingPage.tsx** - Landing page
- Outras páginas...

#### `services/`
- **api/** - Cliente e configuração da API
- **databaseService.ts** - Serviço de banco (legado)
- **examples/** - Exemplos de uso

#### `types/`
- Definições de tipos TypeScript compartilhados

#### `utils/`
- **csvReader.ts** - Parser de CSV

### Backend (`server/`)

#### `config/`
- **supabase.js** - Configuração do Supabase
- **database.js** - Configuração do banco (legado)

#### `routes/`
- **excelRoutes.js** - Upload e processamento de Excel/CSV
- **queryRoutes.js** - Execução de queries SQL
- **supabaseRoutes.js** - Operações com Supabase

#### `docs/`
- Toda a documentação do servidor
- Guias de configuração
- Troubleshooting

#### `scripts/`
- Scripts SQL para criação de tabelas
- Scripts de migração

## 🔧 Arquivos de Configuração

### Frontend
- **package.json** - Dependências do frontend
- **vite.config.ts** - Configuração do Vite
- **tsconfig.json** - Configuração TypeScript
- **tailwind.config.ts** - Configuração Tailwind CSS

### Backend
- **server/package.json** - Dependências do backend
- **server/.env** - Variáveis de ambiente (não versionado)

## 📝 Convenções

### Nomenclatura
- **Componentes**: PascalCase (ex: `AppLayout.tsx`)
- **Hooks**: camelCase com prefixo `use` (ex: `useToast.ts`)
- **Utilitários**: camelCase (ex: `csvReader.ts`)
- **Tipos**: PascalCase (ex: `ProductionItem`)

### Organização
- Cada página tem sua própria pasta quando necessário
- Componentes reutilizáveis em `components/ui/`
- Serviços compartilhados em `services/`
- Tipos compartilhados em `types/`

## 🚀 Comandos Úteis

```bash
# Frontend
npm run dev          # Iniciar servidor de desenvolvimento
npm run build        # Build de produção

# Backend
cd server
npm run dev          # Iniciar servidor backend
npm start            # Iniciar em produção
```

## 📦 Dependências Principais

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Recharts

### Backend
- Express.js
- Supabase Client
- Multer (upload de arquivos)
- XLSX (processamento Excel)
