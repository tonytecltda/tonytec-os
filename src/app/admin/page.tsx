import { ClipboardList, FileSignature, Users, Wrench } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  const contar = async (tabela: "clientes" | "chamados" | "ordens_servico") => {
    const { count } = await supabase
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("ativo", true);
    return count ?? 0;
  };
  const [clientes, chamadosAbertos, os, tecnicos] = await Promise.all([
    contar("clientes"),
    supabase
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .not("status", "in", "(resolvido,cancelado)")
      .then((r) => r.count ?? 0),
    contar("ordens_servico"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "tecnico")
      .eq("ativo", true)
      .then((r) => r.count ?? 0),
  ]);

  return (
    <>
      <PageHeader
        titulo={`Olá, ${profile.nome.split(" ")[0] || "admin"}`}
        descricao="Visão geral da operação"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard titulo="Clientes ativos" valor={clientes} icon={Users} />
        <StatCard titulo="Chamados em aberto" valor={chamadosAbertos} icon={ClipboardList} />
        <StatCard titulo="Ordens de serviço" valor={os} icon={FileSignature} />
        <StatCard titulo="Técnicos ativos" valor={tecnicos} icon={Wrench} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Fase 0 — Fundação</CardTitle>
          <CardDescription>
            Login, perfis, banco com RLS e layouts prontos. Os KPIs completos, gráficos e filtros de período
            chegam na Fase 5.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Os itens marcados com “F1…F6” no menu indicam a fase em que cada módulo será entregue.
        </CardContent>
      </Card>
    </>
  );
}
