import { requireRole } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { AppShell } from "@/components/layout/app-shell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireRole("admin");
  return (
    <AppShell
      area="admin"
      user={{ nome: profile.nome, email: profile.email, papel: ROLE_LABEL[profile.role] }}
    >
      {children}
    </AppShell>
  );
}
