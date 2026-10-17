export const TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
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
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const toDate = (v: DateInput) => (v == null || v === "" ? null : v instanceof Date ? v : new Date(v));

/** R$ 1.234,56 */
export const formatBRL = (v: number | string | null | undefined) => (v == null ? "—" : brl.format(Number(v)));

/** 1.234,5 */
export const formatNumero = (v: number | string | null | undefined) =>
  v == null ? "—" : numero.format(Number(v));

/**
 * dd/mm/aaaa. Datas puras ("2026-01-01", colunas `date`) são formatadas sem fuso,
 * para não virarem o dia anterior em America/Sao_Paulo.
 */
export const formatData = (v: DateInput) => {
  if (typeof v === "string") {
    const m = SO_DATA.exec(v);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = toDate(v);
  return d ? data.format(d) : "—";
};

/** dd/mm/aaaa hh:mm */
export const formatDataHora = (v: DateInput) => {
  const d = toDate(v);
  return d ? dataHora.format(d) : "—";
};

/** Data de hoje em São Paulo no formato ISO (aaaa-mm-dd). */
export const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

/** Dias corridos de hoje até uma data ISO (negativo = já passou). */
export function diasAte(dataIso: string) {
  return Math.round((Date.parse(`${dataIso}T00:00:00Z`) - Date.parse(`${hojeISO()}T00:00:00Z`)) / 86_400_000);
}
