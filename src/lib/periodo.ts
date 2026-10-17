/**
 * Períodos de análise (dashboard e relatórios), sempre no fuso de Brasília.
 * O período vai de `de` (inclusive) até `ate` (exclusive), como timestamptz.
 */
const TZ = "America/Sao_Paulo";

export type PresetPeriodo = "hoje" | "7d" | "30d" | "mes" | "custom";

export const PRESETS: { valor: PresetPeriodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "7d", rotulo: "Últimos 7 dias" },
  { valor: "30d", rotulo: "Últimos 30 dias" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "custom", rotulo: "Personalizado" },
];

export type Periodo = {
  preset: PresetPeriodo;
  /** Datas (aaaa-mm-dd) inclusivas, para exibição e para os campos do filtro. */
  deData: string;
  ateData: string;
  /** Instantes para as consultas: [de, ate). */
  de: string;
  ate: string;
  rotulo: string;
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

const hojeSP = (agora: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(agora);

function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const dataValida = (s: string) => DATA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const fmt = (data: string) => data.split("-").reverse().join("/");

/** Converte os parâmetros da URL (?periodo=&de=&ate=) em um período válido. Padrão: últimos 30 dias. */
export function resolverPeriodo(
  params: { periodo?: string | string[]; de?: string | string[]; ate?: string | string[] },
  agora: Date = new Date(),
): Periodo {
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  const hoje = hojeSP(agora);
  let preset = PRESETS.some((p) => p.valor === um(params.periodo))
    ? (um(params.periodo) as PresetPeriodo)
    : "30d";
  let deData = hoje;
  let ateData = hoje;

  if (preset === "custom") {
    const de = um(params.de);
    const ate = um(params.ate);
    if (dataValida(de) && dataValida(ate)) {
      deData = de <= ate ? de : ate;
      ateData = de <= ate ? ate : de;
      // limita a 5 anos para não sobrecarregar as consultas
      if (Date.parse(ateData) - Date.parse(deData) > 5 * 366 * 86_400_000)
        deData = somarDias(ateData, -5 * 365);
    } else {
      preset = "30d";
    }
  }
  if (preset === "hoje") {
    deData = hoje;
    ateData = hoje;
  } else if (preset === "7d") {
    deData = somarDias(hoje, -6);
  } else if (preset === "30d") {
    deData = somarDias(hoje, -29);
  } else if (preset === "mes") {
    deData = `${hoje.slice(0, 7)}-01`;
  }

  const rotuloPreset = PRESETS.find((p) => p.valor === preset)!.rotulo;
  return {
    preset,
    deData,
    ateData,
    // Brasília não tem horário de verão desde 2019: deslocamento fixo de -03:00.
    de: `${deData}T00:00:00-03:00`,
    ate: `${somarDias(ateData, 1)}T00:00:00-03:00`,
    rotulo: preset === "hoje" ? "Hoje" : `${rotuloPreset} (${fmt(deData)} a ${fmt(ateData)})`,
  };
}
