import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

type Regra = { max: number; janelaSeg: number };

/** Limites das rotas públicas (por IP e/ou por alvo). */
export const LIMITES = {
  loginEmail: { max: 8, janelaSeg: 600 },
  loginIp: { max: 40, janelaSeg: 600 },
  recuperarSenha: { max: 5, janelaSeg: 900 },
  ativarAcesso: { max: 20, janelaSeg: 600 },
  linkAssinaturaVer: { max: 60, janelaSeg: 600 },
  linkAssinaturaEnviar: { max: 12, janelaSeg: 600 },
} satisfies Record<string, Regra>;

export const MSG_MUITAS_TENTATIVAS = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

/** IP do cliente (a Vercel preenche x-forwarded-for / x-real-ip). */
export async function ipDoCliente() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
}

/** Chave estável sem guardar dados pessoais (e-mail/IP) em texto. */
const chave = (escopo: string, valor: string) =>
  `${escopo}:${createHash("sha256").update(valor.toLowerCase()).digest("hex").slice(0, 32)}`;

/**
 * Conta uma tentativa e informa se ainda está dentro do limite.
 * Se o banco falhar, libera (log no servidor): indisponibilidade do controle não derruba o login.
 */
export async function dentroDoLimite(escopo: string, valor: string, regra: Regra) {
  const { data, error } = await createAdminClient().rpc("checar_rate_limit", {
    p_chave: chave(escopo, valor),
    p_max: regra.max,
    p_janela_seg: regra.janelaSeg,
  });
  if (error) {
    console.error("[rate-limit]", error.message);
    return true;
  }
  return data !== false;
}

/** Só consulta (não conta): usado para bloquear depois de N falhas seguidas. */
export async function estaBloqueado(escopo: string, valor: string, regra: Regra) {
  const { data, error } = await createAdminClient().rpc("rate_limit_bloqueado", {
    p_chave: chave(escopo, valor),
    p_max: regra.max,
    p_janela_seg: regra.janelaSeg,
  });
  if (error) {
    console.error("[rate-limit]", error.message);
    return false;
  }
  return data === true;
}
