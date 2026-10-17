import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatarDocumento,
  isCnpjValido,
  isCpfValido,
  isDocumentoValido,
  normalizarDocumento,
} from "./documentos";

test("CPF válido e inválido", () => {
  assert.equal(isCpfValido("529.982.247-25"), true);
  assert.equal(isCpfValido("52998224725"), true);
  assert.equal(isCpfValido("529.982.247-24"), false);
  assert.equal(isCpfValido("111.111.111-11"), false);
  assert.equal(isCpfValido("123"), false);
});

test("CNPJ numérico", () => {
  assert.equal(isCnpjValido("11.222.333/0001-81"), true);
  assert.equal(isCnpjValido("00.000.000/0001-91"), true);
  assert.equal(isCnpjValido("11.222.333/0001-80"), false);
  assert.equal(isCnpjValido("00000000000000"), false);
});

test("CNPJ alfanumérico (exemplo oficial da Receita: 12.ABC.345/01DE-35)", () => {
  assert.equal(isCnpjValido("12.ABC.345/01DE-35"), true);
  assert.equal(isCnpjValido("12abc34501de35"), true);
  assert.equal(isCnpjValido("12.ABC.345/01DE-36"), false);
  // DV não pode ser letra
  assert.equal(isCnpjValido("12ABC34501DE3A"), false);
});

test("normaliza e formata", () => {
  assert.equal(normalizarDocumento(" 12.abc.345/01de-35 "), "12ABC34501DE35");
  assert.equal(formatarDocumento("12ABC34501DE35"), "12.ABC.345/01DE-35");
  assert.equal(formatarDocumento("52998224725"), "529.982.247-25");
  assert.equal(isDocumentoValido("529.982.247-25"), true);
  assert.equal(isDocumentoValido("12.ABC.345/01DE-35"), true);
});
