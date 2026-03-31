import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { OCTRFRow } from "@/services/octrf";
import { Loader2 } from "lucide-react";

type DropdownMode = "popover" | "inline";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  funcoes: OCTRFRow[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
  id?: string;
  "aria-label"?: string;
  /**
   * `inline`: lista fica no fluxo do Dialog (sem portal) — necessário para o modal de colaboradores.
   * `popover`: portal no body (padrão), melhor em telas com scroll/overflow.
   */
  dropdownMode?: DropdownMode;
};

function FuncaoListPanel({
  funcoes,
  loading,
  onPick,
}: {
  funcoes: OCTRFRow[];
  loading: boolean;
  onPick: (nome: string) => void;
}) {
  return (
    <Command shouldFilter className="rounded-md border-0 bg-transparent">
      <CommandInput placeholder="Buscar função ou nº documento…" />
      <CommandList className="max-h-[min(280px,45vh)]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Carregando…
          </div>
        ) : (
          <>
            <CommandEmpty>
              {funcoes.length === 0
                ? "Nenhuma função cadastrada (OCTRF). Use Cadastro de funções."
                : "Nenhum resultado."}
            </CommandEmpty>
            <CommandGroup heading="Cadastradas">
              {funcoes.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`${f.nomeDaFuncao} ${f.numeroDoDocumento}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1"
                  onSelect={() => onPick(f.nomeDaFuncao)}
                >
                  <span className="truncate font-medium">{f.nomeDaFuncao}</span>
                  {f.numeroDoDocumento?.trim() ? (
                    <span className="text-xs font-mono shrink-0 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
                      {f.numeroDoDocumento.trim()}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}

export function FuncaoPickerField({
  label,
  value,
  onChange,
  funcoes,
  loading,
  disabled,
  placeholder,
  maxLength,
  className,
  inputClassName,
  id,
  "aria-label": ariaLabel,
  dropdownMode = "popover",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open || dropdownMode !== "inline") return;
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, dropdownMode]);

  const input = (
    <Input
      id={id}
      className={cn("h-9 w-full", inputClassName)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => !disabled && setOpen(true)}
      onClick={() => !disabled && setOpen(true)}
      placeholder={placeholder ?? "Nome ou escolha na lista"}
      disabled={disabled}
      maxLength={maxLength}
      autoComplete="off"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup="listbox"
    />
  );

  if (dropdownMode === "inline") {
    return (
      <div ref={wrapRef} className={cn("space-y-1.5 min-w-0", className)}>
        <Label htmlFor={id} className="text-xs sm:text-sm whitespace-nowrap">
          {label}
        </Label>
        <div className="relative w-full min-w-0">
          {input}
          {open && !disabled ? (
            <div
              data-funcao-picker-panel=""
              className="absolute left-0 right-0 top-full z-[200] mt-1 flex max-h-[min(320px,50vh)] flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg outline-none"
              role="listbox"
            >
              <FuncaoListPanel
                funcoes={funcoes}
                loading={!!loading}
                onPick={(nome) => {
                  onChange(nome);
                  close();
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <Label htmlFor={id} className="text-xs sm:text-sm whitespace-nowrap">
        {label}
      </Label>
      <Popover modal={false} open={disabled ? false : open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverAnchor asChild>
          <div className="w-full min-w-0">{input}</div>
        </PopoverAnchor>
        <PopoverContent
          data-funcao-picker-panel=""
          className="p-0 w-[min(20rem,calc(100vw-2rem))] max-h-[min(320px,50vh)] z-[200]"
          align="start"
          side="bottom"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          collisionPadding={12}
        >
          <FuncaoListPanel
            funcoes={funcoes}
            loading={!!loading}
            onPick={(nome) => {
              onChange(nome);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
