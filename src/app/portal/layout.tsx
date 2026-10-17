import { requireRole } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { AppShell } from "@/components/layout/app-shell";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const profile = await requireRole("cliente");
  return (
    <AppShell
      area="portal"
      user={{ nome: profile.nome, email: profile.email, papel: ROLE_LABEL[profile.role] }}
    >
      {children}
    </AppShell>
  );
}
