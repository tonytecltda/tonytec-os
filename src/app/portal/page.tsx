import Link from "next/link";
import { ChevronRight, ClipboardList, FileText, MapPin, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatData } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChamadoStatusBadge } from "@/components/chamados/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Início" };

export default async function PortalHome() {
  await requireRole("cliente");
  const supabase = await createClient();

  // Tudo abaixo é filtrado pela RLS ao cliente_id do usuário.
  const [{ data: cliente }, abertos, unidades, os, { data: recentes }] = await Promise.all([
    supabase.from("clientes").select("razao_social, nome_fantasia").maybeSingle(),
    supabase
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
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
    supabase
      .from("chamados")
      .select("id, protocolo, titulo, status, created_at")
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <>
      <PageHeader
        titulo={cliente?.nome_fantasia || cliente?.razao_social || "Portal do Cliente"}
        descricao="Acompanhe seus chamados e ordens de serviço"
      >
        <Button asChild size="lg">
          <Link href="/portal/chamados/novo">
            <Plus /> Abrir chamado
          </Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/portal/chamados" className="rounded-xl outline-none focus-visible:ring-3">
          <StatCard titulo="Chamados em andamento" valor={abertos} icon={ClipboardList} />
        </Link>
        <StatCard titulo="Ordens de serviço" valor={os} icon={FileText} />
        <StatCard titulo="Unidades" valor={unidades} icon={MapPin} />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Últimos chamados</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portal/chamados?status=todos">Ver todos</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!recentes?.length ? (
            <p className="text-muted-foreground text-sm">Nenhum chamado ainda.</p>
          ) : (
            <ul className="divide-y">
              {recentes.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/portal/chamados/${c.id}`}
                    className="hover:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.titulo}</div>
                      <div className="text-muted-foreground text-xs">
                        {c.protocolo} · {formatData(c.created_at)}
                      </div>
                    </div>
                    <ChamadoStatusBadge status={c.status} />
                    <ChevronRight className="text-muted-foreground size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
