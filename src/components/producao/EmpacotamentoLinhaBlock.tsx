import { useEffect, type ComponentProps, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getItemByCode } from "@/services/supabaseData";
import { cn } from "@/lib/utils";
import {
  QTY_SLOTS,
  formatCommittedSummary,
  parseTokenToNumber,
  sumCommitted,
} from "./octeQuantidadesHelpers";
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
        <div className="shrink-0 w-[6.5rem] space-y-1.5">
          <OcteLineTextField
            label="Peso (kg)"
            className="font-mono tabular-nums w-full"
            type="number"
            step="0.0001"
            min={0}
            value={line.peso ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onPatch({ peso: v === "" ? null : Number(v) });
            }}
            placeholder="0"
            title="Peso digitável em quilogramas"
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
        <div className="space-y-1.5 min-w-0">
          <OcteLineTextField
            label="Peso (kg)"
            className="font-mono tabular-nums"
            type="number"
            step="0.0001"
            min={0}
            value={line.peso ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onPatch({ peso: v === "" ? null : Number(v) });
            }}
            placeholder="0"
            title="Peso digitável em quilogramas"
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
  const { toast } = useToast();
  const nextSlot = line.committedQtys.length < QTY_SLOTS ? line.committedQtys.length + 1 : null;
  const totalAcumulado = sumCommitted(line.committedQtys);

  const addQuantity = () => {
    if (line.committedQtys.length >= QTY_SLOTS) {
      toast({
        title: "Limite",
        description: `No máximo ${QTY_SLOTS} quantidades (Q1…Q${QTY_SLOTS}).`,
        variant: "destructive",
      });
      return;
    }
    const v = parseTokenToNumber(line.draftQty);
    if (!Number.isFinite(v) || String(line.draftQty).trim() === "") {
      toast({
        title: "Quantidade",
        description: "Digite um valor numérico antes de adicionar.",
        variant: "destructive",
      });
      return;
    }
    onPatch({ committedQtys: [...line.committedQtys, v], draftQty: "" });
  };

  const undoLastQuantity = () => {
    if (line.committedQtys.length === 0) return;
    onPatch({ committedQtys: line.committedQtys.slice(0, -1) });
  };

  const onDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addQuantity();
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
      <div className="shrink-0 w-[9.5rem] space-y-1.5 pb-px">
        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Total Q1…Q{QTY_SLOTS}</Label>
        <div className="h-9 flex items-center text-sm font-semibold tabular-nums text-foreground border border-input rounded-md px-2 bg-background">
          {formatNumberPtBrFixed(totalAcumulado, 2)}
        </div>
      </div>
      {line.committedQtys.length > 0 ? (
        <div className="shrink-0 flex items-end pb-px">
          <Button type="button" variant="outline" size="sm" className="h-9 text-xs whitespace-nowrap" onClick={undoLastQuantity}>
            Desfazer Q
          </Button>
        </div>
      ) : null}
      <div className="shrink-0 w-[14rem] space-y-1.5">
        {nextSlot != null ? (
          <>
            <Label className="text-xs sm:text-sm font-medium whitespace-nowrap">
              Q<span className="text-primary">{nextSlot}</span>
              <span className="text-muted-foreground font-normal"> / {QTY_SLOTS}</span>
            </Label>
            <div className="flex gap-2 items-center">
              <Input
                type="text"
                inputMode="decimal"
                className="h-9 flex-1 min-w-0 font-mono tabular-nums text-sm min-w-[5rem]"
                placeholder="Ex.: 100"
                value={line.draftQty}
                onChange={(e) => onPatch({ draftQty: e.target.value })}
                onKeyDown={onDraftKeyDown}
                aria-label={`Quantidade ${nextSlot} registro ${index + 1}`}
              />
              <Button type="button" size="sm" className="h-9 shrink-0 gap-1 px-2.5" onClick={addQuantity} title="Adicionar quantidade">
                <Plus className="h-4 w-4 shrink-0" />
                <span className="text-xs whitespace-nowrap">Add</span>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground pb-2">Limite Q{QTY_SLOTS}.</p>
        )}
      </div>
      <div className="shrink-0 w-[13rem] min-h-[3.25rem] max-h-[4.5rem] overflow-y-auto rounded-md border border-border/60 bg-background/80 px-2 py-1.5 text-[11px] text-muted-foreground leading-snug">
        {line.committedQtys.length > 0 ? (
          <>
            <span className="font-medium text-foreground">Q: </span>
            {formatCommittedSummary(line.committedQtys)}
          </>
        ) : (
          <span className="text-muted-foreground/80">Sem Q confirmada</span>
        )}
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
