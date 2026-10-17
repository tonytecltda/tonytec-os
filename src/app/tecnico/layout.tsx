import { requireRole } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { AppShell } from "@/components/layout/app-shell";

export default async function TecnicoLayout({ children }: LayoutProps<"/tecnico">) {
  const profile = await requireRole("tecnico");
  return (
    <AppShell
      area="tecnico"
      user={{ nome: profile.nome, email: profile.email, papel: ROLE_LABEL[profile.role] }}
    >
      {children}
    </AppShell>
  );
}
