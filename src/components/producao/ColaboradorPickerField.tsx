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
import type { OCTCRow } from "@/services/octc";
import { Loader2 } from "lucide-react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  colaboradores: OCTCRow[];
  loading?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  "aria-label"?: string;
};

export function ColaboradorPickerField({
  label,
  value,
  onChange,
  colaboradores,
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
              placeholder="Nome do colaborador"
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
            <CommandInput placeholder="Buscar por nome…" />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Carregando…
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {colaboradores.length === 0
                      ? "Nenhum colaborador cadastrado (OCTC). Use Cadastro de Colaboradores."
                      : "Nenhum resultado."}
                  </CommandEmpty>
                  <CommandGroup heading="Cadastrados">
                    {colaboradores.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.nomeDoColaborador} ${c.setor} ${c.filialNome} ${c.codigoDoDocumento}`}
                        className="font-medium"
                        onSelect={() => {
                          onChange(c.nomeDoColaborador);
                          setOpen(false);
                        }}
                      >
                        <span className="truncate">{c.nomeDoColaborador}</span>
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
