import assert from "node:assert/strict";
import { test } from "node:test";
import { gerarCsv, mesPorExtenso, mesValido, nomeArquivo } from "./export";

test("CSV brasileiro: BOM, ponto e vírgula, vírgula decimal e escape", () => {
  const csv = gerarCsv(
    [
      { titulo: "Cliente" },
      { titulo: "Valor", formato: "moeda" },
      { titulo: "Horas", formato: "numero" },
      { titulo: "Faturado" },
    ],
    [['Condomínio; "Alfa"', 1234.5, 1.25, true]],
  );
  assert.ok(csv.startsWith("﻿Cliente;Valor;Horas;Faturado\r\n"));
  assert.ok(csv.includes('"Condomínio; ""Alfa""";1234,50;1,25;Sim'));
});

test("CSV neutraliza fórmulas de planilha", () => {
  const csv = gerarCsv([{ titulo: "Nota" }], [['=HIPERLINK("http://x")'], ["+55 11"], ["normal"]]);
  assert.ok(csv.includes("'=HIPERLINK"));
  assert.ok(csv.includes("'+55 11"));
  assert.ok(csv.includes("\r\nnormal\r\n"));
});

test("CSV formata datas no fuso de Brasília", () => {
  const csv = gerarCsv([{ titulo: "Data", formato: "datahora" }], [[new Date("2026-10-18T02:30:00Z")]]);
  assert.ok(csv.includes("17/10/2026 23:30"));
});

test("nome de arquivo e meses", () => {
  assert.equal(
    nomeArquivo("Fechamento", "Condomínio Alfa (DEMO)", "2026-10"),
    "fechamento-condominio-alfa-demo-2026-10",
  );
  assert.equal(mesValido("2026-10"), true);
  assert.equal(mesValido("2026-13"), false);
  assert.equal(mesPorExtenso("2026-03"), "março de 2026");
});
