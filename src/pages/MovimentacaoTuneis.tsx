import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, ArrowLeft, ArrowLeftRight, ArrowRight, Factory, FilePlus, Loader2, Plus, Save, Sparkles, Trash2, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDocumentNav } from "@/contexts/DocumentNavContext";
import {
  createMovimentacaoTunel,
  deleteMovimentacaoTunel,
  getFiliais,
  getMovimentacoesTuneis,
  getTiposProduto,
  getTuneis,
  parseBrazilNumber,
  updateMovimentacaoTunel,
  type CDTPRow,
  type OCMTRow,
  type OCTTRow,
} from "@/services/supabaseData";

type FilialOption = { id: number; codigo: string; nome: string; endereco: string };

type FormState = {
  id: number | null;
  docEntryPreview: string;
  docNumPreview: string;
  filialNome: string;
  codigoTunel: string;
  codigoTipoProduto: string;
  qtdInserida: string;
  dataAbertura: string;
  horaAbertura: string;
  dataFechamento: string;
  horaFechamento: string;
};

type MovRow = {
  rowId: number;
  codigoTipoProduto: string;
  qtdInserida: string;
  dataAbertura: string;
  horaAbertura: string;
  dataFechamento: string;
  horaFechamento: string;
  observacao: string;
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function emptyForm(): FormState {
  return {
    id: null,
    docEntryPreview: "Automatico",
    docNumPreview: "Automatico",
    filialNome: "",
    codigoTunel: "",
    codigoTipoProduto: "",
    qtdInserida: "",
    dataAbertura: todayStr(),
    horaAbertura: "",
    dataFechamento: "",
    horaFechamento: "",
  };
}

function createMovRow(): MovRow {
  return {
    rowId: Date.now() + Math.floor(Math.random() * 1000),
    codigoTipoProduto: "",
    qtdInserida: "",
    dataAbertura: todayStr(),
    horaAbertura: "",
    dataFechamento: "",
    horaFechamento: "",
    observacao: "",
  };
}

function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function round2(n: number): number {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function toDateTime(dateIso: string | null, timeRaw: string | null): Date | null {
  if (!dateIso) return null;
  const day = String(dateIso).split("T")[0];
  if (!day) return null;
  const t = String(timeRaw || "").trim();
  const hm = t ? t.slice(0, 5) : "00:00";
  const iso = `${day}T${/^\d{2}:\d{2}$/.test(hm) ? hm : "00:00"}:00`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatHora(timeRaw: string | null): string {
  const t = String(timeRaw || "").trim();
  if (!t) return "";
  return t.slice(0, 5);
}

function formatDate(dateIso: string | null): string {
  if (!dateIso) return "";
  const base = String(dateIso).split("T")[0];
  const [y, m, d] = base.split("-");
  if (!y || !m || !d) return base;
  return `${d}/${m}/${y}`;
}

function formatDateTime(date: Date | null): string {
  if (!date) return "";
  const d = date.toLocaleDateString("pt-BR");
  const h = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${d} ${h}`;
}

function fmtHHMMFromHours(hoursRaw: number): string {
  const totalMinutes = Math.max(0, Math.trunc(hoursRaw * 60));
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function minutesDiff(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function fmtDateLabel(dateIso: string | null): string {
  if (!dateIso) return "Sem data";
  const parts = String(dateIso).split("T")[0].split("-");
  if (parts.length !== 3) return String(dateIso);
  const [y, m, d] = parts.map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function padDoc(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "Automatico";
  return String(Math.trunc(n)).padStart(4, "0");
}

function normalizeCodigoDocumento(value: string | number): number {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
}

function formatHoraFechamentoInput(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  const hh = digits.slice(0, 2);
  const mm = digits.slice(2);
  return `${hh}:${mm}`;
}

function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  const msg = error instanceof Error ? error.message : fallback;
  const normalized = String(msg || "").toLowerCase();
  if (
    normalized.includes("42501") ||
    normalized.includes("403") ||
    normalized.includes("forbidden") ||
    normalized.includes("sem permissão")
  ) {
    return "Você não tem permissão para esta ação. Verifique as políticas de acesso (RLS) no Supabase.";
  }
  return msg || fallback;
}

export default function MovimentacaoTuneis() {
  const { toast } = useToast();
  const { setDocumentNav } = useDocumentNav();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<OCMTRow[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [tuneis, setTuneis] = useState<OCTTRow[]>([]);
  const [tiposProduto, setTiposProduto] = useState<CDTPRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [movRows, setMovRows] = useState<MovRow[]>([createMovRow()]);
  const [activeTab, setActiveTab] = useState<"movimentacao" | "analise">("movimentacao");
  const [relatorioSelecionado, setRelatorioSelecionado] = useState<"nenhum" | "previsto" | "por_tunel">("nenhum");

  const [filtroFilial, setFiltroFilial] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtrosDialogOpen, setFiltrosDialogOpen] = useState(false);
  const [filtroFilialPending, setFiltroFilialPending] = useState("");
  const [filtroDataInicioPending, setFiltroDataInicioPending] = useState("");
  const [filtroDataFimPending, setFiltroDataFimPending] = useState("");

  const tuneisDaFilial = useMemo(
    () => tuneis.filter((t) => t.filial === form.filialNome).sort((a, b) => Number(a.code) - Number(b.code)),
    [tuneis, form.filialNome]
  );
  const tiposDaFilial = useMemo(
    () => tiposProduto.filter((t) => t.filial === form.filialNome).sort((a, b) => Number(a.code) - Number(b.code)),
    [tiposProduto, form.filialNome]
  );
  const tuneisByKey = useMemo(() => {
    const map = new Map<string, OCTTRow>();
    for (const t of tuneis) map.set(`${t.filial}|${String(t.code)}`, t);
    return map;
  }, [tuneis]);
  const tiposByKey = useMemo(() => {
    const map = new Map<string, CDTPRow>();
    for (const t of tiposProduto) map.set(`${t.filial}|${String(t.code)}`, t);
    return map;
  }, [tiposProduto]);
  const analysisRows = useMemo(() => {
    return rows.map((row) => {
      const tunel = tuneisByKey.get(`${row.filialNome}|${String(row.codigoTunel)}`);
      const tipo = tiposByKey.get(`${row.filialNome}|${String(row.codigoTipoProduto)}`);
      const capacidade = Number(tunel?.capacidadeMaximaTunel ?? 0);
      const quantidade = Number(row.qtdInserida ?? 0);
      const tempoMaxCongMin = Number(tipo?.tempoMaxCongelamentoMinutos ?? 0);
      const tempoMaxCongHoras = Math.floor(tempoMaxCongMin / 60);
      const fechamentoDt = toDateTime(row.dataFechamento, row.horaFechamento);
      const aberturaDt = toDateTime(row.dataAbertura, row.horaAbertura);
      const agora = new Date();

      const qtdDisponivel = Math.max(capacidade - quantidade, 0);
      const ocupacaoPct = capacidade > 0 ? (quantidade * 100) / capacidade : null;
      const ocupacaoFmt = ocupacaoPct != null ? `${Math.floor(ocupacaoPct)} %` : null;
      const statusOcupacao = ocupacaoPct != null && ocupacaoPct > 100 ? "Alagado" : "Normal";

      const diffMin = Math.abs(minutesDiff(fechamentoDt, aberturaDt));
      const diffHoras = fechamentoDt && aberturaDt ? Math.floor(diffMin / 60) : 0;
      const diffDias =
        row.dataFechamento && row.dataAbertura
          ? Math.abs(
              Math.floor(
                (new Date(`${row.dataAbertura}T00:00:00`).getTime() - new Date(`${row.dataFechamento}T00:00:00`).getTime()) /
                  (24 * 60 * 60 * 1000)
              )
            )
          : 0;

      const percentualCong = tempoMaxCongMin > 0 && fechamentoDt && aberturaDt ? `${Math.floor((diffMin * 100) / tempoMaxCongMin)} %` : "0 %";

      let statusTunel = "Fechado";
      if (aberturaDt) {
        statusTunel = "Finalizado";
      } else if (fechamentoDt && tempoMaxCongMin > 0) {
        const fechadoMin = minutesDiff(fechamentoDt, agora);
        if (fechadoMin > tempoMaxCongMin) statusTunel = "Fechado - excedeu tempo";
      }

      const ratio = capacidade > 0 ? quantidade / capacidade : 0;
      const totalHoras =
        capacidade > 0 && ratio * 100 <= 100 ? tempoMaxCongHoras : capacidade > 0 ? Math.floor(tempoMaxCongHoras * ratio) : tempoMaxCongHoras;

      const tempoAdicionalHoras =
        capacidade > 0 && ratio * 100 <= 100
          ? Math.max(Math.floor(tempoMaxCongHoras - 24), 0)
          : capacidade > 0 && tempoMaxCongHoras * ratio > 24
            ? Math.floor(tempoMaxCongHoras * ratio - 24)
            : 0;
      const tempoAdicional = fmtHHMMFromHours(tempoAdicionalHoras);

      const prevMin =
        capacidade > 0 && ratio * 100 <= 100 ? tempoMaxCongMin : capacidade > 0 ? Math.floor(tempoMaxCongMin * ratio) : tempoMaxCongMin;
      const prevOpen = fechamentoDt ? new Date(fechamentoDt.getTime() + prevMin * 60000) : null;

      return {
        row,
        tempoMaxCongHoras,
        capacidade,
        quantidade,
        qtdDisponivel,
        ocupacaoPct,
        ocupacaoFmt,
        statusOcupacao,
        diffDias,
        diffHoras,
        percentualCong,
        statusTunel,
        totalHoras,
        tempoAdicional,
        dataPrevAbertura: prevOpen ? prevOpen.toLocaleDateString("pt-BR") : "",
        horaPrevAbertura: prevOpen ? prevOpen.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
      };
    });
  }, [rows, tuneisByKey, tiposByKey]);
  const relatorioPorTunelRows = useMemo(() => {
    const tuneisFiltrados = filtroFilial
      ? tuneis.filter((t) => t.filial === filtroFilial)
      : tuneis;

    return tuneisFiltrados
      .map((tunel) => {
        const codigoTunel = Number(tunel.code || 0);
        const capacidade = Number(tunel.capacidadeMaximaTunel || 0);
        const statusOperacional = String(tunel.statusOperacional || "").trim().toUpperCase();

        const transacoesTunel = rows
          .filter((r) => r.filialNome === tunel.filial && Number(r.codigoTunel) === codigoTunel)
          .sort((a, b) => {
            const docA = Number(a.docEntry || 0);
            const docB = Number(b.docEntry || 0);
            if (docA !== docB) return docB - docA;
            return Number(b.id || 0) - Number(a.id || 0);
          });

        const ult = transacoesTunel[0] ?? null;
        const qtdUlt = ult ? Number(ult.qtdInserida || 0) : 0;
        const ocupado = ult ? ult.dataAbertura == null : false;
        const qtdPendente = round2(
          transacoesTunel.reduce((acc, r) => acc + (r.dataAbertura == null ? Number(r.qtdInserida || 0) : 0), 0)
        );
        const diffDisponivel = statusOperacional === "M" ? 0 : round2(capacidade - qtdPendente);
        const diffRealDisponivel =
          statusOperacional === "M"
            ? 0
            : round2(capacidade - Math.min(qtdPendente, capacidade));

        let statusTunel = "Nenhuma transação";
        if (statusOperacional === "M") {
          statusTunel = "Túnel em Manutenção";
        } else if (statusOperacional === "A" && ult && ocupado && qtdUlt > capacidade) {
          statusTunel = "Túnel alagado";
        } else if (statusOperacional === "A" && ult && ocupado) {
          statusTunel = "Túnel ocupado";
        } else if (statusOperacional === "A" && ult && !ocupado) {
          statusTunel = "Túnel ativo - Aberto";
        } else if (!ult) {
          statusTunel = "Nenhuma transação";
        }

        return {
          filial: tunel.filial,
          codigoTunel,
          capacidade,
          ultimaRow: ult,
          statusTunel,
          qtdPendente,
          diffDisponivel,
          diffRealDisponivel,
        };
      })
      .sort((a, b) => a.codigoTunel - b.codigoTunel);
  }, [tuneis, rows, filtroFilial]);

  const relatorioPorTunelTotals = useMemo(() => {
    return relatorioPorTunelRows.reduce(
      (acc, r) => ({
        capacidade: round2(acc.capacidade + r.capacidade),
        qtdPendente: round2(acc.qtdPendente + r.qtdPendente),
        diffDisponivel: round2(acc.diffDisponivel + r.diffDisponivel),
        diffRealDisponivel: round2(acc.diffRealDisponivel + r.diffRealDisponivel),
      }),
      { capacidade: 0, qtdPendente: 0, diffDisponivel: 0, diffRealDisponivel: 0 }
    );
  }, [relatorioPorTunelRows]);

  async function loadBase() {
    const [filiaisData, tuneisData, tiposData] = await Promise.all([getFiliais(), getTuneis(), getTiposProduto()]);
    setFiliais(filiaisData as FilialOption[]);
    setTuneis(tuneisData);
    setTiposProduto(tiposData);
  }

  async function loadRows(filters?: { filialNome?: string; dataInicio?: string; dataFim?: string }) {
    const filialNome = filters?.filialNome ?? filtroFilial;
    const dataInicio = filters?.dataInicio ?? filtroDataInicio;
    const dataFim = filters?.dataFim ?? filtroDataFim;
    const data = await getMovimentacoesTuneis({
      filialNome: filialNome || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    });
    const ordered = [...data].sort((a, b) => {
      const da = Number(a.docEntry || 0);
      const db = Number(b.docEntry || 0);
      if (da !== db) return da - db;
      return Number(a.id || 0) - Number(b.id || 0);
    });
    setRows(ordered);
    return ordered;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await loadBase();
        await loadRows();
      } catch (error: unknown) {
        if (!mounted) return;
        const msg = getFriendlyErrorMessage(error, "Falha ao carregar movimentações.");
        toast({ title: "Erro", description: msg, variant: "destructive" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function aplicarFiltros() {
    try {
      setLoading(true);
      const dataInicioNorm = filtroDataInicioPending || filtroDataFimPending || "";
      const dataFimNorm = filtroDataFimPending || filtroDataInicioPending || "";

      await loadRows({
        filialNome: filtroFilialPending,
        dataInicio: dataInicioNorm,
        dataFim: dataFimNorm,
      });
      setFiltroFilial(filtroFilialPending);
      setFiltroDataInicio(dataInicioNorm);
      setFiltroDataFim(dataFimNorm);
      setFiltrosDialogOpen(false);
      setActiveTab("analise");
      // Mantém "por túnel" ou "previsto" se o filtro foi aplicado já na aba de relatórios; só força previsto vindo da movimentação ou do menu.
      setRelatorioSelecionado((relAtual) => {
        if (activeTab === "analise" && (relAtual === "por_tunel" || relAtual === "previsto")) return relAtual;
        return "previsto";
      });
    } catch (error: unknown) {
      const msg = getFriendlyErrorMessage(error, "Falha ao filtrar.");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  /** Relatório por túnel: só filial; carrega movimentações sem intervalo de data (limite da API). */
  async function aplicarFiltrosRelatorioPorTunel() {
    try {
      setLoading(true);
      await loadRows({
        filialNome: filtroFilialPending,
        dataInicio: "",
        dataFim: "",
      });
      setFiltroFilial(filtroFilialPending);
      setFiltroDataInicio("");
      setFiltroDataFim("");
      setFiltroDataInicioPending("");
      setFiltroDataFimPending("");
      setFiltrosDialogOpen(false);
      setActiveTab("analise");
      setRelatorioSelecionado((relAtual) => {
        if (activeTab === "analise" && (relAtual === "por_tunel" || relAtual === "previsto")) return relAtual;
        return "previsto";
      });
    } catch (error: unknown) {
      const msg = getFriendlyErrorMessage(error, "Falha ao filtrar.");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function onSalvar() {
    if (!form.filialNome || !form.codigoTunel) {
      toast({
        title: "Validação",
        description: "Preencha Filial e Túnel.",
        variant: "destructive",
      });
      return;
    }
    const validRows = movRows.filter((r) => r.codigoTipoProduto || r.qtdInserida || r.dataAbertura || r.dataFechamento || r.horaAbertura || r.horaFechamento || r.observacao);
    if (validRows.length === 0) {
      toast({ title: "Validação", description: "Adicione pelo menos uma linha para salvar.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      let focoId: number | null = null;
      for (let i = 0; i < validRows.length; i++) {
        const line = validRows[i];
        if (!line.codigoTipoProduto || !line.dataAbertura) {
          throw new Error(`Linha ${i + 1}: preencha Tipo de produto e Data abertura.`);
        }
        const qtdInserida = parseBrazilNumber(line.qtdInserida || "0");
        if (qtdInserida < 0) throw new Error(`Linha ${i + 1}: quantidade inserida não pode ser negativa.`);
        const payload = {
          filial_nome: form.filialNome,
          codigo_tunel: normalizeCodigoDocumento(form.codigoTunel),
          codigo_tipo_produto: normalizeCodigoDocumento(line.codigoTipoProduto),
          qtd_inserida: qtdInserida,
          data_abertura: line.dataAbertura || null,
          hora_abertura: line.horaAbertura || null,
          data_fechamento: line.dataFechamento || null,
          hora_fechamento: line.horaFechamento || null,
          observacao: line.observacao || null,
        };
        if (form.id && i === 0) {
          const updated = await updateMovimentacaoTunel(form.id, payload);
          focoId = updated.id;
        } else {
          const created = await createMovimentacaoTunel(payload);
          focoId = created.id;
        }
      }
      toast({ title: "Sucesso", description: form.id ? "Movimentação atualizada." : "Movimentação(ões) cadastrada(s)." });
      const refreshedRows = await loadRows();
      if (focoId != null) {
        const row = refreshedRows.find((r) => r.id === focoId);
        if (row) onEditar(row);
      }
    } catch (error: unknown) {
      const msg = getFriendlyErrorMessage(error, "Erro ao salvar movimentação.");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function onEditar(row: OCMTRow) {
    setForm({
      id: row.id,
      docEntryPreview: padDoc(row.docEntry),
      docNumPreview: padDoc(row.numeroDocumento),
      filialNome: row.filialNome,
      codigoTunel: String(row.codigoTunel),
      codigoTipoProduto: String(row.codigoTipoProduto),
      qtdInserida: "",
      dataAbertura: "",
      horaAbertura: "",
      dataFechamento: "",
      horaFechamento: "",
    });
    setMovRows([
      {
        rowId: Date.now(),
        codigoTipoProduto: String(row.codigoTipoProduto),
        qtdInserida: String(row.qtdInserida ?? ""),
        dataAbertura: row.dataAbertura || "",
        horaAbertura: row.horaAbertura || "",
        dataFechamento: row.dataFechamento || "",
        horaFechamento: row.horaFechamento || "",
        observacao: row.observacao || "",
      },
    ]);
  }

  useEffect(() => {
    if (form.id) return;
    const maxDoc = rows.reduce((m, r) => Math.max(m, Number(r.docEntry || 0)), 0);
    const next = maxDoc + 1;
    setForm((p) => ({
      ...p,
      docEntryPreview: padDoc(next),
      docNumPreview: padDoc(next),
    }));
  }, [rows, form.id]);

  function onNovoDocumento() {
    setForm(emptyForm());
    setMovRows([createMovRow()]);
  }

  async function onExcluir(id: number) {
    try {
      await deleteMovimentacaoTunel(id);
      toast({ title: "Sucesso", description: "Movimentação excluída." });
      if (form.id === id) onNovoDocumento();
      await loadRows();
    } catch (error: unknown) {
      const msg = getFriendlyErrorMessage(error, "Erro ao excluir movimentação.");
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  }

  useEffect(() => {
    if (!filtrosDialogOpen) return;
    setFiltroFilialPending(filtroFilial);
    setFiltroDataInicioPending(filtroDataInicio);
    setFiltroDataFimPending(filtroDataFim);
  }, [filtrosDialogOpen, filtroFilial, filtroDataInicio, filtroDataFim]);

  useEffect(() => {
    const total = rows.length;
    const currentIndex = form.id != null ? rows.findIndex((r) => r.id === form.id) : -1;
    const hasCurrent = currentIndex >= 0;

    setDocumentNav({
      showNav: true,
      canGoPrev: total > 0 && (hasCurrent ? currentIndex > 0 : true),
      canGoNext: total > 0 && (hasCurrent ? currentIndex < total - 1 : true),
      onPrev: () => {
        if (total === 0) return;
        if (!hasCurrent) {
          onEditar(rows[total - 1]);
          return;
        }
        if (currentIndex > 0) onEditar(rows[currentIndex - 1]);
      },
      onNext: () => {
        if (total === 0) return;
        if (!hasCurrent) {
          onEditar(rows[0]);
          return;
        }
        if (currentIndex < total - 1) onEditar(rows[currentIndex + 1]);
      },
      onNewDocument: onNovoDocumento,
      navLabel: total > 0 ? `${hasCurrent ? currentIndex + 1 : 1} de ${total}` : "0 de 0",
    });

    return () => setDocumentNav(null);
  }, [rows, form.id, setDocumentNav]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="inline-flex h-12 min-h-12 items-stretch rounded-xl border border-border/60 bg-muted/40 p-1 gap-0.5 flex-shrink-0" role="tablist" aria-label="Navegação da movimentação de túneis">
            <button
              type="button"
              className={`inline-flex items-center justify-center gap-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg px-4 py-2 h-full min-h-0 text-xs sm:text-sm whitespace-nowrap ${activeTab === "movimentacao" ? "font-semibold bg-primary/10 text-primary border border-primary/25 shadow-sm hover:bg-primary/15" : "font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
              role="tab"
              aria-selected={activeTab === "movimentacao"}
              onClick={() => setActiveTab("movimentacao")}
            >
              <span>Movimentação</span>
            </button>
            <button
              type="button"
              className={`inline-flex items-center justify-center gap-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg px-4 py-2 h-full min-h-0 text-xs sm:text-sm whitespace-nowrap ${activeTab === "analise" ? "font-semibold bg-primary/10 text-primary border border-primary/25 shadow-sm hover:bg-primary/15" : "font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
              role="tab"
              aria-selected={activeTab === "analise"}
              onClick={() => {
                setActiveTab("analise");
                setRelatorioSelecionado("nenhum");
              }}
            >
              <span>Relatórios</span>
            </button>
          </div>
        </div>

        <Card
          className={
            activeTab === "movimentacao"
              ? "relative rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
              : "relative rounded-2xl border-0 bg-transparent shadow-none"
          }
        >
          {activeTab === "movimentacao" ? (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 z-0" />
          ) : null}
          <div className="relative z-10">
            {activeTab === "movimentacao" ? (
              <CardHeader className="p-6 sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border border-primary/30">
                      <ArrowLeftRight className="h-7 w-7 text-primary" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-xl sm:text-2xl font-bold">Movimentações</CardTitle>
                      <CardDescription>Controle diario de movimentações de túneis.</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:items-center">
                    <Dialog open={filtrosDialogOpen} onOpenChange={setFiltrosDialogOpen}>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-2.5 text-xs sm:text-sm font-medium border border-input bg-background hover:bg-muted/50 w-full sm:w-auto"
                          aria-label="Abrir filtros de produção"
                          aria-haspopup="dialog"
                          aria-expanded={filtrosDialogOpen}
                        >
                          <Filter className="h-4 w-4 shrink-0" />
                          <span>Filtros</span>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="w-[340px] sm:w-[420px] max-w-[95vw] p-4 rounded-lg">
                        <DialogHeader>
                          <DialogTitle className="text-base">Filtros — Movimentação de Túneis</DialogTitle>
                          <DialogDescription className="text-sm text-muted-foreground">
                            Defina os filtros e clique em Filtrar para aplicar.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 py-2">
                          <div className="space-y-1.5">
                            <Label>Filial</Label>
                            <Select value={filtroFilialPending || "__todas__"} onValueChange={(v) => setFiltroFilialPending(v === "__todas__" ? "" : v)}>
                              <SelectTrigger><SelectValue placeholder="Todas as filiais" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__todas__">Todas as filiais</SelectItem>
                                {filiais.map((f) => (
                                  <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Data inicial</Label>
                            <Input type="date" value={filtroDataInicioPending} onChange={(e) => setFiltroDataInicioPending(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Data final</Label>
                            <Input type="date" value={filtroDataFimPending} onChange={(e) => setFiltroDataFimPending(e.target.value)} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-9"
                            onClick={() => {
                              setFiltroFilialPending("");
                              setFiltroDataInicioPending("");
                              setFiltroDataFimPending("");
                            }}
                          >
                            Limpar
                          </Button>
                          <Button
                            type="button"
                            className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => void aplicarFiltros()}
                          >
                            Filtrar
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <button
                      type="button"
                      onClick={onNovoDocumento}
                      className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg shadow-sm hover:from-primary/20 hover:to-primary/10 hover:border-primary/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-primary w-full sm:w-auto"
                      title="Novo documento"
                      aria-label="Novo documento"
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      <span>Novo documento</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSalvar()}
                      disabled={saving}
                      className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-success/10 to-success/5 border border-success/30 rounded-lg shadow-sm hover:from-success/20 hover:to-success/10 hover:border-success/40 hover:shadow-md transition-all duration-300 text-sm font-semibold text-success disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                      title="Salvar no banco de dados"
                      aria-label="Salvar no banco de dados"
                    >
                      {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
                      <span>{saving ? "Salvando..." : "Salvar"}</span>
                    </button>
                  </div>
                </div>
              </CardHeader>
            ) : null}
            <CardContent className="space-y-5 border-t border-border/40 bg-gradient-to-b from-transparent via-muted/10 to-muted/20 p-4 sm:p-6">
              {activeTab === "movimentacao" ? (
                <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{form.id ? "Editando movimentação" : "Nova movimentação"}</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 justify-items-center">
                    <div className="space-y-1.5 w-full sm:w-[220px]">
                      <Label>Número de Documento</Label>
                      <Input readOnly value={form.docNumPreview} className="bg-muted font-mono tabular-nums" />
                    </div>
                    <div className="space-y-1.5 w-full sm:w-[220px]">
                      <Label>Filial</Label>
                      <Select
                        value={form.filialNome || "__placeholder_filial__"}
                        onValueChange={(v) =>
                          setForm((p) => ({
                            ...p,
                            filialNome: v === "__placeholder_filial__" ? "" : v,
                            codigoTunel: "",
                            codigoTipoProduto: "",
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione a filial" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__placeholder_filial__" disabled>Selecione a filial</SelectItem>
                          {filiais.map((f) => (
                            <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 w-full sm:w-[220px]">
                      <Label>Código do túnel utilizado</Label>
                      <Select
                        value={form.codigoTunel || "__placeholder_tunel__"}
                        onValueChange={(v) => setForm((p) => ({ ...p, codigoTunel: v === "__placeholder_tunel__" ? "" : v }))}
                        disabled={!form.filialNome}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione o tunel" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__placeholder_tunel__" disabled>Selecione o tunel</SelectItem>
                          {tuneisDaFilial.map((t) => (
                            <SelectItem key={t.id} value={String(t.code)}>
                              {String(t.code).padStart(4, "0")} - {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-card/40 overflow-x-auto">
                    <div className="p-2 sm:p-3 border-b border-border/40 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => setMovRows((prev) => [...prev, createMovRow()])}
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar linha
                      </Button>
                    </div>
                    <Table className="min-w-[64rem]">
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-bold whitespace-nowrap">Tipo de produto</TableHead>
                          <TableHead className="font-bold whitespace-nowrap">Qtd. inserida</TableHead>
                          <TableHead className="font-bold whitespace-nowrap">Data fechamento</TableHead>
                          <TableHead className="font-bold whitespace-nowrap">Hora fechamento</TableHead>
                          <TableHead className="font-bold whitespace-nowrap">Data abertura</TableHead>
                          <TableHead className="font-bold whitespace-nowrap">Hora abertura</TableHead>
                          <TableHead className="font-bold whitespace-nowrap min-w-[22rem]">Observação</TableHead>
                          <TableHead className="font-bold whitespace-nowrap text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movRows.map((row) => (
                        <TableRow key={row.rowId}>
                          <TableCell className="align-top">
                            <Select
                              value={row.codigoTipoProduto || "__placeholder_tipo__"}
                              onValueChange={(v) =>
                                setMovRows((prev) =>
                                  prev.map((r) => (r.rowId === row.rowId ? { ...r, codigoTipoProduto: v === "__placeholder_tipo__" ? "" : v } : r))
                                )
                              }
                              disabled={!form.filialNome}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__placeholder_tipo__" disabled>Selecione o tipo</SelectItem>
                                {tiposDaFilial.map((t) => (
                                  <SelectItem key={t.id} value={String(t.code)}>
                                    {String(t.code).padStart(4, "0")} - {t.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              inputMode="decimal"
                              placeholder="0,0000"
                              value={row.qtdInserida}
                              onChange={(e) =>
                                setMovRows((prev) => prev.map((r) => (r.rowId === row.rowId ? { ...r, qtdInserida: e.target.value } : r)))
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="date"
                              value={row.dataFechamento}
                              onChange={(e) =>
                                setMovRows((prev) => prev.map((r) => (r.rowId === row.rowId ? { ...r, dataFechamento: e.target.value } : r)))
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="14:10"
                              value={row.horaFechamento}
                              onChange={(e) =>
                                setMovRows((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId ? { ...r, horaFechamento: formatHoraFechamentoInput(e.target.value) } : r
                                  )
                                )
                              }
                              onBlur={() => {
                                setMovRows((prev) => prev.map((r) => {
                                  if (r.rowId !== row.rowId) return r;
                                  const v = r.horaFechamento.trim();
                                  if (!v) return r;
                                  const [hRaw, mRaw = ""] = v.split(":");
                                  const h = Math.min(23, Math.max(0, Number(hRaw || 0)));
                                  const m = Math.min(59, Math.max(0, Number(mRaw || 0)));
                                  return { ...r, horaFechamento: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
                                }));
                              }}
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="date"
                              value={row.dataAbertura}
                              onChange={(e) =>
                                setMovRows((prev) => prev.map((r) => (r.rowId === row.rowId ? { ...r, dataAbertura: e.target.value } : r)))
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="14:10"
                              value={row.horaAbertura}
                              onChange={(e) =>
                                setMovRows((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId ? { ...r, horaAbertura: formatHoraFechamentoInput(e.target.value) } : r
                                  )
                                )
                              }
                              onBlur={() => {
                                setMovRows((prev) => prev.map((r) => {
                                  if (r.rowId !== row.rowId) return r;
                                  const v = r.horaAbertura.trim();
                                  if (!v) return r;
                                  const [hRaw, mRaw = ""] = v.split(":");
                                  const h = Math.min(23, Math.max(0, Number(hRaw || 0)));
                                  const m = Math.min(59, Math.max(0, Number(mRaw || 0)));
                                  return { ...r, horaAbertura: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
                                }));
                              }}
                            />
                          </TableCell>
                          <TableCell className="align-top min-w-[22rem]">
                            <Input
                              type="text"
                              placeholder="Observação da linha"
                              className="min-w-[20rem]"
                              value={row.observacao}
                              onChange={(e) =>
                                setMovRows((prev) =>
                                  prev.map((r) => (r.rowId === row.rowId ? { ...r, observacao: e.target.value } : r))
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() =>
                                setMovRows((prev) => {
                                  if (prev.length <= 1) return [createMovRow()];
                                  return prev.filter((r) => r.rowId !== row.rowId);
                                })
                              }
                              aria-label="Excluir linha"
                              title="Excluir linha"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-3 pt-0">
                  {relatorioSelecionado === "nenhum" ? (
                    <>
                      <div className="text-center mb-3 space-y-2">
                        <div className="inline-flex items-center justify-center mb-2">
                          <div className="relative">
                            <div className="absolute inset-0 bg-primary/15 blur-lg rounded-full animate-pulse" />
                            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 via-primary/20 to-primary/10 border border-primary/30 backdrop-blur-sm">
                              <Factory className="h-6 w-6 text-primary" />
                            </div>
                          </div>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent tracking-tight">
                          Análise de Túneis
                        </h1>
                        <p className="text-sm text-muted-foreground/70 max-w-xl mx-auto">Selecione uma opção para continuar</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-5xl mx-auto w-full">
                        <button
                          type="button"
                          onClick={() => setRelatorioSelecionado("previsto")}
                          className="group/card relative rounded-2xl border border-border/50 bg-gradient-to-br from-card/95 via-card/90 to-card/85 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.2)] transition-all duration-500 overflow-hidden cursor-pointer transform hover:-translate-y-1 hover:scale-[1.01]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-primary/8 to-primary/3 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 group-hover/card:opacity-100 transition-opacity duration-500" />
                          <div className="relative z-10 p-6">
                            <div className="flex flex-col items-center text-center space-y-4">
                              <div className="relative">
                                <div className="absolute inset-0 bg-primary/15 blur-xl rounded-full scale-125 opacity-0 group-hover/card:opacity-100 group-hover/card:scale-100 transition-all duration-500" />
                                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 group-hover/card:scale-105 group-hover/card:rotate-2 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/15 via-white/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                                  <Factory className="relative h-8 w-8 text-primary group-hover/card:scale-110 transition-transform duration-500" />
                                  <Sparkles className="absolute -top-0.5 -right-0.5 h-4 w-4 text-primary/50 opacity-0 group-hover/card:opacity-100 group-hover/card:animate-spin transition-opacity duration-300" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-foreground via-foreground/95 to-foreground/90 bg-clip-text text-transparent group-hover/card:from-primary group-hover/card:via-primary/90 group-hover/card:to-primary/80 transition-all duration-500">
                                  Túneis - Relatório Previsto
                                </h2>
                                <p className="text-xs sm:text-sm text-muted-foreground/70 leading-relaxed">Previsões e status calculados.</p>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] sm:text-xs font-medium group-hover/card:bg-primary/15 group-hover/card:border-primary/35 transition-colors duration-300">
                                  <Zap className="h-2.5 w-2.5" />
                                  Ativo
                                </span>
                                <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover/card:text-primary group-hover/card:translate-x-1 transition-all duration-300" />
                              </div>
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRelatorioSelecionado("por_tunel")}
                          className="group/card relative rounded-2xl border border-border/50 bg-gradient-to-br from-card/95 via-card/90 to-card/85 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.2)] transition-all duration-500 overflow-hidden cursor-pointer transform hover:-translate-y-1 hover:scale-[1.01]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-primary/8 to-primary/3 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60 opacity-60 group-hover/card:opacity-100 transition-opacity duration-500" />
                          <div className="relative z-10 p-6">
                            <div className="flex flex-col items-center text-center space-y-4">
                              <div className="relative">
                                <div className="absolute inset-0 bg-primary/15 blur-xl rounded-full scale-125 opacity-0 group-hover/card:opacity-100 group-hover/card:scale-100 transition-all duration-500" />
                                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 group-hover/card:scale-105 group-hover/card:rotate-2 transition-all duration-500 border border-primary/30 backdrop-blur-sm">
                                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/15 via-white/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                                  <Factory className="relative h-8 w-8 text-primary group-hover/card:scale-110 transition-transform duration-500" />
                                  <Sparkles className="absolute -top-0.5 -right-0.5 h-4 w-4 text-primary/50 opacity-0 group-hover/card:opacity-100 group-hover/card:animate-spin transition-opacity duration-300" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-foreground via-foreground/95 to-foreground/90 bg-clip-text text-transparent group-hover/card:from-primary group-hover/card:via-primary/90 group-hover/card:to-primary/80 transition-all duration-500">
                                  Túneis - Relatório por Túnel
                                </h2>
                                <p className="text-xs sm:text-sm text-muted-foreground/70 leading-relaxed">Visão consolidada por túnel.</p>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[10px] sm:text-xs font-medium group-hover/card:bg-primary/15 group-hover/card:border-primary/35 transition-colors duration-300">
                                  <Zap className="h-2.5 w-2.5" />
                                  Ativo
                                </span>
                                <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover/card:text-primary group-hover/card:translate-x-1 transition-all duration-300" />
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => setRelatorioSelecionado("nenhum")}
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-accent-foreground size-11 min-h-[44px] min-w-[44px] rounded-full border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:bg-accent hover:border-primary/30 hover:shadow-md shrink-0"
                        aria-label="Voltar ao menu"
                        title="Voltar ao menu"
                      >
                        <ArrowLeft className="size-5 text-foreground shrink-0 stroke-[2.5]" />
                      </button>
                    </div>
                  )}

                  {relatorioSelecionado === "previsto" ? (
                    <Card className="group/card relative overflow-hidden border border-border/60 bg-card/60">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />
                      <CardHeader className="relative z-10 py-3 px-4 border-b border-border/40 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="inline-flex items-center gap-2.5 min-w-0">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 shrink-0">
                              <Factory className="h-4 w-4 text-primary" />
                            </span>
                            <CardTitle className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
                              Túneis - Relatório Previsto
                            </CardTitle>
                          </div>
                          <Dialog open={filtrosDialogOpen} onOpenChange={setFiltrosDialogOpen}>
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-2.5 text-xs sm:text-sm font-medium border border-input bg-background hover:bg-muted/50 shrink-0 w-full sm:w-auto"
                                aria-label="Abrir filtros do relatório"
                                aria-haspopup="dialog"
                                aria-expanded={filtrosDialogOpen}
                              >
                                <Filter className="h-4 w-4 shrink-0" />
                                <span>Filtros</span>
                              </button>
                            </DialogTrigger>
                            <DialogContent className="w-[340px] sm:w-[420px] max-w-[95vw] p-4 rounded-lg">
                              <DialogHeader>
                                <DialogTitle className="text-base">Filtros — Relatório de Túneis</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground">
                                  Defina os filtros e clique em Filtrar para aplicar.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-3 py-2">
                                <div className="space-y-1.5">
                                  <Label>Filial</Label>
                                  <Select value={filtroFilialPending || "__todas__"} onValueChange={(v) => setFiltroFilialPending(v === "__todas__" ? "" : v)}>
                                    <SelectTrigger><SelectValue placeholder="Todas as filiais" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__todas__">Todas as filiais</SelectItem>
                                      {filiais.map((f) => (
                                        <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Data inicial</Label>
                                  <Input type="date" value={filtroDataInicioPending} onChange={(e) => setFiltroDataInicioPending(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Data final</Label>
                                  <Input type="date" value={filtroDataFimPending} onChange={(e) => setFiltroDataFimPending(e.target.value)} />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="flex-1 h-9"
                                  onClick={() => {
                                    setFiltroFilialPending("");
                                    setFiltroDataInicioPending("");
                                    setFiltroDataFimPending("");
                                  }}
                                >
                                  Limpar
                                </Button>
                                <Button
                                  type="button"
                                  className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                                  onClick={() => void aplicarFiltros()}
                                >
                                  Filtrar
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-lg border border-border/50 bg-card/40 overflow-x-auto">
                          {rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">Nenhuma movimentação encontrada para o período.</p>
                            </div>
                          ) : (
                            <Table className="min-w-[190rem]">
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead>Número do Documento</TableHead>
                                  <TableHead>Filial</TableHead>
                                  <TableHead>Tempo Máximo de Congelamento</TableHead>
                                  <TableHead>Data de Início</TableHead>
                                  <TableHead>Código do Túnel Utilizado</TableHead>
                                  <TableHead>Capacidade do Túnel</TableHead>
                                  <TableHead>Quantidade Alocada no Túnel</TableHead>
                                  <TableHead>Quantidade Disponível no Túnel</TableHead>
                                  <TableHead>Ocupação</TableHead>
                                  <TableHead>Status Ocupação</TableHead>
                                  <TableHead>Data de Fechamento</TableHead>
                                  <TableHead>Hora do Fechamento</TableHead>
                                  <TableHead>Data de Abertura</TableHead>
                                  <TableHead>Hora de Abertura</TableHead>
                                  <TableHead>Diferença de Dias</TableHead>
                                  <TableHead>Diferença em Horas</TableHead>
                                  <TableHead>Percentual de congelamento</TableHead>
                                  <TableHead>Status do túnel</TableHead>
                                  <TableHead>Total (horas)</TableHead>
                                  <TableHead>Tempo Adicional (hh:mm)</TableHead>
                                  <TableHead>Data prevista de abertura</TableHead>
                                  <TableHead>Hora prevista de abertura</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {analysisRows.map((a) => (
                                  <TableRow key={a.row.id}>
                                    <TableCell className="font-mono">
                                      <span className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-sm transition-colors hover:bg-primary/20 hover:border-primary/50"
                                          onClick={() => {
                                            setActiveTab("movimentacao");
                                            onEditar(a.row);
                                          }}
                                          title="Abrir documento"
                                          aria-label={`Abrir documento ${padDoc(a.row.numeroDocumento)}`}
                                        >
                                          <ArrowRight className="h-4 w-4 stroke-[2.75]" />
                                        </button>
                                        <span>{padDoc(a.row.numeroDocumento)}</span>
                                      </span>
                                    </TableCell>
                                    <TableCell className="min-w-[20rem] whitespace-nowrap">{a.row.filialNome || "-"}</TableCell>
                                    <TableCell>{a.tempoMaxCongHoras}</TableCell>
                                    <TableCell className="whitespace-nowrap">{formatDate(a.row.dataFechamento)}</TableCell>
                                    <TableCell className="font-mono">{String(a.row.codigoTunel).padStart(4, "0")}</TableCell>
                                    <TableCell>{fmtNum(a.capacidade)}</TableCell>
                                    <TableCell>{fmtNum(a.quantidade)}</TableCell>
                                    <TableCell>{fmtNum(a.qtdDisponivel)}</TableCell>
                                    <TableCell>{a.ocupacaoFmt ?? "-"}</TableCell>
                                    <TableCell>{a.statusOcupacao}</TableCell>
                                    <TableCell className="whitespace-nowrap">{formatDate(a.row.dataFechamento)}</TableCell>
                                    <TableCell className="whitespace-nowrap">{formatHora(a.row.horaFechamento) || "-"}</TableCell>
                                    <TableCell className="whitespace-nowrap">{formatDate(a.row.dataAbertura) || "-"}</TableCell>
                                    <TableCell className="whitespace-nowrap">{formatHora(a.row.horaAbertura) || "-"}</TableCell>
                                    <TableCell>{a.diffDias}</TableCell>
                                    <TableCell>{a.diffHoras}</TableCell>
                                    <TableCell>{a.percentualCong}</TableCell>
                                    <TableCell>{a.statusTunel}</TableCell>
                                    <TableCell>{a.totalHoras}</TableCell>
                                    <TableCell>{a.tempoAdicional}</TableCell>
                                    <TableCell className="whitespace-nowrap">{a.dataPrevAbertura || "-"}</TableCell>
                                    <TableCell className="whitespace-nowrap">{a.horaPrevAbertura || "-"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : relatorioSelecionado === "por_tunel" ? (
                    <Card className="border border-border/60 bg-card/60">
                      <CardHeader className="py-3 px-4 border-b border-border/40 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
                            Túneis - Relatório por Túnel
                          </CardTitle>
                          <Dialog open={filtrosDialogOpen} onOpenChange={setFiltrosDialogOpen}>
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center gap-2 h-9 rounded-md px-2.5 text-xs sm:text-sm font-medium border border-input bg-background hover:bg-muted/50 shrink-0"
                                aria-label="Abrir filtros do relatório por túnel"
                                aria-haspopup="dialog"
                                aria-expanded={filtrosDialogOpen}
                              >
                                <Filter className="h-4 w-4 shrink-0" />
                                <span>Filtros</span>
                              </button>
                            </DialogTrigger>
                            <DialogContent className="w-[340px] sm:w-[420px] max-w-[95vw] p-4 rounded-lg">
                              <DialogHeader>
                                <DialogTitle className="text-base">Filtros — Relatório por Túnel</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground">
                                  Filtre por filial. As movimentações são carregadas sem período (últimos registros, conforme limite do sistema).
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-3 py-2">
                                <div className="space-y-1.5">
                                  <Label>Filial</Label>
                                  <Select value={filtroFilialPending || "__todas__"} onValueChange={(v) => setFiltroFilialPending(v === "__todas__" ? "" : v)}>
                                    <SelectTrigger><SelectValue placeholder="Todas as filiais" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__todas__">Todas as filiais</SelectItem>
                                      {filiais.map((f) => (
                                        <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="flex-1 h-9"
                                  onClick={() => setFiltroFilialPending("")}
                                >
                                  Limpar
                                </Button>
                                <Button
                                  type="button"
                                  className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                                  onClick={() => void aplicarFiltrosRelatorioPorTunel()}
                                >
                                  Filtrar
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-lg border border-border/50 bg-card/40 overflow-x-auto">
                          <Table className="min-w-[90rem]">
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead>Código do Túnel</TableHead>
                                <TableHead>Última transação no túnel</TableHead>
                                <TableHead>Capacidade do Túnel</TableHead>
                                <TableHead>Status do Túnel</TableHead>
                                <TableHead>Quantidade pendente de abertura</TableHead>
                                <TableHead>Diferença disponível por túnel</TableHead>
                                <TableHead>Diferença real disponível por túnel</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {relatorioPorTunelRows.map((r) => (
                                <TableRow key={`${r.filial}|${r.codigoTunel}`}>
                                  <TableCell className="font-mono">{String(r.codigoTunel).padStart(4, "0")}</TableCell>
                                  <TableCell>
                                    {r.ultimaRow ? (
                                      <span className="inline-flex items-center gap-1.5 font-mono">
                                        <button
                                          type="button"
                                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-sm transition-colors hover:bg-primary/20 hover:border-primary/50"
                                          onClick={() => {
                                            const row = r.ultimaRow;
                                            if (!row) return;
                                            setActiveTab("movimentacao");
                                            onEditar(row);
                                          }}
                                          title="Abrir documento"
                                          aria-label={`Abrir documento ${padDoc(r.ultimaRow.numeroDocumento)}`}
                                        >
                                          <ArrowRight className="h-4 w-4 stroke-[2.75]" />
                                        </button>
                                        <span>{padDoc(r.ultimaRow.numeroDocumento)}</span>
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </TableCell>
                                  <TableCell>{round2(r.capacidade).toFixed(2)}</TableCell>
                                  <TableCell>{r.statusTunel}</TableCell>
                                  <TableCell>{r.qtdPendente.toFixed(2)}</TableCell>
                                  <TableCell>{r.diffDisponivel.toFixed(2)}</TableCell>
                                  <TableCell>{r.diffRealDisponivel.toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            {relatorioPorTunelRows.length > 0 ? (
                              <TableFooter>
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                  <TableCell colSpan={2} className="font-semibold text-foreground">
                                    {`Total (${relatorioPorTunelRows.length} ${relatorioPorTunelRows.length === 1 ? "túnel" : "túneis"})`}
                                  </TableCell>
                                  <TableCell className="font-semibold tabular-nums">
                                    {relatorioPorTunelTotals.capacidade.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">—</TableCell>
                                  <TableCell className="font-semibold tabular-nums">
                                    {relatorioPorTunelTotals.qtdPendente.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="font-semibold tabular-nums">
                                    {relatorioPorTunelTotals.diffDisponivel.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="font-semibold tabular-nums">
                                    {relatorioPorTunelTotals.diffRealDisponivel.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              </TableFooter>
                            ) : null}
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
