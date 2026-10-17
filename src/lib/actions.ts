import type { z } from "zod";

/** Retorno padrão das Server Actions (serializável para o cliente). */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = <T>(data: T, message?: string): ActionResult<T> => ({ ok: true, data, message });

export const fail = (error: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({
  ok: false,
  error,
  fieldErrors,
});

/** Converte erros do zod em mensagem + mapa campo -> mensagem. */
export function zodFail(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail(error.issues[0]?.message ?? "Dados inválidos.", fieldErrors);
}

/** Mensagens amigáveis para violações de constraints conhecidas. */
const CONSTRAINTS: Record<string, string> = {
  clientes_cnpj_cpf_uniq: "Já existe um cliente ativo com este CPF/CNPJ.",
  clientes_documento_formato: "CPF/CNPJ inválido.",
  unidades_uf_formato: "UF inválida.",
  contratos_numero_key: "Já existe um contrato com este número.",
  contratos_periodo_valido: "A data de fim deve ser igual ou posterior à data de início.",
  categorias_servico_nome_key: "Já existe uma categoria com este nome.",
  tipos_problema_categoria_id_nome_key: "Já existe este tipo de problema nesta categoria.",
  profiles_cliente_requer_cliente_id: "Usuário de cliente precisa estar vinculado a um cliente.",
};

type DbError = { code?: string; message?: string; details?: string | null } | null | undefined;

/**
 * Traduz erros do Postgres/PostgREST. Mensagens lançadas pelos nossos triggers
 * (RAISE com errcode 42501/23514) já estão em português e são repassadas.
 */
export function dbErrorMessage(
  error: DbError,
  fallback = "Não foi possível salvar. Tente novamente.",
): string {
  if (!error) return fallback;
  const texto = `${error.message ?? ""} ${error.details ?? ""}`;
  for (const [constraint, msg] of Object.entries(CONSTRAINTS)) {
    if (texto.includes(constraint)) return msg;
  }
  switch (error.code) {
    case "23505":
      return "Já existe um registro com esses dados.";
    case "23503":
      return "Registro relacionado não encontrado ou ainda em uso.";
    case "42501":
    case "23514":
    case "P0001":
    case "22023":
      // Mensagens dos nossos triggers (em português). Evita repassar mensagens técnicas em inglês.
      return error.message && !/violates|permission denied|row-level security/i.test(error.message)
        ? error.message
        : "Operação não permitida.";
    default:
      console.error("[db]", error);
      return fallback;
  }
}

/** Converte "" em null (campos opcionais de texto). */
export const nullIfEmpty = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};
