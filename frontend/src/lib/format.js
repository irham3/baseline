export function idr(n) {
  if (n == null || isNaN(n)) return "-";
  return "IDR " + Math.round(n).toLocaleString("en-US");
}

export function idrCompact(n) {
  if (n == null || isNaN(n)) return "-";
  return "IDR " + (n / 1_000_000).toFixed(1) + "M";
}

export function idrRange(low, high, compact = true) {
  const f = compact ? idrCompact : idr;
  if (low == null || high == null) return "-";
  return `${f(low)} to ${f(high)}`;
}

export function plural(n, singular, pluralLabel = `${singular}s`) {
  return Number(n) === 1 ? singular : pluralLabel;
}

export function revisionPhrase(rounds, consolidated = false) {
  const prefix = consolidated ? "consolidated " : "";
  return `${rounds} ${prefix}revision ${plural(rounds, "round")}`;
}

export function hoursRange(low, high) {
  if (low == null || high == null) return "-";
  return `${Math.round(low)}-${Math.round(high)}h`;
}
