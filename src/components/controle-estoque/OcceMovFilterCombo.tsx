import { useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type OcceMovFilterPickChoice = { value: string; label: string };

type Props = {
  label: string;
  id?: string;
  value: string;
  onChange: (v: string) => void;
  /** Valores únicos já existentes no cadastro (sugestões). */
  suggestions: readonly string[];
  /** Opções fixas no topo (ex.: Todos). */
  leading?: readonly OcceMovFilterPickChoice[];
  /** Texto exibido no campo (valor interno pode ser __todos__, etc.). */
  formatDisplay?: (value: string) => string;
  /** Rótulo na lista de sugestões (valor enviado ao filtro continua sendo o da sugestão). */
  formatSuggestion?: (suggestion: string) => string;
  placeholder?: string;
  groupHeading?: string;
  inputClassName?: string;
  /** Valor ao escolher “(Limpar filtro)” (ex.: processo → __todos__). */
  clearValue?: string;
  /** Ex.: `date` — calendário nativo e digitação livre no campo. */
  inputType?: ComponentProps<typeof Input>["type"];
  /**
   * `input` — abre a lista ao focar/clicar no campo.
   * `button` — campo só para digitar; a lista abre pelo botão ao lado (recomendado para datas).
   */
  listTrigger?: "input" | "button";
};

export function OcceMovFilterCombo({
  label,
  id,
  value,
  onChange,
  suggestions,
  leading = [],
  formatDisplay,
  formatSuggestion,
  placeholder = "Clique para listar ou digite…",
  groupHeading = "Valores cadastrados",
  inputClassName,
  clearValue,
  inputType = "text",
  listTrigger = "input",
}: Props) {
  const [open, setOpen] = useState(false);
  const display = formatDisplay ? formatDisplay(value) : value;
  /** Campos com rótulo derivado (ex.: processo) só alteram pela lista, evitando valor exibido ≠ valor do filtro. */
  const inputReadOnly = Boolean(formatDisplay);
  const openListFromField = listTrigger === "input";

  const sortedSuggestions = useMemo(() => {
    return [...suggestions].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  }, [suggestions]);

  return (
    <div className="grid gap-1.5 min-w-0">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <div className={cn("flex w-full min-w-0 items-center gap-1.5", listTrigger === "button" && "gap-2")}>
          {listTrigger === "button" ? (
            <Input
              id={id}
              type={inputType}
              className={cn("h-8 min-w-0 flex-1 text-sm", inputReadOnly && "cursor-pointer", inputClassName)}
              value={display}
              readOnly={inputReadOnly}
              onChange={inputReadOnly ? undefined : (e) => onChange(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
            />
          ) : (
            <PopoverAnchor asChild>
              <div className="min-w-0 flex-1">
                <Input
                  id={id}
                  type={inputType}
                  className={cn("h-8 w-full text-sm", inputReadOnly && "cursor-pointer", inputClassName)}
                  value={display}
                  readOnly={inputReadOnly}
                  onChange={inputReadOnly ? undefined : (e) => onChange(e.target.value)}
                  onFocus={() => openListFromField && setOpen(true)}
                  onClick={() => openListFromField && setOpen(true)}
                  placeholder={placeholder}
                  autoComplete="off"
                  aria-expanded={open}
                  aria-haspopup="listbox"
                />
              </div>
            </PopoverAnchor>
          )}
          {listTrigger === "button" ? (
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Abrir lista de valores cadastrados"
                aria-label="Abrir lista de valores cadastrados"
              >
                <List className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          ) : null}
        </div>
        <PopoverContent
          className="p-0 w-[min(22rem,calc(100vw-2rem))] max-h-[min(280px,45vh)] z-[200]"
          align="start"
          side="bottom"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          collisionPadding={12}
        >
          <Command shouldFilter>
            <CommandInput placeholder="Buscar na lista…" />
            <CommandList>
              <CommandEmpty>
                {suggestions.length === 0 && leading.length === 0
                  ? "Nenhum valor cadastrado ainda."
                  : "Nenhum resultado na busca."}
              </CommandEmpty>
              {leading.length > 0 ? (
                <CommandGroup heading="Opções">
                  {leading.map((c) => (
                    <CommandItem
                      key={c.value}
                      value={`${c.label} ${c.value}`}
                      onSelect={() => {
                        onChange(c.value);
                        setOpen(false);
                      }}
                    >
                      <span className="truncate">{c.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              <CommandGroup heading={groupHeading}>
                <CommandItem
                  value="__limpar__ occe filtro"
                  onSelect={() => {
                    onChange(clearValue !== undefined ? clearValue : "");
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">(Limpar filtro)</span>
                </CommandItem>
                {sortedSuggestions.map((opt, idx) => {
                  const label = formatSuggestion ? formatSuggestion(opt) : opt;
                  return (
                    <CommandItem
                      key={`${opt}::${idx}`}
                      value={`${opt} ${label} ${idx}`}
                      onSelect={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                    >
                      <span className="truncate max-w-full">{label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
