import assert from "node:assert/strict";
import { test } from "node:test";
import { resolverPeriodo } from "./periodo";

// 17/10/2026 15:00 em Brasília
const agora = new Date("2026-10-17T18:00:00Z");

test("padrão: últimos 30 dias, inclusive hoje", () => {
  const p = resolverPeriodo({}, agora);
  assert.equal(p.preset, "30d");
  assert.equal(p.deData, "2026-09-18");
  assert.equal(p.ateData, "2026-10-17");
  assert.equal(p.de, "2026-09-18T00:00:00-03:00");
  assert.equal(p.ate, "2026-10-18T00:00:00-03:00"); // exclusivo: dia seguinte
});

test("hoje, 7 dias e mês", () => {
  assert.deepEqual(
    [resolverPeriodo({ periodo: "hoje" }, agora).deData, resolverPeriodo({ periodo: "hoje" }, agora).ateData],
    ["2026-10-17", "2026-10-17"],
  );
  assert.equal(resolverPeriodo({ periodo: "7d" }, agora).deData, "2026-10-11");
  assert.equal(resolverPeriodo({ periodo: "mes" }, agora).deData, "2026-10-01");
});

test("meia-noite de Brasília ainda é o dia anterior em UTC", () => {
  // 18/10 01:30 UTC = 17/10 22:30 em Brasília
  assert.equal(resolverPeriodo({ periodo: "hoje" }, new Date("2026-10-18T01:30:00Z")).deData, "2026-10-17");
});

test("personalizado: valida, ordena as datas e cai no padrão se inválido", () => {
  const ok = resolverPeriodo({ periodo: "custom", de: "2026-10-05", ate: "2026-10-09" }, agora);
  assert.equal(ok.preset, "custom");
  assert.equal(ok.ate, "2026-10-10T00:00:00-03:00");
  const invertido = resolverPeriodo({ periodo: "custom", de: "2026-10-09", ate: "2026-10-05" }, agora);
  assert.equal(invertido.deData, "2026-10-05");
  assert.equal(resolverPeriodo({ periodo: "custom", de: "xx", ate: "2026-10-05" }, agora).preset, "30d");
  assert.equal(resolverPeriodo({ periodo: "inexistente" }, agora).preset, "30d");
});

test("virada de mês e ano", () => {
  const p = resolverPeriodo({ periodo: "7d" }, new Date("2027-01-03T12:00:00Z"));
  assert.equal(p.deData, "2026-12-28");
});
