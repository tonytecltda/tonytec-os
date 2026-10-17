/**
 * CPF e CNPJ (inclusive o CNPJ alfanumérico, vigente desde jul/2026).
 * Armazenamento: sem pontuação, em maiúsculas.
 */

/** Remove pontuação e coloca em maiúsculas: "12.abc.345/01de-35" -> "12ABC34501DE35". */
export function normalizarDocumento(valor: string | null | undefined): string {
  return (valor ?? "").replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

export function isCpfValido(valor: string): boolean {
  const cpf = normalizarDocumento(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digitos = cpf.split("").map(Number);
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += digitos[i] * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === digitos[9] && dv(10) === digitos[10];
}

/**
 * CNPJ numérico ou alfanumérico: 12 caracteres [0-9A-Z] + 2 dígitos verificadores.
 * Valor de cada caractere = código ASCII - 48 ('0'..'9' -> 0..9, 'A' -> 17 ... 'Z' -> 42).
 */
export function isCnpjValido(valor: string): boolean {
  const cnpj = normalizarDocumento(valor);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const valores = cnpj.split("").map((c) => c.charCodeAt(0) - 48);
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, peso, i) => acc + valores[i] * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(12) === valores[12] && dv(13) === valores[13];
}

export function isDocumentoValido(valor: string): boolean {
  const doc = normalizarDocumento(valor);
  return doc.length === 11 ? isCpfValido(doc) : isCnpjValido(doc);
}

/** Formata para exibição: 000.000.000-00 ou XX.XXX.XXX/XXXX-XX. */
export function formatarDocumento(valor: string | null | undefined): string {
  const doc = normalizarDocumento(valor);
  if (/^\d{11}$/.test(doc)) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (doc.length === 14) return doc.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
  return valor ?? "";
}
