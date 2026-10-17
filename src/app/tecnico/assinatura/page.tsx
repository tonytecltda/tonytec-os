import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { MinhaAssinaturaForm } from "./minha-assinatura-form";

export const metadata = { title: "Minha assinatura" };

export default async function MinhaAssinaturaPage() {
  const perfil = await requireRole("tecnico");
  const sa = createAdminClient();
  const { data } = await sa.from("profiles").select("assinatura_path").eq("id", perfil.id).single();
  const url = data?.assinatura_path
    ? ((await sa.storage.from("assinaturas").createSignedUrl(data.assinatura_path, 600)).data?.signedUrl ??
      null)
    : null;
  return (
    <>
      <PageHeader
        titulo="Minha assinatura"
        descricao="Salve sua assinatura para não precisar desenhar a cada OS. Ela é copiada para cada OS no momento da assinatura."
      />
      <MinhaAssinaturaForm urlAtual={url} />
    </>
  );
}
