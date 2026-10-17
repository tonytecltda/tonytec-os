/**
 * Regras de cobrança de visitas (funções puras, testáveis).
 *
 * Tipos: isento_contrato | valor_unico | valor_por_hora | garantia | cortesia.
 * Garantia e cortesia são decididas pelo admin (valor zero + justificativa);
 * aqui calculamos a SUGESTÃO automática a partir do contrato vigente.
 */

export type TipoCobranca = "isento_contrato" | "valor_unico" | "valor_por_hora" | "garantia" | "cortesia";
export type PoliticaExcedente = "valor_unico" | "valor_hora" | "isento";

export type ConfigCobranca = {
  valor_hora_padrao: number;
  valor_visita_padrao: number;
  minimo_horas_cobraveis: number;
  fracao_minutos: number;
};

export type ContratoCobranca = {
  id: string;
  visitas_inclusas_mes: number;
  horas_inclusas_mes: number;
  politica_visita_excedente: PoliticaExcedente;
  valor_visita_excedente: number | null;
  valor_hora_excedente: number | null;
};

/** O que o cliente já consumiu da franquia no mês, antes desta visita. */
export type ConsumoMes = { visitas: number; horas: number };

export type SugestaoCobranca = {
  tipo: TipoCobranca;
  valor_unitario: number;
  /** Horas cobráveis (arredondadas) quando a cobrança é por hora; senão null. */
  quantidade_horas: number | null;
  /** Horas desta visita cobertas pela franquia do contrato. */
  horas_franquia: number;
  /** Explicação em português para o admin. */
  motivo: string;
};

const arred2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Horas cobráveis: arredonda PARA CIMA na fração configurada e aplica o mínimo.
 * Ex.: fração 15, mínimo 1h → 20 min = 1,00 h; 1h10 = 1,25 h; 2h01 = 2,25 h.
 */
export function horasCobraveis(horasTrabalhadas: number, fracaoMinutos: number, minimoHoras: number): number {
  const fracao = Math.max(1, fracaoMinutos);
  // tolera ruído de ponto flutuante (ex.: 1,25 h = 75,00000001 min)
  const minutos = Math.round(Math.max(0, horasTrabalhadas) * 60 * 1000) / 1000;
  const arredondados = Math.ceil(minutos / fracao - 1e-9) * fracao;
  return arred2(Math.max(arredondados / 60, minimoHoras));
}

export function calcularCobranca(p: {
  horasTrabalhadas: number | null;
  contrato: ContratoCobranca | null;
  consumo: ConsumoMes;
  config: ConfigCobranca;
}): SugestaoCobranca {
  const { contrato, consumo, config } = p;
  const horas = horasCobraveis(p.horasTrabalhadas ?? 0, config.fracao_minutos, config.minimo_horas_cobraveis);

  if (!contrato) {
    return {
      tipo: "valor_unico",
      valor_unitario: config.valor_visita_padrao,
      quantidade_horas: null,
      horas_franquia: 0,
      motivo: "Cliente sem contrato vigente: valor padrão da visita.",
    };
  }

  const V = contrato.visitas_inclusas_mes;
  const H = contrato.horas_inclusas_mes;

  const isentoPorContrato = (franquia: number, motivo: string): SugestaoCobranca => ({
    tipo: "isento_contrato",
    valor_unitario: 0,
    quantidade_horas: horas,
    horas_franquia: franquia,
    motivo,
  });

  // Excedente: segue a política do contrato (valores do contrato ou padrão das Configurações).
  const excedente = (horasExcedentes: number, franquia: number, motivo: string): SugestaoCobranca => {
    switch (contrato.politica_visita_excedente) {
      case "isento":
        return isentoPorContrato(franquia, `${motivo} Política do contrato: excedente sem cobrança.`);
      case "valor_hora":
        return {
          tipo: "valor_por_hora",
          valor_unitario: contrato.valor_hora_excedente ?? config.valor_hora_padrao,
          quantidade_horas: horasExcedentes,
          horas_franquia: franquia,
          motivo: `${motivo} Cobrança por hora (${horasExcedentes} h).`,
        };
      case "valor_unico":
      default:
        return {
          tipo: "valor_unico",
          valor_unitario: contrato.valor_visita_excedente ?? config.valor_visita_padrao,
          quantidade_horas: null,
          horas_franquia: franquia,
          motivo: `${motivo} Valor fixo por visita.`,
        };
    }
  };

  // Contrato sem franquia (ex.: avulso): tudo é excedente.
  if (V === 0 && H === 0) return excedente(horas, 0, "Contrato sem visitas/horas inclusas.");

  // Franquia por visitas (com ou sem limite de horas)
  if (V > 0) {
    const visitasOk = consumo.visitas < V;
    const horasOk = H === 0 || consumo.horas + horas <= H + 1e-9;
    if (visitasOk && horasOk) {
      return isentoPorContrato(horas, `Dentro da franquia: visita ${consumo.visitas + 1} de ${V} no mês.`);
    }
    return excedente(
      horas,
      0,
      !visitasOk
        ? `Franquia de ${V} visita(s) no mês já utilizada.`
        : `Franquia de ${H} h no mês seria ultrapassada (${consumo.horas} h já usadas).`,
    );
  }

  // Franquia só por horas (V = 0, H > 0): horas dentro do saldo são isentas; o resto é excedente.
  const saldo = Math.max(0, arred2(H - consumo.horas));
  if (horas <= saldo + 1e-9) {
    return isentoPorContrato(horas, `Dentro da franquia de ${H} h: saldo anterior de ${saldo} h.`);
  }
  const franquia = saldo;
  const horasExcedentes = arred2(horas - saldo);
  return excedente(horasExcedentes, franquia, `Franquia de ${H} h no mês excedida (saldo de ${saldo} h).`);
}

/** Valor total da visita (espelha a coluna gerada os_visitas.valor_total). */
export function valorVisita(v: {
  tipo: TipoCobranca | null;
  valor_unitario: number | null;
  quantidade_horas: number | null;
}): number {
  if (v.tipo === "valor_unico") return arred2(v.valor_unitario ?? 0);
  if (v.tipo === "valor_por_hora") return arred2((v.quantidade_horas ?? 0) * (v.valor_unitario ?? 0));
  return 0;
}
