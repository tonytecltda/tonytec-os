import assert from "node:assert/strict";
import { test } from "node:test";
import { duracao, situacaoSla, slaPrincipal } from "./sla";

const agora = Date.parse("2026-10-19T12:00:00-03:00");
const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

test("duração legível", () => {
  assert.equal(duracao(25 * 60_000), "25 min");
  assert.equal(duracao(4 * H + 10 * 60_000), "4 h 10 min");
  assert.equal(duracao(51 * H), "2 d 3 h");
});

test("SLA cumprido, violado, estourado, vencendo e no prazo", () => {
  const inicio = iso(agora - 8 * H);
  assert.equal(situacaoSla(iso(agora + H), iso(agora - H), inicio, false, agora).estado, "cumprido");
  assert.equal(situacaoSla(iso(agora - 2 * H), iso(agora - H), inicio, false, agora).estado, "violado");
  assert.equal(situacaoSla(iso(agora - H), null, inicio, false, agora).estado, "estourado");
  // janela de 10 h, faltam 2 h (< 25%) -> vencendo
  assert.equal(situacaoSla(iso(agora + 2 * H), null, inicio, false, agora).estado, "vencendo");
  // janela de 16 h, faltam 8 h -> no prazo
  assert.equal(situacaoSla(iso(agora + 8 * H), null, inicio, false, agora).estado, "no_prazo");
  assert.equal(situacaoSla(null, null, inicio, false, agora).estado, "na");
  assert.equal(situacaoSla(iso(agora - H), null, inicio, true, agora).estado, "na");
});

test("SLA principal prioriza o mais crítico", () => {
  const c = {
    status: "aberto",
    created_at: iso(agora - 10 * H),
    sla_resposta_ate: iso(agora - H), // resposta estourada
    sla_solucao_ate: iso(agora + 20 * H),
    primeira_resposta_em: null,
    resolvido_em: null,
  };
  const p = slaPrincipal(c, agora);
  assert.equal(p.tipo, "Resposta");
  assert.equal(p.estado, "estourado");

  const respondido = { ...c, primeira_resposta_em: iso(agora - 2 * H) };
  assert.equal(slaPrincipal(respondido, agora).tipo, "Solução");
});
