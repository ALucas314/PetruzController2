import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILIAL_PLACEHOLDER_LABEL, FILIAL_PLACEHOLDER_VALUE } from "@/lib/filialSelect";
import { cn } from "@/lib/utils";

const ORPHAN_PREFIX = "__filial_saved__::";

export type FilialSelectOption = { id: number; nome: string };

type Props = {
  label: string;
  value: string;
  onChange: (nome: string) => void;
  filiais: FilialSelectOption[];
  loading?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  /** Texto de ajuda abaixo do campo (ex.: responsividade igual aos outros formulários). */
  hint?: ReactNode;
};

/**
 * Seleção de filial (OCTF) — mesmo padrão do campo Filial em Movimentação de túneis (primeira opção desabilitada).
 * Valor gravado: nome da filial (`Name` na OCTF). Valor salvo que não existe mais na lista aparece como opção extra.
 */
export function FilialSelectField({
  label,
  value,
  onChange,
  filiais,
  loading = false,
  disabled = false,
  id,
  className,
  triggerClassName,
  hint,
}: Props) {
  const v = value.trim();
  const inList = filiais.some((f) => f.nome === v);
  const orphanKey = v && !inList ? `${ORPHAN_PREFIX}${encodeURIComponent(v)}` : "";
  const selectValue = !v ? FILIAL_PLACEHOLDER_VALUE : inList ? v : orphanKey;

  const handleChange = (raw: string) => {
    if (raw === FILIAL_PLACEHOLDER_VALUE) {
      onChange("");
      return;
    }
    if (raw.startsWith(ORPHAN_PREFIX)) {
      try {
        onChange(decodeURIComponent(raw.slice(ORPHAN_PREFIX.length)));
      } catch {
        onChange("");
      }
      return;
    }
    onChange(raw);
  };

  return (
    <div className={cn("space-y-1.5 w-full min-w-0", className)}>
      <Label htmlFor={id} className="text-xs sm:text-sm">
        {label}
      </Label>
      <Select value={selectValue} onValueChange={handleChange} disabled={disabled || loading}>
        <SelectTrigger
          id={id}
          className={cn("h-9 w-full", triggerClassName)}
          aria-busy={loading}
        >
          <SelectValue
            placeholder={
              loading ? "Carregando filiais…" : filiais.length === 0 ? "Nenhuma filial na OCTF" : "Selecione a filial"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-[min(280px,50vh)]">
          <SelectItem value={FILIAL_PLACEHOLDER_VALUE} disabled>
            {FILIAL_PLACEHOLDER_LABEL}
          </SelectItem>
          {orphanKey ? (
            <SelectItem value={orphanKey} className="whitespace-normal">
              <span className="line-clamp-2">{v}</span>
              <span className="block text-xs text-muted-foreground sm:inline sm:ml-1">(salvo)</span>
            </SelectItem>
          ) : null}
          {filiais.map((f) => (
            <SelectItem key={f.id} value={f.nome}>
              {f.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <div className="text-[11px] text-muted-foreground pt-0.5">{hint}</div> : null}
    </div>
  );
}
