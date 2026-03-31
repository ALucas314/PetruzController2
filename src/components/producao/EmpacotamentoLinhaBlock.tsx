import { useEffect, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { getItemByCode } from "@/services/supabaseData";
import { cn } from "@/lib/utils";
import { QTY_SLOTS, parseTokenToNumber, sumCommitted } from "./octeQuantidadesHelpers";
import { formatNumberPtBrFixed } from "@/lib/formatLocale";
import type { OCTCRow } from "@/services/octc";
import type { OCTRFRow } from "@/services/octrf";
import { ColaboradorPickerField } from "./ColaboradorPickerField";
import { FuncaoPickerField } from "./FuncaoPickerField";

/** Campo de linha OCTE — mesmo shell visual (altura, label, foco) para descrição, unidade e peso. */
function OcteLineTextField({
  label,
  className,
  readOnly,
  ...rest
}: { label: string } & ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs sm:text-sm">{label}</Label>
      <Input className={cn("h-9", readOnly && "bg-muted/30 cursor-default", className)} readOnly={readOnly} {...rest} />
    </div>
  );
}

export type OCTELineDraft = {
  localKey: string;
  dbId?: number;
  codigoItem: string;
  descricaoItem: string;
  unidadeItem: string;
  /** Peso em kg (sempre digitável). */
  peso: number | null;
  catalogResolved: boolean;
  colaborador: string;
  committedQtys: number[];
  draftQty: string;
  funcaoColaborador: string;
  meta: number | null;
  horas: number | null;
  observacoes: string;
};

export function newEmptyLine(localKey: string): OCTELineDraft {
  return {
    localKey,
    codigoItem: "",
    descricaoItem: "",
    unidadeItem: "",
    peso: null,
    catalogResolved: false,
    colaborador: "",
    committedQtys: [],
    draftQty: "",
    funcaoColaborador: "",
    meta: null,
    horas: null,
    observacoes: "",
  };
}

/** Código, descrição, unidade e peso — grid (2 col.) ou faixa horizontal (planilha). */
export function OcteItemFieldsGrid({
  line,
  onPatch,
  className,
  layout = "grid",
}: {
  line: OCTELineDraft;
  onPatch: (patch: Partial<OCTELineDraft>) => void;
  className?: string;
  layout?: "grid" | "strip";
}) {
  useEffect(() => {
    const code = line.codigoItem.trim();
    if (!code) {
      if (line.descricaoItem || line.unidadeItem || line.catalogResolved) {
        onPatch({ descricaoItem: "", unidadeItem: "", catalogResolved: false });
      }
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const item = await getItemByCode(code);
        if (cancelled) return;
        if (item?.nome_item) {
          onPatch({
            descricaoItem: item.nome_item,
            unidadeItem: item.unidade_medida != null ? String(item.unidade_medida) : "",
            catalogResolved: true,
          });
        } else {
          onPatch({ catalogResolved: false });
        }
      } catch {
        if (!cancelled) onPatch({ catalogResolved: false });
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps: só codigoItem
  }, [line.codigoItem]);

  if (layout === "strip") {
    return (
      <div className={cn("flex flex-nowrap items-end gap-3 shrink-0", className)}>
        <div className="shrink-0 w-[7.5rem] space-y-1.5">
          <Label className="text-xs sm:text-sm whitespace-nowrap">Código do item</Label>
          <Input
            className="h-9 font-mono text-sm w-full"
            value={line.codigoItem}
            onChange={(e) => onPatch({ codigoItem: e.target.value })}
            placeholder="Código"
            autoComplete="off"
          />
        </div>
        <div className="shrink-0 w-[5.5rem] space-y-1.5">
          <OcteLineTextField
            label="Unidade"
            readOnly={line.catalogResolved}
            title={line.catalogResolved ? "Preenchido automaticamente pelo cadastro de itens" : undefined}
            className="w-full"
            value={line.unidadeItem}
            onChange={(e) => onPatch({ unidadeItem: e.target.value })}
            placeholder={line.catalogResolved ? "" : "UN…"}
          />
        </div>
        <div className="shrink-0 w-[14rem] space-y-1.5">
          <OcteLineTextField
            label="Descrição do item"
            readOnly={line.catalogResolved}
            title={line.catalogResolved ? "Preenchido automaticamente pelo cadastro de itens" : undefined}
            className="w-full"
            value={line.descricaoItem}
            onChange={(e) => onPatch({ descricaoItem: e.target.value })}
            placeholder={line.catalogResolved ? "" : "Descrição"}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-4 md:gap-x-6 sm:gap-y-0",
        className,
      )}
    >
      <div className="flex min-w-0 w-full max-w-full flex-col gap-3 sm:max-w-[min(100%,20rem)] md:max-w-[min(100%,26rem)] lg:max-w-[min(100%,34rem)]">
        <div className="space-y-1.5 min-w-0 w-full max-w-full sm:max-w-[min(100%,12rem)] md:max-w-[min(100%,14rem)]">
          <Label className="text-xs sm:text-sm">Código do item</Label>
          <Input
            className="h-9 font-mono text-sm w-full"
            value={line.codigoItem}
            onChange={(e) => onPatch({ codigoItem: e.target.value })}
            placeholder="Digite o código"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5 min-w-0 w-full">
          <OcteLineTextField
            label="Descrição do item"
            readOnly={line.catalogResolved}
            title={line.catalogResolved ? "Preenchido automaticamente pelo cadastro de itens" : undefined}
            value={line.descricaoItem}
            onChange={(e) => onPatch({ descricaoItem: e.target.value })}
            placeholder={line.catalogResolved ? "" : "Preenchida ao localizar o item"}
          />
        </div>
      </div>
      <div className="flex min-w-0 w-full flex-col gap-3 sm:w-auto sm:shrink-0 sm:min-w-[9rem] md:min-w-[10.5rem] lg:min-w-[11rem]">
        <div className="space-y-1.5 min-w-0">
          <OcteLineTextField
            label="Unidade"
            readOnly={line.catalogResolved}
            title={line.catalogResolved ? "Preenchido automaticamente pelo cadastro de itens" : undefined}
            value={line.unidadeItem}
            onChange={(e) => onPatch({ unidadeItem: e.target.value })}
            placeholder={line.catalogResolved ? "" : "UN, KG…"}
          />
        </div>
      </div>
    </div>
  );
}

