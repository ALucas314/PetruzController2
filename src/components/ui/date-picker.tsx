"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Valor no formato YYYY-MM-DD. */
export interface DatePickerProps {
  /** Data no formato YYYY-MM-DD (string). */
  value?: string;
  /** Callback com a data selecionada em YYYY-MM-DD. */
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Classes no botão trigger. */
  triggerClassName?: string;
  /** Altura do trigger (ex: h-8, h-9). */
  size?: "sm" | "default" | "lg";
}

function parseValue(value: string | undefined): Date | undefined {
  if (!value || value.length < 10) return undefined;
  const d = parse(value.slice(0, 10), "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function toValueString(date: Date | undefined): string {
  if (!date || !isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecione a data",
  className,
  id,
  disabled = false,
  triggerClassName,
  size = "default",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const date = parseValue(value);

  const handleSelect = (selected: Date | undefined) => {
    if (!selected) return;
    onChange?.(toValueString(selected));
    setOpen(false);
  };

  const sizeClass =
    size === "sm"
      ? "h-8 text-xs"
      : size === "lg"
        ? "h-10 text-base"
        : "h-9 text-sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal bg-background border-input",
            sizeClass,
            !date && "text-muted-foreground",
            triggerClassName,
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {date ? (
            format(date, "dd/MM/yyyy", { locale: ptBR })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}
