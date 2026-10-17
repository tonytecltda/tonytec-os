import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, type UserRole } from "@/lib/roles";

export type CurrentProfile = {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  cliente_id: string | null;
};

/** Claims do JWT da sessão atual (ou null), uma vez por request. */
export const getSessionClaims = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
});

/**
 * Perfil do usuário logado, lido do BANCO (fonte da verdade), uma vez por request.
 * Retorna null se não houver sessão ou o perfil estiver inativo/inexistente.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const claims = await getSessionClaims();
  if (!claims?.sub) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, email, role, cliente_id, ativo")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile || !profile.ativo) return null;
  return {
    id: profile.id,
    nome: profile.nome,
    email: profile.email,
    role: profile.role,
    cliente_id: profile.cliente_id,
  };
});

/**
 * Garante que o usuário logado tem uma das roles. Use no topo de layouts,
 * páginas, Server Actions e Route Handlers protegidos.
 */
export async function requireRole(...roles: UserRole[]): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    // Sessão válida mas perfil inativo/inexistente: não mandar para /login
    // (o proxy devolveria para a área da role, gerando loop).
    redirect((await getSessionClaims()) ? "/sem-acesso" : "/login");
  }
  if (!roles.includes(profile.role)) redirect(ROLE_HOME[profile.role]);
  return profile;
}

export const requireAdmin = () => requireRole("admin");
