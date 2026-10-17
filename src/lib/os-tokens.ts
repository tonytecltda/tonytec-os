import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/os-hash";

export const MAX_TENTATIVAS_LINK = 10;

/** Cria um link de assinatura remota (invalida os anteriores da mesma OS). */
export async function criarTokenAssinatura(osId: string, horasValidade: number, criadoPor: string | null) {
  const sa = createAdminClient();
  const token = randomBytes(32).toString("base64url"); // 256 bits: impossível de adivinhar
  const expiraEm = new Date(Date.now() + horasValidade * 3_600_000).toISOString();
  await sa
    .from("os_assinatura_tokens")
    .update({ usado_em: new Date().toISOString() })
    .eq("os_id", osId)
    .is("usado_em", null);
  const { error } = await sa.from("os_assinatura_tokens").insert({
    os_id: osId,
    token_hash: hashToken(token),
    expira_em: expiraEm,
    criado_por: criadoPor,
  });
  if (error) throw new Error(`Falha ao criar o link: ${error.message}`);
  return { token, expiraEm };
}

export type TokenValido = { id: string; osId: string; expiraEm: string; tentativas: number };

/**
 * Confere o token do link (só o hash é guardado). Não consome o token:
 * isso acontece no encerramento da OS.
 */
export async function validarTokenAssinatura(
  token: string,
): Promise<{ ok: true; token: TokenValido } | { ok: false; erro: string }> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return { ok: false, erro: "Link inválido." };
  const sa = createAdminClient();
  const { data } = await sa
    .from("os_assinatura_tokens")
    .select("id, os_id, expira_em, usado_em, tentativas, ordens_servico(status, finalizada_em)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data) return { ok: false, erro: "Link inválido." };
  if (data.ordens_servico?.finalizada_em)
    return { ok: false, erro: "Esta ordem de serviço já foi assinada." };
  if (data.usado_em) return { ok: false, erro: "Este link não é mais válido. Peça um novo link à Tonytec." };
  if (Date.parse(data.expira_em) < Date.now())
    return { ok: false, erro: "Este link expirou. Peça um novo link à Tonytec." };
  if (data.tentativas >= MAX_TENTATIVAS_LINK)
    return { ok: false, erro: "Muitas tentativas com este link. Peça um novo à Tonytec." };
  if (data.ordens_servico?.status !== "aguardando_assinatura") {
    return { ok: false, erro: "Esta ordem de serviço não está aguardando assinatura." };
  }
  return {
    ok: true,
    token: { id: data.id, osId: data.os_id, expiraEm: data.expira_em, tentativas: data.tentativas },
  };
}

export async function registrarTentativaToken(tokenId: string, tentativasAtuais: number) {
  await createAdminClient()
    .from("os_assinatura_tokens")
    .update({ tentativas: tentativasAtuais + 1 })
    .eq("id", tokenId);
}
