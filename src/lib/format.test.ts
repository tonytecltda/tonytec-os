import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBRL, formatData } from "./format";
import { situacaoContrato } from "./contratos";

test("datas puras não mudam de dia por causa do fuso", () => {
  assert.equal(formatData("2026-01-01"), "01/01/2026");
  assert.equal(formatData("2026-12-31"), "31/12/2026");
  assert.equal(formatData(null), "—");
});

test("timestamps são exibidos em America/Sao_Paulo", () => {
  // 02:30 UTC = 23:30 do dia anterior em SP
  assert.equal(formatData("2026-03-10T02:30:00Z"), "09/03/2026");
});

test("moeda BRL", () => {
  assert.equal(formatBRL(1234.5).replace(/\s/g, " "), "R$ 1.234,50");
});

test("situação do contrato", () => {
  assert.equal(
    situacaoContrato({ status: "encerrado", data_inicio: "2020-01-01", data_fim: null }).label,
    "Encerrado",
  );
  assert.equal(
    situacaoContrato({ status: "ativo", data_inicio: "2020-01-01", data_fim: "2020-12-31" }).label,
    "Vencido",
  );
  assert.equal(
    situacaoContrato({ status: "ativo", data_inicio: "2020-01-01", data_fim: null }).label,
    "Vigente",
  );
  assert.equal(situacaoContrato({ status: "ativo", data_inicio: "2999-01-01", data_fim: null }).tom, "azul");
});

test("ISO -> datetime-local em Brasília", async () => {
  const { paraInputDataHora } = await import("./format");
  assert.equal(paraInputDataHora("2026-10-20T17:30:00Z"), "2026-10-20T14:30");
  assert.equal(paraInputDataHora(null), "");
});
