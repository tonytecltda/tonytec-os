import { normalizarDocumento } from "@/lib/documentos";

/** Máscaras aplicadas enquanto o usuário digita. */

export function mascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascaraCep(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** CPF até 11 dígitos numéricos; com letras ou mais de 11 caracteres vira CNPJ (alfanumérico). */
export function mascaraDocumento(valor: string): string {
  const v = normalizarDocumento(valor).slice(0, 14);
  const ehCpf = v.length <= 11 && /^\d*$/.test(v);
  if (ehCpf) {
    if (v.length <= 3) return v;
    if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
    if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
    return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  }
  let out = v.slice(0, 2);
  if (v.length > 2) out += `.${v.slice(2, 5)}`;
  if (v.length > 5) out += `.${v.slice(5, 8)}`;
  if (v.length > 8) out += `/${v.slice(8, 12)}`;
  if (v.length > 12) out += `-${v.slice(12)}`;
  return out;
}

export type Mascara = "telefone" | "cep" | "documento";

export const MASCARAS: Record<Mascara, (v: string) => string> = {
  telefone: mascaraTelefone,
  cep: mascaraCep,
  documento: mascaraDocumento,
};

/** Só dígitos (para links de WhatsApp/tel). */
export const somenteDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
