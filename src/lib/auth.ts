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

/**
 * Perfil do usuário logado, lido do BANCO (fonte da verdade), uma vez por request.
 * Retorna null se não houver sessão ou o perfil estiver inativo.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, email, role, cliente_id, ativo")
    .eq("id", userId)
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
  if (!profile) redirect("/login");
  if (!roles.includes(profile.role)) redirect(ROLE_HOME[profile.role]);
  return profile;
}
