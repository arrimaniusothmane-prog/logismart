const UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/** Convertit une durée type "15m" / "7d" / "30s" en millisecondes. */
export function durationToMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)\s*(ms|s|m|h|d|w)$/i.exec(value.trim());
  if (!match) return fallbackMs;
  const unit = UNITS[match[2]!.toLowerCase()];
  if (unit === undefined) return fallbackMs;
  return Number(match[1]) * unit;
}