type Props = {
  index: number;
  line: OCTELineDraft;
  onPatch: (patch: Partial<OCTELineDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
  /** Lista OCTC (cadastro de colaboradores) para o campo Colaborador. */
  colaboradoresOctc?: OCTCRow[];
  colaboradoresOctcLoading?: boolean;
  /** Lista OCTRF (cadastro de funções) para o campo Função. */
  funcoesOctrf?: OCTRFRow[];
  funcoesOctrfLoading?: boolean;
};

export function EmpacotamentoLinhaBlock({
  index,
  line,
  onPatch,
  onRemove,
  canRemove,
  colaboradoresOctc = [],
  colaboradoresOctcLoading = false,
  funcoesOctrf = [],
  funcoesOctrfLoading = false,
}: Props) {
  const totalAcumulado = sumCommitted(line.committedQtys);
  const [qtyDrafts, setQtyDrafts] = useState<string[]>(() =>
    Array.from({ length: QTY_SLOTS }, (_, i) => {
      const n = Number(line.committedQtys[i] ?? 0);
      return Number.isFinite(n) && n !== 0 ? formatNumberPtBrFixed(n, 2) : "";
    })
  );

  useEffect(() => {
    setQtyDrafts(
      Array.from({ length: QTY_SLOTS }, (_, i) => {
        const n = Number(line.committedQtys[i] ?? 0);
        return Number.isFinite(n) && n !== 0 ? formatNumberPtBrFixed(n, 2) : "";
      })
    );
  }, [line.committedQtys]);
  const setQtyAt = (slotIndex: number, raw: string) => {
    const values = Array.from({ length: QTY_SLOTS }, (_, i) => Number(line.committedQtys[i] ?? 0));
    const token = String(raw).trim();
    if (token === "") {
      values[slotIndex] = 0;
    } else {
      const parsed = parseTokenToNumber(token);
      if (!Number.isFinite(parsed)) return;
      values[slotIndex] = parsed;
    }
    let end = QTY_SLOTS - 1;
    while (end >= 0 && values[end] === 0) end -= 1;
    onPatch({ committedQtys: end >= 0 ? values.slice(0, end + 1) : [] });
  };

  const updateDraftQty = (slotIndex: number, raw: string) => {
    setQtyDrafts((prev) => {
      const next = [...prev];
      next[slotIndex] = raw;
      return next;
    });
  };

  const commitDraftQty = (slotIndex: number) => {
    const raw = String(qtyDrafts[slotIndex] ?? "").trim();
    if (raw === "") {
      setQtyAt(slotIndex, "");
      updateDraftQty(slotIndex, "");
      return;
    }
    const parsed = parseTokenToNumber(raw);
    if (!Number.isFinite(parsed)) return;
    // Mantém o texto original para não perder separador decimal durante o parse interno.
    setQtyAt(slotIndex, raw);
    updateDraftQty(slotIndex, parsed === 0 ? "" : formatNumberPtBrFixed(parsed, 2));
  };

  return (
    <div className="flex flex-nowrap items-end gap-3 sm:gap-4 py-2.5 px-2 sm:px-3 min-w-max">
      <ColaboradorPickerField
        className="shrink-0 w-[11rem]"
        label="Colaborador"
        value={line.colaborador}
        onChange={(v) => onPatch({ colaborador: v })}
        colaboradores={colaboradoresOctc}
        loading={colaboradoresOctcLoading}
        aria-label={`Colaborador registro ${index + 1}`}
      />
      <FuncaoPickerField
        className="shrink-0 w-[12rem]"
        label="Função"
        value={line.funcaoColaborador}
        onChange={(v) => onPatch({ funcaoColaborador: v })}
        funcoes={funcoesOctrf}
        loading={funcoesOctrfLoading}
        aria-label={`Função registro ${index + 1}`}
      />
      <div className="shrink-0 w-[32rem] space-y-1.5">
        <Label className="text-xs sm:text-sm font-medium whitespace-nowrap">Quantidades (Q1…Q{QTY_SLOTS})</Label>
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
          {Array.from({ length: QTY_SLOTS }, (_, slotIndex) => {
            const slotLabel = `Q${slotIndex + 1}`;
            return (
              <div key={slotLabel} className="shrink-0 flex items-center gap-1">
                <Label className="text-[11px] text-muted-foreground whitespace-nowrap">{slotLabel}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  className="h-9 w-[3.6rem] px-1.5 font-mono tabular-nums text-sm"
                  placeholder="0,00"
                  value={qtyDrafts[slotIndex] ?? ""}
                  onChange={(e) => updateDraftQty(slotIndex, e.target.value)}
                  onBlur={() => commitDraftQty(slotIndex)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitDraftQty(slotIndex);
                    }
                  }}
                  aria-label={`Quantidade ${slotIndex + 1} registro ${index + 1}`}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="shrink-0 w-[9.5rem] space-y-1.5 pb-px">
        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Total Q1…Q{QTY_SLOTS}</Label>
        <div className="h-9 flex items-center text-sm font-semibold tabular-nums text-foreground border border-input rounded-md px-2 bg-background">
          {formatNumberPtBrFixed(totalAcumulado, 2)}
        </div>
      </div>
      <div className="shrink-0 w-[6.5rem] space-y-1.5">
        <Label className="text-xs sm:text-sm whitespace-nowrap">Peso (kg)</Label>
        <Input
          type="number"
          step="0.0001"
          min={0}
          className="h-9 w-full font-mono tabular-nums"
          value={line.peso ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onPatch({ peso: v === "" ? null : Number(v) });
          }}
          placeholder="0"
          title="Peso digitável em quilogramas"
        />
      </div>
      <div className="shrink-0 w-[5.5rem] space-y-1.5">
        <Label className="text-xs sm:text-sm whitespace-nowrap">Meta</Label>
        <Input
          type="number"
          step="0.01"
          className="h-9 w-full tabular-nums"
          value={line.meta ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onPatch({ meta: v === "" ? null : Number(v) });
          }}
        />
      </div>
      <div className="shrink-0 w-[5.5rem] space-y-1.5">
        <Label className="text-xs sm:text-sm whitespace-nowrap">Horas</Label>
        <Input
          type="number"
          step="0.01"
          className="h-9 w-full tabular-nums"
          value={line.horas ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onPatch({ horas: v === "" ? null : Number(v) });
          }}
        />
      </div>
      <div className="shrink-0 w-[14rem] space-y-1.5">
        <Label className="text-xs sm:text-sm whitespace-nowrap">Observações</Label>
        <Textarea
          value={line.observacoes}
          onChange={(e) => onPatch({ observacoes: e.target.value })}
          rows={2}
          className="min-h-[60px] max-h-[72px] resize-none text-sm py-2"
        />
      </div>
      {canRemove ? (
        <div className="shrink-0 flex items-end pb-px border-l border-border/50 pl-2 sm:pl-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
            onClick={onRemove}
            title="Remover registro"
            aria-label={`Remover registro ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
