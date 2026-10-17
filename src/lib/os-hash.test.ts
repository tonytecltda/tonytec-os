import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalizar, hashConteudoOs, type ConteudoOs } from "./os-hash";

const base: ConteudoOs = {
  numero: "OS-2026-000001",
  protocolo: "CH-2026-000001",
  cliente: { razao_social: "Cliente X", cnpj_cpf: "11222333000181" },
  unidade: { nome: "Matriz", endereco: "Rua A, 1" },
  tecnico: "Técnico",
  tipo_atendimento: "corretivo",
  problema_relatado: "Sem imagem",
  diagnostico: "Fonte queimada",
  servico_executado: "Troca da fonte",
  observacoes_tecnicas: null,
  recomendacoes: null,
  pendencias: false,
  pendencias_texto: null,
  data_inicio: "2026-10-18T12:00:00Z",
  data_fim: "2026-10-18T13:00:00Z",
  visitas: [{ chegada: "2026-10-18T12:00:00Z", saida: "2026-10-18T13:00:00Z", horas: 1 }],
  itens: [{ descricao: "Fonte 12V", tipo: "material", quantidade: 1, valor_unitario: 45, cobrado: true }],
  anexos: [{ tipo: "foto_antes", caminho: "a/b/c.jpg" }],
  termo: "Declaro…",
};

test("JSON canônico independe da ordem das chaves", () => {
  assert.equal(
    canonicalizar({ b: 1, a: [2, { d: true, c: null }] }),
    canonicalizar({ a: [2, { c: null, d: true }], b: 1 }),
  );
  assert.equal(canonicalizar({ a: 1, b: undefined }), '{"a":1}');
});

test("hash é estável e muda quando o conteúdo muda", () => {
  const h1 = hashConteudoOs(base);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.equal(hashConteudoOs({ ...base }), h1);
  assert.notEqual(hashConteudoOs({ ...base, servico_executado: "Troca da fonte e do cabo" }), h1);
  assert.notEqual(hashConteudoOs({ ...base, itens: [{ ...base.itens[0], quantidade: 2 }] }), h1);
});
