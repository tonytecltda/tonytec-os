import { createHash } from "node:crypto";

/**
 * Conteúdo da OS que é "assinado": qualquer mudança aqui muda o hash.
 * Campos de controle (status, datas de encerramento, caminho do PDF) ficam de fora.
 */
export type ConteudoOs = {
  numero: string;
  protocolo: string | null;
  cliente: { razao_social: string; cnpj_cpf: string | null };
  unidade: { nome: string; endereco: string } | null;
  tecnico: string | null;
  tipo_atendimento: string;
  problema_relatado: string | null;
  diagnostico: string | null;
  servico_executado: string | null;
  observacoes_tecnicas: string | null;
  recomendacoes: string | null;
  pendencias: boolean;
  pendencias_texto: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  visitas: { chegada: string; saida: string | null; horas: number | null }[];
  itens: { descricao: string; tipo: string; quantidade: number; valor_unitario: number; cobrado: boolean }[];
  anexos: { tipo: string; caminho: string }[];
  termo: string;
};

/** JSON estável: chaves ordenadas, sem espaços, números normalizados. */
export function canonicalizar(valor: unknown): string {
  if (valor === null || valor === undefined) return "null";
  if (typeof valor === "number") return Number.isFinite(valor) ? JSON.stringify(Number(valor)) : "null";
  if (typeof valor === "string" || typeof valor === "boolean") return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(canonicalizar).join(",")}]`;
  if (typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    const chaves = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${canonicalizar(obj[k])}`).join(",")}}`;
  }
  return "null";
}

/** SHA-256 (hex) do conteúdo canônico da OS. */
export function hashConteudoOs(conteudo: ConteudoOs): string {
  return createHash("sha256").update(canonicalizar(conteudo), "utf8").digest("hex");
}

/** SHA-256 de um token de link (só o hash fica no banco). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
