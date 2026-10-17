import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

/**
 * URL base para links enviados aos usuários. Usa NEXT_PUBLIC_APP_URL quando
 * configurada com um domínio real; senão, a origem da requisição atual
 * (evita links "localhost" se a variável não for configurada na Vercel).
 */
export async function origemApp(): Promise<string> {
  const configurada = publicEnv.NEXT_PUBLIC_APP_URL;
  if (!/localhost|127\.0\.0\.1/.test(configurada)) return configurada.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return configurada;
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Gera um link de uso único para o usuário definir/redefinir a senha.
 * Não envia e-mail: o admin compartilha o link (WhatsApp/e-mail).
 * O link leva a /acesso, que só consome o token quando o usuário clica em "Continuar".
 */
export async function gerarLinkDefinicaoSenha(email: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    console.error("[acesso] generateLink", error);
    throw new Error("Não foi possível gerar o link de acesso.");
  }
  return `${await origemApp()}/acesso?token=${encodeURIComponent(token)}&tipo=recovery`;
}

/** Último acesso de cada usuário (via Auth Admin API). */
export async function ultimosAcessos(): Promise<Map<string, string | null>> {
  const admin = createAdminClient();
  const mapa = new Map<string, string | null>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[acesso] listUsers", error);
      break;
    }
    data.users.forEach((u) => mapa.set(u.id, u.last_sign_in_at ?? null));
    if (data.users.length < 1000) break;
  }
  return mapa;
}
