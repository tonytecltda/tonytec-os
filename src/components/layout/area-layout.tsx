import { requireRole } from "@/lib/auth";
import { getEmpresaPublica } from "@/lib/config";
import { ROLE_LABEL, type UserRole } from "@/lib/roles";
import { AppShell } from "./app-shell";
import type { Area } from "./nav-config";

/** Layout comum das áreas: confere a role no servidor e monta o shell com a marca da empresa. */
export async function AreaLayout({
  area,
  role,
  children,
}: {
  area: Area;
  role: UserRole;
  children: React.ReactNode;
}) {
  const [profile, empresa] = await Promise.all([requireRole(role), getEmpresaPublica()]);
  return (
    <AppShell
      area={area}
      empresa={{ nome: empresa.nome, logoUrl: empresa.logoUrl }}
      user={{ nome: profile.nome, email: profile.email, papel: ROLE_LABEL[profile.role] }}
    >
      {children}
    </AppShell>
  );
}
