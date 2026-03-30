import type { OCTEPayload } from "@/services/octe";
import { formatNumberPtBrFixed } from "@/lib/formatLocale";

export const QTY_SLOTS = 12;

export const Q_KEYS = Array.from({ length: QTY_SLOTS }, (_, i) => `quantidade${i + 1}`) as (keyof OCTEPayload)[];

export function parseTokenToNumber(token: string): number {
  const s = token.trim();
  if (!s) return NaN;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function committedToTwelve(committed: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < QTY_SLOTS; i++) {
    out.push(i < committed.length ? committed[i] : 0);
  }
  return out;
}

export function twelveToPayloadPatch(twelve: number[]): Pick<OCTEPayload, (typeof Q_KEYS)[number]> {
  const patch = {} as Pick<OCTEPayload, (typeof Q_KEYS)[number]>;
  twelve.forEach((n, i) => {
    patch[Q_KEYS[i]] = n as never;
  });
  return patch;
}

export function payloadToCommitted(p: OCTEPayload): number[] {
  const nums = Q_KEYS.map((k) => Number(p[k] ?? 0));
  let end = QTY_SLOTS - 1;
  while (end > 0 && nums[end] === 0) end -= 1;
  if (end < 0) return [];
  return nums.slice(0, end + 1);
}

export function sumCommitted(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function formatCommittedSummary(values: number[]): string {
  if (values.length === 0) return "";
  return values
    .map((n, i) => `Q${i + 1}: ${formatNumberPtBrFixed(n, 2)}`)
    .join(" · ");
}

export function formatRowQuantidadesColuna(r: {
  quantidade1: number;
  quantidade2: number;
  quantidade3: number;
  quantidade4: number;
  quantidade5: number;
  quantidade6: number;
  quantidade7: number;
  quantidade8: number;
  quantidade9: number;
  quantidade10: number;
  quantidade11: number;
  quantidade12: number;
}): string {
  const qs = [
    r.quantidade1,
    r.quantidade2,
    r.quantidade3,
    r.quantidade4,
    r.quantidade5,
    r.quantidade6,
    r.quantidade7,
    r.quantidade8,
    r.quantidade9,
    r.quantidade10,
    r.quantidade11,
    r.quantidade12,
  ];
  const parts: string[] = [];
  qs.forEach((q, i) => {
    const n = Number(q);
    if (Number.isFinite(n) && n !== 0) {
      parts.push(`${i + 1}: ${formatNumberPtBrFixed(n, 2)}`);
    }
  });
  return parts.length > 0 ? parts.join(" · ") : "—";
}
