# 🚀 ERP Controller Petruz - Sistema de Controle ERP

Sistema ERP moderno e completo desenvolvido com React, TypeScript e Vite, focado em controle de produção, análise financeira e gestão de operações.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.4.19-646CFF?logo=vite)

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Como Usar](#-como-usar)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Recursos Principais](#-recursos-principais)
- [Desenvolvimento](#-desenvolvimento)
- [Build para Produção](#-build-para-produção)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

## 🎯 Sobre o Projeto

O **ERP Controller Petruz** é uma solução ERP completa desenvolvida para empresas que precisam de controle eficiente de produção, análise financeira em tempo real e gestão de operações. O sistema oferece uma interface moderna, responsiva e intuitiva, com dashboards interativos e ferramentas avançadas de análise.

### Principais Características

- ✅ **Interface Moderna**: Design elegante com glassmorphism e animações suaves
- ✅ **Totalmente Responsivo**: Funciona perfeitamente em desktop, tablet e mobile
- ✅ **Tempo Real**: Atualizações automáticas de dados e relógio em tempo real
- ✅ **Gráficos Profissionais**: Visualizações interativas com Recharts
- ✅ **Cálculos Automáticos**: Sistema inteligente de cálculos em produção
- ✅ **Sidebar Colapsável**: Navegação otimizada com sidebar adaptável

## ✨ Funcionalidades

### 📊 Dashboard

- **KPIs Principais**: Cards com métricas importantes (Receita, Produção, Pedidos, etc.)
- **Gráfico de Receita vs Despesas**: Análise financeira com gráfico de área
- **Gráfico de Produção**: Comparação entre meta e realizado por linha de produção
- **Status dos Pedidos**: Visualização em donut chart com detalhes completos
- **Filtros Dinâmicos**: Filtragem por período e categoria

### 🏭 Módulo de Produção

#### Tabela de Produção
- **Gestão de Linhas**: Adicionar, editar e remover linhas de produção
- **Campos Principais**:
  - Número sequencial automático
  - Ordem de Produção (OP)
  - Código e Descrição do Item
  - Linha de Produção
  - Quantidade Planejada (KG)
  - Quantidade Realizada (KG)
  - **Diferença (KG)**: Cálculo automático (Planejada - Realizada)

#### Controle de Tempo
- **Hora Atual**: Relógio em tempo real (HH:MM:SS)
- **Calculo 1 Horas**: Campo manual com calculadora integrada
- **Restante de Horas**: Cálculo automático baseado em:
  ```
  Restante = (Soma das Diferenças) ÷ Calculo 1 Horas
  ```
- **Hora Final**: Cálculo automático em tempo real
  ```
  Hora Final = Hora Atual + Restante de Horas
  ```

#### Calculadora Integrada
- Interface moderna e intuitiva
- Operações básicas: +, -, ×, ÷
- Suporte a números decimais (vírgula)
- Botão de backspace estilizado
- Resultado aplicável diretamente ao campo "Calculo 1 Horas"

#### Controle de Latas
- Estimativa de Latas de Açaí Prevista
- Estimativa de Latas de Açaí Realizadas
- Latas já Batidas
- Total de Reprocesso Usado
- Total Cortado

#### Observações
- Campo de texto livre para anotações e observações

### 🎨 Interface

- **Sidebar Responsiva**: 
  - Colapsável em desktop
  - Menu hambúrguer em mobile/tablet
  - Animações suaves e sincronizadas
  - Tooltips quando colapsado
- **Tema Moderno**: 
  - Glassmorphism effects
  - Gradientes suaves
  - Sombras e bordas elegantes
  - Transições fluidas

## 🛠 Tecnologias Utilizadas

### Core
- **React 18.3.1**: Biblioteca JavaScript para construção de interfaces
- **TypeScript 5.8.3**: Superset do JavaScript com tipagem estática
- **Vite 5.4.19**: Build tool rápida e moderna

### UI/UX
- **Tailwind CSS 3.4.17**: Framework CSS utility-first
- **Shadcn UI**: Componentes UI acessíveis e customizáveis
- **Radix UI**: Componentes primitivos acessíveis
- **Lucide React**: Ícones modernos e consistentes
- **Recharts 2.15.4**: Biblioteca de gráficos para React

### Roteamento e Estado
- **React Router DOM 6.30.1**: Roteamento client-side
- **TanStack Query 5.83.0**: Gerenciamento de estado servidor
- **React Context API**: Gerenciamento de estado global

### Outras Bibliotecas
- **Sonner**: Sistema de notificações toast
- **date-fns**: Manipulação de datas
- **Zod**: Validação de schemas

## 📦 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn** ou **pnpm** (gerenciador de pacotes)
- **Git** (para clonar o repositório)

## 🚀 Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/ALucas314/ERP-Controler-Petruz.git
   cd ERP-Controler-Petruz
   ```

2. **Instale as dependências**
   ```bash
   npm install
   # ou
   yarn install
   # ou
   pnpm install
   ```

3. **Inicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   # ou
   yarn dev
   # ou
   pnpm dev
   ```

4. **Acesse a aplicação**
   - Abra seu navegador em: `http://localhost:5173`

## 💻 Como Usar

### Dashboard

1. Acesse a página inicial (Dashboard)
2. Visualize os KPIs principais no topo
3. Analise os gráficos interativos:
   - Passe o mouse sobre os gráficos para ver detalhes
   - Use os filtros para ajustar o período
4. Explore os diferentes módulos através da sidebar

### Módulo de Produção

1. **Expandir o Card**: Clique no card "Análise de Produção" para expandir
2. **Adicionar Linha**: Clique no botão "Adicionar Linha" para criar uma nova linha
3. **Preencher Dados**: 
   - Preencha OP, Código, Descrição, Linha
   - Informe Quantidade Planejada e Realizada
   - A diferença será calculada automaticamente
4. **Usar Calculadora**:
   - Clique no ícone da calculadora ao lado de "Calculo 1 Horas"
   - Realize seus cálculos
   - Clique em "Usar Resultado" para aplicar
5. **Monitorar Tempo**:
   - A Hora Atual atualiza automaticamente
   - O Restante de Horas é calculado automaticamente
   - A Hora Final é atualizada em tempo real

### Navegação

- **Desktop**: Use a sidebar lateral para navegar entre módulos
- **Mobile/Tablet**: Use o menu hambúrguer no canto superior esquerdo
- **Colapsar Sidebar**: Clique no botão de seta na parte inferior da sidebar (desktop)

## 📁 Estrutura do Projeto

```
ERP-Controler-Petruz/
├── public/                 # Arquivos estáticos
│   ├── favicon.svg        # Favicon do site
│   └── robots.txt         # Configuração para bots
├── src/
│   ├── components/        # Componentes React
│   │   ├── dashboard/    # Componentes do dashboard
│   │   │   ├── Charts.tsx           # Gráficos principais
│   │   │   ├── KpiCard.tsx          # Cards de KPI
│   │   │   └── DashboardFilters.tsx # Filtros do dashboard
│   │   ├── ui/           # Componentes UI (Shadcn)
│   │   └── AppSidebar.tsx # Sidebar principal
│   ├── contexts/         # Contextos React
│   │   └── SidebarContext.tsx # Contexto da sidebar
│   ├── hooks/            # Custom hooks
│   │   ├── use-mobile.tsx # Hook para detectar mobile
│   │   └── use-toast.ts  # Hook para notificações
│   ├── pages/            # Páginas da aplicação
│   │   ├── Index.tsx      # Dashboard principal
│   │   ├── Producao.tsx   # Módulo de produção
│   │   └── NotFound.tsx  # Página 404
│   ├── lib/              # Utilitários
│   │   └── utils.ts      # Funções auxiliares
│   ├── App.tsx           # Componente raiz
│   ├── main.tsx          # Entry point
│   └── index.css         # Estilos globais
├── package.json          # Dependências e scripts
├── tsconfig.json         # Configuração TypeScript
├── vite.config.ts       # Configuração Vite
└── tailwind.config.ts   # Configuração Tailwind
```

## 🎯 Recursos Principais

### Cálculos Automáticos

O sistema realiza cálculos automáticos em tempo real:

1. **Diferença (KG)**: `Quantidade Planejada - Quantidade Realizada`
2. **Restante de Horas**: `(Soma das Diferenças) ÷ Calculo 1 Horas`
3. **Hora Final**: `Hora Atual + Restante de Horas`

### Gráficos Interativos

- **Tooltips personalizados**: Informações detalhadas ao passar o mouse
- **Animações suaves**: Transições elegantes ao carregar dados
- **Gradientes**: Visualização moderna com gradientes e sombras
- **Responsivos**: Adaptam-se a qualquer tamanho de tela

### Performance

- **Code Splitting**: Carregamento otimizado de componentes
- **Memoização**: Componentes memoizados para melhor performance
- **Lazy Loading**: Carregamento sob demanda
- **Otimizações CSS**: Transições específicas e `will-change` para GPU

## 🔧 Desenvolvimento

### Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento

# Build
npm run build        # Build para produção
npm run build:dev    # Build em modo desenvolvimento

# Testes
npm run test         # Executa testes
npm run test:watch   # Executa testes em modo watch

# Linting
npm run lint         # Verifica código com ESLint

# Preview
npm run preview      # Preview do build de produção
```

### Estrutura de Componentes

Os componentes seguem as melhores práticas do React:

- **Functional Components**: Uso de hooks modernos
- **TypeScript**: Tipagem completa para segurança de tipos
- **Memoização**: Uso de `memo`, `useMemo`, `useCallback` quando necessário
- **Custom Hooks**: Lógica reutilizável extraída para hooks

## 📦 Build para Produção

Para criar uma build otimizada para produção:

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`. Você pode servir esses arquivos com qualquer servidor estático.

Para preview da build:

```bash
npm run preview
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Siga estes passos:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Código

- Use TypeScript para todos os arquivos
- Siga as convenções do ESLint
- Adicione comentários em funções complexas
- Mantenha componentes pequenos e focados
- Use nomes descritivos para variáveis e funções

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👨‍💻 Autor

**ALucas314**

- GitHub: [@ALucas314](https://github.com/ALucas314)
- Repositório: [ERP-Controler-Petruz](https://github.com/ALucas314/ERP-Controler-Petruz)

## 🙏 Agradecimentos

- [Shadcn UI](https://ui.shadcn.com/) pelos componentes incríveis
- [Radix UI](https://www.radix-ui.com/) pelos primitivos acessíveis
- [Recharts](https://recharts.org/) pela biblioteca de gráficos
- Comunidade React pelo suporte contínuo

---

⭐ Se este projeto foi útil para você, considere dar uma estrela no repositório!
