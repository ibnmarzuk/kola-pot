const MICRO = 1_000_000n;

export function formatStx(micro: bigint): string {
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const whole = abs / MICRO;
  const frac = (abs % MICRO).toString().padStart(6, "0").replace(/0+$/, "");
  const body = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return neg ? `-${body}` : body;
}

export function parseStx(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const micro = BigInt(whole) * MICRO + BigInt(frac.padEnd(6, "0"));
  return micro > 0n ? micro : null;
}

export function shortPrincipal(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 5)}…${value.slice(-4)}`;
}

export function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function progressPercent(raised: bigint, goal: bigint): number {
  if (goal <= 0n) return 0;
  if (raised >= goal) return 100;
  return Number((raised * 100n) / goal);
}
