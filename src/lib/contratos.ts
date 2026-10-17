import { diasAte, formatData, hojeISO } from "@/lib/format";

type Tom = "verde" | "amarelo" | "laranja" | "vermelho" | "azul" | "cinza";

export type ContratoBase = {
  status: "ativo" | "suspenso" | "encerrado";
  data_inicio: string;
  data_fim: string | null;
};

/** Situação para exibição, com alerta de vencimento em 30/15/7 dias. */
export function situacaoContrato(c: ContratoBase): { label: string; tom: Tom; dias?: number } {
  if (c.status === "encerrado") return { label: "Encerrado", tom: "cinza" };
  if (c.status === "suspenso") return { label: "Suspenso", tom: "amarelo" };

  const hoje = hojeISO();
  if (c.data_inicio > hoje) return { label: `Inicia em ${formatData(c.data_inicio)}`, tom: "azul" };
  if (c.data_fim && c.data_fim < hoje) return { label: "Vencido", tom: "vermelho" };
  if (c.data_fim) {
    const dias = diasAte(c.data_fim);
    const texto = dias === 0 ? "Vence hoje" : `Vence em ${dias} dia${dias === 1 ? "" : "s"}`;
    if (dias <= 7) return { label: texto, tom: "vermelho", dias };
    if (dias <= 15) return { label: texto, tom: "laranja", dias };
    if (dias <= 30) return { label: texto, tom: "amarelo", dias };
  }
  return { label: "Vigente", tom: "verde" };
}

/** Contrato vale hoje? (ativo e dentro do período) */
export function contratoVigente(c: ContratoBase) {
  const hoje = hojeISO();
  return c.status === "ativo" && c.data_inicio <= hoje && (!c.data_fim || c.data_fim >= hoje);
}

export function vigenciaTexto(c: { data_inicio: string; data_fim: string | null }) {
  return c.data_fim
    ? `${formatData(c.data_inicio)} a ${formatData(c.data_fim)}`
    : `Desde ${formatData(c.data_inicio)}`;
}
