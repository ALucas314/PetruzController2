/**
 * Formatação numérica padrão Brasil (pt-BR) para exibição em toda a aplicação.
 * Use estes helpers em vez de toFixed() ou toLocaleString() sem locale.
 */

export const LOCALE_BR = "pt-BR" as const;

function toFiniteNumber(value: number | string | null | undefined): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const s = String(value).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Número com separador de milhar e vírgula decimal; casas decimais fixas. */
export function formatNumberPtBrFixed(
  value: number | string | null | undefined,
  fractionDigits: number,
): string {
  const n = toFiniteNumber(value);
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString(LOCALE_BR, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Número pt-BR com intervalo de casas decimais (ex.: 0–4 para quantidades).
 */
export function formatNumberPtBr(
  value: number | string | null | undefined,
  minFractionDigits = 0,
  maxFractionDigits = 4,
): string {
  const n = toFiniteNumber(value);
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString(LOCALE_BR, {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  });
}

/** Percentual com vírgula decimal e símbolo %. */
export function formatPercentPtBr(value: number | string | null | undefined, fractionDigits = 1): string {
  return `${formatNumberPtBrFixed(value, fractionDigits)}%`;
}
