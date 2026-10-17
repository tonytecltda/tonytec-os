import { ClipboardList, FileText, MapPin } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";

export const metadata = { title: "Início" };

export default async function PortalHome() {
  await requireRole("cliente");
  const supabase = await createClient();

  // Tudo abaixo é filtrado pela RLS ao cliente_id do usuário.
  const [{ data: cliente }, abertos, unidades, os] = await Promise.all([
    supabase.from("clientes").select("razao_social, nome_fantasia").maybeSingle(),
    supabase
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(resolvido,cancelado)")
      .then((r) => r.count ?? 0),
    supabase
      .from("unidades")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .then((r) => r.count ?? 0),
    supabase
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
  ]);

  return (
    <>
      <PageHeader
        titulo={cliente?.nome_fantasia || cliente?.razao_social || "Portal do Cliente"}
        descricao="Acompanhe seus chamados e ordens de serviço"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard titulo="Chamados em aberto" valor={abertos} icon={ClipboardList} />
        <StatCard titulo="Ordens de serviço" valor={os} icon={FileText} />
        <StatCard titulo="Unidades" valor={unidades} icon={MapPin} />
      </div>
    </>
  );
}
