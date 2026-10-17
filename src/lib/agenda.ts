/** Cálculos de calendário da agenda (datas "aaaa-mm-dd", sem fuso: são dias de Brasília). */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const paraData = (s: string) => new Date(`${s}T00:00:00Z`);

export const somarDias = (s: string, n: number) => {
  const d = paraData(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

export const dataValida = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Segunda-feira da semana de `data`. */
export function inicioSemana(data: string) {
  const dow = paraData(data).getUTCDay(); // 0 = domingo
  return somarDias(data, -((dow + 6) % 7));
}

export function semana(data: string) {
  const inicio = inicioSemana(data);
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  return { inicio, fimExclusivo: somarDias(inicio, 7), dias };
}

/** Grade do mês: semanas completas (segunda a domingo) que cobrem o mês de `data`. */
export function mes(data: string) {
  const [a, m] = data.split("-").map(Number);
  const primeiro = `${a}-${pad(m)}-01`;
  const ultimo = iso(new Date(Date.UTC(a, m, 0)));
  const inicio = inicioSemana(primeiro);
  const fimGrade = somarDias(inicioSemana(ultimo), 6);
  const dias: string[] = [];
  for (let d = inicio; d <= fimGrade; d = somarDias(d, 1)) dias.push(d);
  return { primeiro, ultimo, inicio, fimExclusivo: somarDias(fimGrade, 1), dias, mesRef: `${a}-${pad(m)}` };
}

export function navegar(data: string, visao: "semana" | "mes", delta: number) {
  if (visao === "semana") return somarDias(data, delta * 7);
  const [a, m] = data.split("-").map(Number);
  return iso(new Date(Date.UTC(a, m - 1 + delta, 1)));
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export const nomeMes = (data: string) => {
  const [a, m] = data.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
};

export const nomeDiaCurto = (data: string) => DIAS_CURTOS[paraData(data).getUTCDay()];
export const diaDoMes = (data: string) => Number(data.slice(8, 10));

export function tituloSemana(dias: string[]) {
  const f = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return `${f(dias[0])} a ${f(dias[6])} de ${dias[6].slice(0, 4)}`;
}

/** Novo horário ao soltar um chamado em outro dia: mantém a hora (Brasília) ou usa 09:00. */
export function novoHorario(dia: string, atualLocal: string | null) {
  const hora = atualLocal && /T\d{2}:\d{2}$/.test(atualLocal) ? atualLocal.slice(11) : "09:00";
  return `${dia}T${hora}`;
}
