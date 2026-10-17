const TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type DateInput = string | number | Date | null | undefined;
const toDate = (v: DateInput) => (v == null || v === "" ? null : v instanceof Date ? v : new Date(v));

/** R$ 1.234,56 */
export const formatBRL = (v: number | string | null | undefined) => (v == null ? "—" : brl.format(Number(v)));
/** dd/mm/aaaa */
export const formatData = (v: DateInput) => {
  const d = toDate(v);
  return d ? data.format(d) : "—";
};
/** dd/mm/aaaa hh:mm */
export const formatDataHora = (v: DateInput) => {
  const d = toDate(v);
  return d ? dataHora.format(d) : "—";
};
