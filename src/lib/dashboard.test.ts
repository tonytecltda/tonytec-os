import assert from "node:assert/strict";
import { test } from "node:test";

import { horasLegivel, pct } from "./dashboard-formatos";

test("percentual", () => {
  assert.equal(pct(47, 50), "94%");
  assert.equal(pct(1, 3), "33,3%");
  assert.equal(pct(0, 0), "—");
});

test("horas legíveis", () => {
  assert.equal(horasLegivel(0.5), "30 min");
  assert.equal(horasLegivel(1), "1 h");
  assert.equal(horasLegivel(2.25), "2 h 15 min");
  assert.equal(horasLegivel(26.5), "1 d 2 h 30 min");
  assert.equal(horasLegivel(null), "—");
});
