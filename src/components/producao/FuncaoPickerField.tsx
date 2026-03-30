import { useState } from "react";
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

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  funcoes: OCTRFRow[];
  loading?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  "aria-label"?: string;
};

export function FuncaoPickerField({
  label,
  value,
  onChange,
  funcoes,
  loading,
  className,
  inputClassName,
  id,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <Label htmlFor={id} className="text-xs sm:text-sm whitespace-nowrap">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="w-full min-w-0">
            <Input
              id={id}
              className={cn("h-9 w-full", inputClassName)}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              placeholder="Nome ou escolha na lista"
              autoComplete="off"
              aria-label={ariaLabel}
              aria-expanded={open}
              aria-haspopup="listbox"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="p-0 w-[min(20rem,calc(100vw-2rem))] max-h-[min(320px,50vh)]"
          align="start"
          side="bottom"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          collisionPadding={12}
        >
          <Command shouldFilter>
            <CommandInput placeholder="Buscar função ou nº documento…" />
            <CommandList>
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
                        onSelect={() => {
                          onChange(f.nomeDaFuncao);
                          setOpen(false);
                        }}
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
