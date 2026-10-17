import Link from "next/link";
import { ClipboardList, FileSignature, ScrollText, Users, Wrench } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default async function AdminDashboard() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const hoje = hojeISO();

  const contar = (r: PromiseLike<{ count: number | null }>) => Promise.resolve(r).then((x) => x.count ?? 0);
  const [clientes, chamadosAbertos, os, tecnicos, contratosVencendo] = await Promise.all([
    contar(supabase.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true)),
    contar(
      supabase
        .from("chamados")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .not("status", "in", "(resolvido,cancelado)"),
    ),
    contar(supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("ativo", true)),
    contar(
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "tecnico")
        .eq("ativo", true),
    ),
    contar(
      supabase
        .from("contratos")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo")
        .gte("data_fim", hoje)
        .lte("data_fim", somarDias(hoje, 30)),
    ),
  ]);

  return (
    <>
      <PageHeader
        titulo={`Olá, ${profile.nome.split(" ")[0] || "admin"}`}
        descricao="Visão geral da operação"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard titulo="Clientes ativos" valor={clientes} icon={Users} />
        <StatCard titulo="Chamados em aberto" valor={chamadosAbertos} icon={ClipboardList} />
        <StatCard titulo="Ordens de serviço" valor={os} icon={FileSignature} />
        <StatCard titulo="Técnicos ativos" valor={tecnicos} icon={Wrench} />
        <Link href="/admin/contratos?vencimento=30" className="rounded-xl outline-none focus-visible:ring-3">
          <StatCard
            titulo="Contratos a vencer"
            valor={contratosVencendo}
            icon={ScrollText}
            detalhe="nos próximos 30 dias"
          />
        </Link>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Fase 1 — Cadastros</CardTitle>
          <CardDescription>
            Clientes, unidades, usuários do portal, técnicos, contratos, catálogos e configurações já estão
            disponíveis. Os KPIs completos, gráficos e filtros de período chegam na Fase 5.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Os itens marcados com “F2…F6” no menu indicam a fase em que cada módulo será entregue.
        </CardContent>
      </Card>
    </>
  );
}
