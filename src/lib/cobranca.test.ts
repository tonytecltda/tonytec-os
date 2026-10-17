import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calcularCobranca,
  horasCobraveis,
  valorVisita,
  type ConfigCobranca,
  type ContratoCobranca,
} from "./cobranca";

const config: ConfigCobranca = {
  valor_hora_padrao: 150,
  valor_visita_padrao: 180,
  minimo_horas_cobraveis: 1,
  fracao_minutos: 15,
};

const contrato = (p: Partial<ContratoCobranca> = {}): ContratoCobranca => ({
  id: "c1",
  visitas_inclusas_mes: 2,
  horas_inclusas_mes: 4,
  politica_visita_excedente: "valor_hora",
  valor_visita_excedente: null,
  valor_hora_excedente: 120,
  ...p,
});

test("horas cobráveis: fração para cima e mínimo", () => {
  assert.equal(horasCobraveis(20 / 60, 15, 1), 1); // 20 min -> mínimo de 1 h
  assert.equal(horasCobraveis(1 + 10 / 60, 15, 1), 1.25); // 1h10 -> 1h15
  assert.equal(horasCobraveis(1.25, 15, 1), 1.25); // exatamente 75 min não sobe
  assert.equal(horasCobraveis(2 + 1 / 60, 15, 1), 2.25); // 2h01 -> 2h15
  assert.equal(horasCobraveis(1.5, 30, 0), 1.5);
  assert.equal(horasCobraveis(0, 15, 0), 0);
  assert.equal(horasCobraveis(0.5, 60, 0), 1); // hora cheia
});

test("sem contrato: valor único padrão", () => {
  const s = calcularCobranca({
    horasTrabalhadas: 2,
    contrato: null,
    consumo: { visitas: 0, horas: 0 },
    config,
  });
  assert.equal(s.tipo, "valor_unico");
  assert.equal(s.valor_unitario, 180);
  assert.equal(s.quantidade_horas, null);
});

test("franquia de visitas e horas: dentro, depois excedente por hora", () => {
  const c = contrato();
  const v1 = calcularCobranca({
    horasTrabalhadas: 1,
    contrato: c,
    consumo: { visitas: 0, horas: 0 },
    config,
  });
  assert.equal(v1.tipo, "isento_contrato");
  assert.equal(v1.horas_franquia, 1);
  const v2 = calcularCobranca({
    horasTrabalhadas: 1.5,
    contrato: c,
    consumo: { visitas: 1, horas: 1 },
    config,
  });
  assert.equal(v2.tipo, "isento_contrato");
  assert.equal(v2.horas_franquia, 1.5);
  const v3 = calcularCobranca({
    horasTrabalhadas: 2,
    contrato: c,
    consumo: { visitas: 2, horas: 2.5 },
    config,
  });
  assert.equal(v3.tipo, "valor_por_hora");
  assert.equal(v3.quantidade_horas, 2);
  assert.equal(v3.valor_unitario, 120);
  assert.equal(valorVisita(v3), 240);
  const v4 = calcularCobranca({
    horasTrabalhadas: 20 / 60,
    contrato: c,
    consumo: { visitas: 3, horas: 4.5 },
    config,
  });
  assert.equal(v4.quantidade_horas, 1); // mínimo
  assert.equal(valorVisita(v4), 120);
});

test("visita que estouraria as horas da franquia vira excedente inteira", () => {
  const s = calcularCobranca({
    horasTrabalhadas: 3,
    contrato: contrato(),
    consumo: { visitas: 1, horas: 2 }, // 2 + 3 > 4
    config,
  });
  assert.equal(s.tipo, "valor_por_hora");
  assert.equal(s.quantidade_horas, 3);
  assert.equal(s.horas_franquia, 0);
});

test("política valor_unico usa o valor do contrato ou o padrão", () => {
  const consumo = { visitas: 2, horas: 0 };
  const a = calcularCobranca({
    horasTrabalhadas: 1,
    contrato: contrato({ politica_visita_excedente: "valor_unico", valor_visita_excedente: 99 }),
    consumo,
    config,
  });
  assert.deepEqual([a.tipo, a.valor_unitario, valorVisita(a)], ["valor_unico", 99, 99]);
  const b = calcularCobranca({
    horasTrabalhadas: 1,
    contrato: contrato({ politica_visita_excedente: "valor_unico", valor_visita_excedente: null }),
    consumo,
    config,
  });
  assert.equal(b.valor_unitario, 180);
});

test("política isento: excedente sem cobrança", () => {
  const s = calcularCobranca({
    horasTrabalhadas: 5,
    contrato: contrato({ politica_visita_excedente: "isento" }),
    consumo: { visitas: 9, horas: 99 },
    config,
  });
  assert.equal(s.tipo, "isento_contrato");
  assert.equal(valorVisita(s), 0);
});

test("contrato só de horas: saldo parcial vira cobrança só do excedente", () => {
  const c = contrato({ visitas_inclusas_mes: 0, horas_inclusas_mes: 4 });
  const dentro = calcularCobranca({
    horasTrabalhadas: 3,
    contrato: c,
    consumo: { visitas: 0, horas: 0 },
    config,
  });
  assert.equal(dentro.tipo, "isento_contrato");
  assert.equal(dentro.horas_franquia, 3);
  const parcial = calcularCobranca({
    horasTrabalhadas: 3,
    contrato: c,
    consumo: { visitas: 1, horas: 3 },
    config,
  });
  assert.equal(parcial.tipo, "valor_por_hora");
  assert.equal(parcial.horas_franquia, 1); // saldo de 1 h
  assert.equal(parcial.quantidade_horas, 2); // 3 h - 1 h
  assert.equal(valorVisita(parcial), 240);
  const esgotado = calcularCobranca({
    horasTrabalhadas: 1,
    contrato: c,
    consumo: { visitas: 2, horas: 4 },
    config,
  });
  assert.equal(esgotado.horas_franquia, 0);
  assert.equal(esgotado.quantidade_horas, 1);
});

test("contrato sem franquia (avulso): tudo é excedente", () => {
  const s = calcularCobranca({
    horasTrabalhadas: 2,
    contrato: contrato({
      visitas_inclusas_mes: 0,
      horas_inclusas_mes: 0,
      politica_visita_excedente: "valor_unico",
      valor_visita_excedente: 200,
    }),
    consumo: { visitas: 0, horas: 0 },
    config,
  });
  assert.equal(valorVisita(s), 200);
});

test("valorVisita: isento, garantia e cortesia são zero", () => {
  assert.equal(valorVisita({ tipo: "isento_contrato", valor_unitario: 50, quantidade_horas: 2 }), 0);
  assert.equal(valorVisita({ tipo: "garantia", valor_unitario: 50, quantidade_horas: 2 }), 0);
  assert.equal(valorVisita({ tipo: "cortesia", valor_unitario: 50, quantidade_horas: 2 }), 0);
  assert.equal(valorVisita({ tipo: "valor_por_hora", valor_unitario: 33.33, quantidade_horas: 1.25 }), 41.66);
});
