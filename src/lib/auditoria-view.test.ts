import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffAuditoria, rotuloAcao, rotuloRegistro, rotuloTabela } from "./auditoria-view";

describe("auditoria-view", () => {
  it("traduz tabelas e ações conhecidas e mantém as desconhecidas legíveis", () => {
    assert.equal(rotuloTabela("ordens_servico"), "Ordens de serviço");
    assert.equal(rotuloTabela("outra"), "outra");
    assert.equal(rotuloAcao("reabertura_os"), "Reabertura de OS");
    assert.equal(rotuloAcao("acao_nova_qualquer"), "acao nova qualquer");
  });

  it("identifica o registro pelo campo de cada tabela", () => {
    assert.equal(
      rotuloRegistro("ordens_servico", { numero: "OS-2026-000001" }, null, "abcdef12-0000"),
      "OS-2026-000001",
    );
    assert.equal(rotuloRegistro("clientes", null, { razao_social: "Alfa Ltda" }, null), "Alfa Ltda");
    assert.equal(rotuloRegistro("profiles", { nome: "  " }, null, "12345678-aaaa"), "12345678");
    assert.equal(rotuloRegistro("contratos", null, null, null), "—");
  });

  it("compara antes e depois sem campos de ruído", () => {
    const linhas = diffAuditoria({ role: "tecnico", updated_at: "x" }, { role: "admin", updated_at: "y" });
    assert.deepEqual(linhas, [{ campo: "role", antes: "tecnico", depois: "admin" }]);
  });

  it("criação e exclusão mostram um lado só; valores longos são cortados", () => {
    const criacao = diffAuditoria(null, { nome: "x".repeat(200), id: "1" });
    assert.equal(criacao.length, 1);
    assert.equal(criacao[0].antes, null);
    assert.equal(criacao[0].depois!.length, 118);
    const exclusao = diffAuditoria({ ativo: true }, null);
    assert.deepEqual(exclusao, [{ campo: "ativo", antes: "true", depois: null }]);
  });
});
