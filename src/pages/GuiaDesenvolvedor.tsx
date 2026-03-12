import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { BookOpen, ChevronDown, ChevronRight, Database, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Dados das tabelas (abreviação, significado, descrição, campos, relacionamentos)
// ============================================================================

interface Campo {
  nome: string;
  tipo?: string;
  descricao: string;
}

interface Relacao {
  tabela: string;
  descricao: string;
}

interface TabelaInfo {
  abreviacao: string;
  significado: string;
  descricao: string;
  campos: Campo[];
  relacionamentos: Relacao[];
}

const tabelas: TabelaInfo[] = [
  {
    abreviacao: "OCPD",
    significado: "Objeto de Cadastro de Programação Diária",
    descricao: "Registra a produção diária por data e filial: itens (OP, código, descrição, linha), quantidades planejada/realizada, reprocessos e totais. Tabela principal da tela Produção e dos relatórios.",
    campos: [
      { nome: "id", tipo: "BIGSERIAL", descricao: "ID interno (PK)" },
      { nome: "line_id", tipo: "BIGINT", descricao: "ID da linha de produção (referência OCLP)" },
      { nome: "data_dia", tipo: "DATE", descricao: "Data do dia de produção" },
      { nome: "data_cabecalho", tipo: "DATE", descricao: "Data do cabeçalho do planejamento" },
      { nome: "hora_cabecalho", tipo: "TIME", descricao: "Hora do cabeçalho" },
      { nome: "op", tipo: "VARCHAR(50)", descricao: "Ordem de Produção" },
      { nome: "codigo_item", tipo: "VARCHAR(100)", descricao: "Código do item" },
      { nome: "descricao_item", tipo: "TEXT", descricao: "Descrição do item" },
      { nome: "linha", tipo: "VARCHAR(100)", descricao: "Linha (nome/código)" },
      { nome: "qtd_planejada", tipo: "NUMERIC(15,2)", descricao: "Quantidade planejada" },
      { nome: "qtd_realizada", tipo: "NUMERIC(15,2)", descricao: "Quantidade realizada" },
      { nome: "diferenca", tipo: "NUMERIC(15,2)", descricao: "Diferença (planejada - realizada)" },
      { nome: "calculo_1_horas", tipo: "NUMERIC(10,2)", descricao: "Cálculo 1 em horas" },
      { nome: "restante_horas", tipo: "VARCHAR(50)", descricao: "Restante de horas" },
      { nome: "hora_final", tipo: "TIMESTAMPTZ", descricao: "Hora final estimada" },
      { nome: "observacao", tipo: "TEXT", descricao: "Observação" },
      { nome: "total_qtd_planejada", tipo: "NUMERIC(15,2)", descricao: "Total quantidade planejada do dia" },
      { nome: "total_qtd_realizada", tipo: "NUMERIC(15,2)", descricao: "Total quantidade realizada do dia" },
      { nome: "percentual_meta", tipo: "NUMERIC(5,2)", descricao: "Percentual da meta (0–100)" },
      { nome: "doc_id", tipo: "TEXT", descricao: "ID do documento (UUID). Null = documento legado." },
      { nome: "filial_nome", tipo: "VARCHAR(255)", descricao: "Nome da filial" },
      { nome: "reprocessos", tipo: "JSONB", descricao: "Array de reprocessos (cortado/usado)" },
      { nome: "estim_latas_previstas", tipo: "NUMERIC(15,2)", descricao: "Estimativa de latas previstas" },
      { nome: "estim_latas_realizadas", tipo: "NUMERIC(15,2)", descricao: "Estimativa de latas realizadas" },
      { nome: "latas_ja_batidas", tipo: "NUMERIC(15,2)", descricao: "Latas já batidas" },
      { nome: "total_ja_cortado", tipo: "NUMERIC(15,2)", descricao: "Total já cortado" },
      { nome: "created_at", tipo: "TIMESTAMPTZ", descricao: "Data de criação" },
      { nome: "updated_at", tipo: "TIMESTAMPTZ", descricao: "Data de atualização" },
    ],
    relacionamentos: [
      { tabela: "OCLP", descricao: "line_id referencia linha de produção" },
      { tabela: "OCTI", descricao: "codigo_item/descricao_item relacionados a itens" },
      { tabela: "OCTF", descricao: "filial_nome relacionado à filial" },
    ],
  },
  {
    abreviacao: "OCLP",
    significado: "Objeto de Cadastro de Linhas de Produção",
    descricao: "Cadastro de linhas de produção. Usada na tela Cadastro de Linhas, nos selects de linha na Produção e em filtros.",
    campos: [
      { nome: "id", tipo: "BIGSERIAL", descricao: "ID interno (PK)" },
      { nome: "line_id", tipo: "BIGINT", descricao: "ID numérico interno (opcional)" },
      { nome: "Code", tipo: "VARCHAR(20)", descricao: "Código da linha (ex: L01, L02)" },
      { nome: "Name", tipo: "VARCHAR(100)", descricao: "Nome/descrição da linha" },
      { nome: "created_at", tipo: "TIMESTAMPTZ", descricao: "Data de criação" },
      { nome: "updated_at", tipo: "TIMESTAMPTZ", descricao: "Data de atualização" },
    ],
    relacionamentos: [
      { tabela: "OCPD", descricao: "OCPD.line_id referencia OCLP.id" },
    ],
  },
  {
    abreviacao: "OCTI",
    significado: "Objeto de Cadastro de Tabela de Itens",
    descricao: "Cadastro de itens/produtos. Usada na tela Itens, na Produção (busca por código) e na Importar Excel.",
    campos: [
      { nome: "id", tipo: "BIGSERIAL", descricao: "ID interno (PK)" },
      { nome: "line_id", tipo: "BIGINT", descricao: "ID da linha (referência OCLP, se usado)" },
      { nome: "Code", tipo: "VARCHAR(50)", descricao: "Código do item" },
      { nome: "Name", tipo: "TEXT", descricao: "Descrição do item" },
      { nome: "U_Uom", tipo: "VARCHAR(20)", descricao: "Unidade de medida" },
      { nome: "U_ItemGroup", tipo: "VARCHAR(100)", descricao: "Grupo de itens" },
      { nome: "created_at", tipo: "TIMESTAMPTZ", descricao: "Data de criação" },
      { nome: "updated_at", tipo: "TIMESTAMPTZ", descricao: "Data de atualização" },
    ],
    relacionamentos: [
      { tabela: "OCPD", descricao: "OCPD.codigo_item / descricao_item referenciam itens" },
      { tabela: "OCLP", descricao: "line_id opcional para OCLP" },
    ],
  },
  {
    abreviacao: "OCTF",
    significado: "Objeto de Cadastro da Tabela de Filiais",
    descricao: "Cadastro de filiais. Usada no Dashboard (filtro), na Produção (seleção de filial) e em relatórios.",
    campos: [
      { nome: "id", tipo: "SERIAL", descricao: "ID interno (PK)" },
      { nome: "line_id", tipo: "INTEGER", descricao: "ID da linha (compatibilidade SAP)" },
      { nome: "Code", tipo: "VARCHAR(50)", descricao: "Código da filial" },
      { nome: "Name", tipo: "VARCHAR(255)", descricao: "Nome da filial" },
      { nome: "Address", tipo: "TEXT", descricao: "Endereço" },
      { nome: "created_at", tipo: "TIMESTAMPTZ", descricao: "Data de criação" },
      { nome: "updated_at", tipo: "TIMESTAMPTZ", descricao: "Data de atualização" },
    ],
    relacionamentos: [
      { tabela: "OCPD", descricao: "OCPD.filial_nome relacionado ao nome da filial" },
    ],
  },
  {
    abreviacao: "OCTU",
    significado: "Objeto de Cadastro de Usuários",
    descricao: "Lista de usuários do sistema. O login é feito pelo Supabase Auth (auth.users). A OCTU pode ser espelho para relatórios ou cadastro interno.",
    campos: [
      { nome: "id", tipo: "BIGSERIAL", descricao: "ID único (PK)" },
      { nome: "email", tipo: "VARCHAR(255)", descricao: "E-mail (único, login)" },
      { nome: "password_hash", tipo: "TEXT", descricao: "Senha hasheada (legado)" },
      { nome: "nome", tipo: "VARCHAR(255)", descricao: "Nome do usuário" },
      { nome: "ativo", tipo: "BOOLEAN", descricao: "Se o usuário está ativo" },
      { nome: "created_at", tipo: "TIMESTAMPTZ", descricao: "Data de criação" },
      { nome: "updated_at", tipo: "TIMESTAMPTZ", descricao: "Data de atualização" },
    ],
    relacionamentos: [
      { tabela: "OCTU_DRAFT", descricao: "OCTU_DRAFT.user_id referencia OCTU.id" },
    ],
  },
  {
    abreviacao: "OCTP",
    significado: "Objeto de Cadastro de [registros] (problemas e ações)",
    descricao: "Registros de acompanhamento: problema, ação, responsável, hora e descrição do status.",
    campos: [
      { nome: "id", tipo: "BIGSERIAL", descricao: "ID interno (PK)" },
      { nome: "numero", tipo: "INTEGER", descricao: "Número da linha (ordem)" },
      { nome: "problema", tipo: "TEXT", descricao: "Problema" },
      { nome: "acao", tipo: "TEXT", descricao: "Ação" },
      { nome: "responsavel", tipo: "VARCHAR(255)", descricao: "Responsável" },
      { nome: "hora", tipo: "TIMESTAMPTZ", descricao: "Hora (automática)" },
      { nome: "inicio", tipo: "DATE", descricao: "Data do dia (início)" },
      { nome: "descricao_status", tipo: "TEXT", descricao: "Descrição do status" },
      { nome: "created_at", tipo: "TIMESTAMPTZ", descricao: "Data de criação" },
      { nome: "updated_at", tipo: "TIMESTAMPTZ", descricao: "Data de atualização" },
    ],
    relacionamentos: [],
  },
  {
    abreviacao: "OCTU_DRAFT_AUTH",
    significado: "Rascunho por usuário (Supabase Auth)",
    descricao: "Guarda o rascunho da tela Produção (e outras) por usuário logado (auth.users). Ao voltar sem ter salvo, o app restaura o estado.",
    campos: [
      { nome: "id", tipo: "BIGSERIAL", descricao: "ID interno (PK)" },
      { nome: "auth_user_id", tipo: "UUID", descricao: "UUID do usuário no Supabase Auth" },
      { nome: "screen", tipo: "VARCHAR(100)", descricao: "Tela (ex: producao)" },
      { nome: "data", tipo: "JSONB", descricao: "Estado da tela em JSON" },
      { nome: "updated_at", tipo: "TIMESTAMPTZ", descricao: "Última atualização" },
    ],
    relacionamentos: [
      { tabela: "auth.users", descricao: "auth_user_id referencia Supabase Auth" },
    ],
  },
  {
    abreviacao: "OCTU_DRAFT",
    significado: "Rascunho por usuário (legado)",
    descricao: "Rascunho por usuário OCTU. Hoje o app usa OCTU_DRAFT_AUTH (Supabase Auth). Mantida por compatibilidade.",
    campos: [
      { nome: "id", tipo: "BIGSERIAL", descricao: "ID interno (PK)" },
      { nome: "user_id", tipo: "BIGINT", descricao: "ID do usuário na OCTU (FK)" },
      { nome: "screen", tipo: "VARCHAR(100)", descricao: "Tela (ex: producao)" },
      { nome: "data", tipo: "JSONB", descricao: "Estado em JSON" },
      { nome: "updated_at", tipo: "TIMESTAMPTZ", descricao: "Última atualização" },
    ],
    relacionamentos: [
      { tabela: "OCTU", descricao: "user_id REFERENCES OCTU(id)" },
    ],
  },
  {
    abreviacao: "OCTU_RESET",
    significado: "Tokens de redefinição de senha (legado)",
    descricao: "Era usada no fluxo Esqueci a senha com OCTU. Hoje o fluxo é feito pelo Supabase (e-mail + link).",
    campos: [
      { nome: "user_id", tipo: "BIGINT", descricao: "ID do usuário na OCTU" },
      { nome: "token_hash", tipo: "TEXT", descricao: "Hash do token de redefinição" },
      { nome: "expires_at", tipo: "TIMESTAMPTZ", descricao: "Data de expiração" },
    ],
    relacionamentos: [
      { tabela: "OCTU", descricao: "user_id relacionado a OCTU" },
    ],
  },
];

// ============================================================================
// Componente de card expansível por tabela
// ============================================================================

function TabelaCard({ tabela, isOpen, onToggle }: { tabela: TabelaInfo; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20">
          <Database className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-foreground">{tabela.abreviacao}</span>
            <span className="text-muted-foreground text-sm font-medium">—</span>
            <span className="text-sm text-muted-foreground">{tabela.significado}</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{tabela.descricao}</p>
        </div>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border/50 bg-muted/20 p-4 sm:p-6 space-y-6">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Campos</h4>
            <div className="rounded-xl border border-border/50 bg-background/80 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/50">
                    <th className="text-left py-2.5 px-3 font-semibold text-foreground">Campo</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-foreground hidden sm:table-cell">Tipo</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-foreground">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {tabela.campos.map((c) => (
                    <tr key={c.nome} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono text-primary font-medium">{c.nome}</td>
                      <td className="py-2 px-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{c.tipo ?? "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {tabela.relacionamentos.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5" />
                Relacionamentos
              </h4>
              <ul className="space-y-2">
                {tabela.relacionamentos.map((r) => (
                  <li
                    key={`${r.tabela}-${r.descricao}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-background/80 border border-border/40 px-3 py-2 text-sm"
                  >
                    <span className="font-mono font-semibold text-primary">{r.tabela}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{r.descricao}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Página
// ============================================================================

export default function GuiaDesenvolvedor() {
  const [openAbbrevs, setOpenAbbrevs] = useState<Set<string>>(new Set(["OCPD"]));

  const toggle = (abbrev: string) => {
    setOpenAbbrevs((prev) => {
      const next = new Set(prev);
      if (next.has(abbrev)) next.delete(abbrev);
      else next.add(abbrev);
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <div className="relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/98 p-5 sm:p-6 lg:p-8 shadow-sm overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 rounded-t-2xl" />
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 border border-primary/25 text-primary">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Guia do Desenvolvedor</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Abreviações das tabelas do banco, significado, campos e relacionamentos.
              </p>
            </div>
          </div>
        </div>

        {/* Resumo de relacionamentos (diagrama em texto) */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
          <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Visão geral das relações
          </h2>
          <div className="text-sm text-muted-foreground space-y-2 font-mono bg-muted/30 rounded-xl p-4 overflow-x-auto">
            <p>OCPD ── line_id ──► OCLP</p>
            <p>OCPD ── codigo_item / filial_nome ──► OCTI, OCTF</p>
            <p>OCTU_DRAFT ── user_id ──► OCTU</p>
            <p>OCTU_DRAFT_AUTH ── auth_user_id ──► auth.users (Supabase)</p>
          </div>
        </div>

        {/* Lista de tabelas */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-base font-bold text-foreground">Tabelas do schema public</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpenAbbrevs(new Set(tabelas.map((t) => t.abreviacao)))}
                className="text-xs font-medium text-primary hover:underline"
              >
                Expandir todos
              </button>
              <span className="text-muted-foreground/60">·</span>
              <button
                type="button"
                onClick={() => setOpenAbbrevs(new Set())}
                className="text-xs font-medium text-muted-foreground hover:underline"
              >
                Recolher todos
              </button>
            </div>
          </div>
          {tabelas.map((t) => (
            <TabelaCard
              key={t.abreviacao}
              tabela={t}
              isOpen={openAbbrevs.has(t.abreviacao)}
              onToggle={() => toggle(t.abreviacao)}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
