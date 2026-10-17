import assert from "node:assert/strict";
import { test } from "node:test";
import { inicioSemana, mes, navegar, nomeMes, novoHorario, semana, somarDias, tituloSemana } from "./agenda";

test("semana começa na segunda-feira", () => {
  // 17/10/2026 é sábado
  assert.equal(inicioSemana("2026-10-17"), "2026-10-12");
  assert.equal(inicioSemana("2026-10-12"), "2026-10-12"); // segunda
  assert.equal(inicioSemana("2026-10-18"), "2026-10-12"); // domingo pertence à semana anterior
  const s = semana("2026-10-17");
  assert.deepEqual([s.dias[0], s.dias[6], s.fimExclusivo], ["2026-10-12", "2026-10-18", "2026-10-19"]);
  assert.equal(tituloSemana(s.dias), "12/10 a 18/10 de 2026");
});

test("grade do mês cobre semanas completas", () => {
  const m = mes("2026-10-17");
  assert.equal(m.dias.length % 7, 0);
  assert.equal(m.dias[0], "2026-09-28"); // 1/10/2026 é quinta; a grade começa na segunda anterior
  assert.equal(m.dias.at(-1), "2026-11-01"); // 31/10 é sábado; fecha no domingo
  assert.equal(m.mesRef, "2026-10");
  assert.equal(mes("2027-02-10").dias.length, 28); // 1/2/2027 é segunda e 28/2 é domingo: 4 semanas exatas
  assert.equal(mes("2026-02-10").dias.length, 35); // 1/2/2026 é domingo: a grade começa na segunda anterior
});

test("navegação por semana e por mês", () => {
  assert.equal(navegar("2026-10-17", "semana", 1), "2026-10-24");
  assert.equal(navegar("2026-10-17", "semana", -1), "2026-10-10");
  assert.equal(navegar("2026-10-17", "mes", 1), "2026-11-01");
  assert.equal(navegar("2026-12-20", "mes", 1), "2027-01-01");
  assert.equal(navegar("2026-01-20", "mes", -1), "2025-12-01");
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(nomeMes("2026-03-05"), "março de 2026");
});

test("reagendar mantém a hora ou usa 09:00", () => {
  assert.equal(novoHorario("2026-10-20", "2026-10-17T14:30"), "2026-10-20T14:30");
  assert.equal(novoHorario("2026-10-20", null), "2026-10-20T09:00");
  assert.equal(novoHorario("2026-10-20", ""), "2026-10-20T09:00");
});
