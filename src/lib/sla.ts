/**
 * Situação do SLA de um chamado (resposta ou solução), para exibição.
 * Os prazos (sla_*_ate) já vêm calculados pelo banco em horas úteis.
 */
export type SlaEstado = "cumprido" | "violado" | "no_prazo" | "vencendo" | "estourado" | "na";
export type SlaTom = "verde" | "vermelho" | "azul" | "amarelo" | "cinza";

export type SlaSituacao = { estado: SlaEstado; tom: SlaTom; texto: string };

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** "2 d 3 h", "4 h 10 min", "25 min" */
export function duracao(ms: number) {
  const abs = Math.abs(ms);
  if (abs >= DIA) {
    const d = Math.floor(abs / DIA);
    const h = Math.floor((abs % DIA) / HORA);
    return h ? `${d} d ${h} h` : `${d} d`;
  }
  if (abs >= HORA) {
    const h = Math.floor(abs / HORA);
    const m = Math.floor((abs % HORA) / MIN);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.max(1, Math.floor(abs / MIN))} min`;
}

/**
 * @param limite      prazo (sla_resposta_ate ou sla_solucao_ate)
 * @param concluidoEm quando foi cumprido (primeira_resposta_em ou resolvido_em)
 * @param inicio      abertura do chamado (para calcular a janela "vencendo")
 * @param cancelado   chamado cancelado não tem SLA
 */
export function situacaoSla(
  limite: string | null,
  concluidoEm: string | null,
  inicio: string,
  cancelado: boolean,
  agora: number = Date.now(),
): SlaSituacao {
  if (!limite) return { estado: "na", tom: "cinza", texto: "Sem SLA" };
  const lim = Date.parse(limite);

  if (concluidoEm) {
    return Date.parse(concluidoEm) <= lim
      ? { estado: "cumprido", tom: "verde", texto: "Cumprido" }
      : { estado: "violado", tom: "vermelho", texto: `Atrasou ${duracao(Date.parse(concluidoEm) - lim)}` };
  }
  if (cancelado) return { estado: "na", tom: "cinza", texto: "Cancelado" };

  const restante = lim - agora;
  if (restante < 0)
    return { estado: "estourado", tom: "vermelho", texto: `Estourado há ${duracao(restante)}` };

  // "Vencendo": últimos 25% da janela (mínimo de 30 minutos).
  const janela = Math.max(lim - Date.parse(inicio), 0);
  if (restante <= Math.max(30 * MIN, janela * 0.25)) {
    return { estado: "vencendo", tom: "amarelo", texto: `Vence em ${duracao(restante)}` };
  }
  return { estado: "no_prazo", tom: "azul", texto: `Vence em ${duracao(restante)}` };
}

type ChamadoSla = {
  status: string;
  created_at: string;
  sla_resposta_ate: string | null;
  sla_solucao_ate: string | null;
  primeira_resposta_em: string | null;
  resolvido_em: string | null;
};

export function slaDoChamado(c: ChamadoSla, agora: number = Date.now()) {
  const cancelado = c.status === "cancelado";
  return {
    resposta: situacaoSla(c.sla_resposta_ate, c.primeira_resposta_em, c.created_at, cancelado, agora),
    solucao: situacaoSla(c.sla_solucao_ate, c.resolvido_em, c.created_at, cancelado, agora),
  };
}

/** O SLA mais crítico do chamado (para um único indicador em cards/listas). */
export function slaPrincipal(c: ChamadoSla, agora: number = Date.now()): SlaSituacao & { tipo: string } {
  const { resposta, solucao } = slaDoChamado(c, agora);
  const ordem: SlaEstado[] = ["estourado", "violado", "vencendo", "no_prazo", "cumprido", "na"];
  const pendenteResposta = !c.primeira_resposta_em && resposta.estado !== "na";
  const candidatos = [
    ...(pendenteResposta ? [{ ...resposta, tipo: "Resposta" }] : []),
    { ...solucao, tipo: "Solução" },
  ];
  return candidatos.sort((a, b) => ordem.indexOf(a.estado) - ordem.indexOf(b.estado))[0];
}
