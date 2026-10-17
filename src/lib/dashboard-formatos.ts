/** Formatação dos KPIs do dashboard (funções puras). */
/** Percentual com uma casa ("94,1%"), ou "—" sem base de cálculo. */
export function pct(ok: number, total: number) {
  return total > 0 ? `${((ok / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";
}

/** Horas decimais em texto: 0,5 -> "30 min"; 26,5 -> "1 d 2 h 30 min". */
export function horasLegivel(h: number | null | undefined) {
  if (h == null) return "—";
  const min = Math.round(Number(h) * 60);
  if (min < 60) return `${min} min`;
  const d = Math.floor(min / 1440);
  const hh = Math.floor((min % 1440) / 60);
  const mm = min % 60;
  return [d ? `${d} d` : "", hh ? `${hh} h` : "", mm ? `${mm} min` : ""].filter(Boolean).join(" ");
}
