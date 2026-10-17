import Link from "next/link";
import { AlarmClock, ClipboardList, Inbox, ScrollText, Users, Wrench } from "lucide-react";
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

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-xl outline-none focus-visible:ring-3 [&>*]:h-full">
      {children}
    </Link>
  );
}

export default async function AdminDashboard() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const hoje = hojeISO();
  const agora = new Date().toISOString();

  const contar = (r: PromiseLike<{ count: number | null }>) => Promise.resolve(r).then((x) => x.count ?? 0);
  const chamados = () =>
    supabase.from("chamados").select("id", { count: "exact", head: true }).eq("ativo", true);

  const [clientes, emAndamento, novos, semTecnico, slaEstourado, tecnicos, contratosVencendo] =
    await Promise.all([
      contar(supabase.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true)),
      contar(chamados().not("status", "in", "(resolvido,cancelado)")),
      contar(chamados().eq("status", "aberto")),
      contar(chamados().not("status", "in", "(resolvido,cancelado)").is("tecnico_id", null)),
      contar(
        chamados()
          .not("status", "in", "(resolvido,cancelado)")
          .or(`sla_solucao_ate.lt.${agora},and(primeira_resposta_em.is.null,sla_resposta_ate.lt.${agora})`),
      ),
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardLink href="/admin/chamados?view=lista&status=aberto">
          <StatCard titulo="Novos (aguardando triagem)" valor={novos} icon={Inbox} />
        </CardLink>
        <CardLink href="/admin/chamados">
          <StatCard titulo="Chamados em andamento" valor={emAndamento} icon={ClipboardList} />
        </CardLink>
        <CardLink href="/admin/chamados?view=lista&tecnico=sem">
          <StatCard
            titulo="Sem técnico"
            valor={semTecnico}
            icon={Wrench}
            detalhe="em andamento, sem responsável"
          />
        </CardLink>
        <CardLink href="/admin/chamados?view=lista&sla=estourado">
          <StatCard
            titulo="SLA estourado"
            valor={slaEstourado}
            icon={AlarmClock}
            detalhe="resposta ou solução"
          />
        </CardLink>
        <CardLink href="/admin/clientes">
          <StatCard titulo="Clientes ativos" valor={clientes} icon={Users} />
        </CardLink>
        <CardLink href="/admin/tecnicos">
          <StatCard titulo="Técnicos ativos" valor={tecnicos} icon={Wrench} />
        </CardLink>
        <CardLink href="/admin/contratos?vencimento=30">
          <StatCard
            titulo="Contratos a vencer"
            valor={contratosVencendo}
            icon={ScrollText}
            detalhe="nos próximos 30 dias"
          />
        </CardLink>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Fase 2 — Chamados</CardTitle>
          <CardDescription>
            Abertura pelo portal (com anexos) ou pela Tonytec, Kanban, atribuição, agendamento, comentários
            públicos e internos, histórico e SLA. KPIs completos, gráficos e filtros de período chegam na Fase
            5.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Os itens marcados com “F3…F6” no menu indicam a fase em que cada módulo será entregue.
        </CardContent>
      </Card>
    </>
  );
}
