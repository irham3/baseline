export function idr(n) {
  if (n == null || isNaN(n)) return "—";
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function idrJuta(n) {
  if (n == null || isNaN(n)) return "—";
  return "Rp" + (n / 1_000_000).toFixed(1).replace(".", ",") + " juta";
}

export function idrRange(low, high, juta = true) {
  const f = juta ? idrJuta : idr;
  if (low == null || high == null) return "—";
  return `${f(low)} – ${f(high)}`;
}

export function hoursRange(low, high) {
  if (low == null || high == null) return "—";
  return `${Math.round(low)}–${Math.round(high)} jam`;
}
