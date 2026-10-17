import Link from "next/link";
import { CalendarClock, ChevronRight, ClipboardList, MapPin, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatData, formatDataHora } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect } from "@/components/data/list-filters";
import { lerPagina, lerParam, Pagination } from "@/components/data/pagination";
import { ChamadoStatusBadge, PrioridadeBadge } from "@/components/chamados/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Meus chamados" };

const PAGE_SIZE = 20;

export default async function PortalChamadosPage({ searchParams }: PageProps<"/portal/chamados">) {
  await requireRole("cliente");
  const sp = await searchParams;
  const filtro = lerParam(sp.status) || "abertos";
  const page = lerPagina(sp.page);

  const supabase = await createClient();
  let query = supabase
    .from("chamados")
    .select(
      "id, protocolo, titulo, status, prioridade, created_at, data_agendada, unidades(nome), tecnico:profiles!chamados_tecnico_id_fkey(nome)",
      { count: "exact" },
    )
    .eq("ativo", true);
  if (filtro === "abertos") query = query.not("status", "in", "(resolvido,cancelado)");
  else if (filtro === "encerrados") query = query.in("status", ["resolvido", "cancelado"]);

  const { data: chamados, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const novo = (
    <Button asChild>
      <Link href="/portal/chamados/novo">
        <Plus /> Abrir chamado
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader titulo="Meus chamados">{novo}</PageHeader>
      <div className="mb-4">
        <FilterSelect
          param="status"
          padrao="abertos"
          placeholder="Situação"
          opcoes={[
            { value: "abertos", label: "Em andamento" },
            { value: "encerrados", label: "Encerrados" },
            { value: "todos", label: "Todos" },
          ]}
        />
      </div>

      {!chamados?.length ? (
        <EmptyState
          icon={ClipboardList}
          titulo={filtro === "abertos" ? "Nenhum chamado em andamento" : "Nenhum chamado encontrado"}
          descricao="Quando precisar de atendimento, abra um chamado por aqui."
        >
          {novo}
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-3">
            {chamados.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/portal/chamados/${c.id}`}
                  className="block rounded-xl outline-none focus-visible:ring-3"
                >
                  <Card className="hover:bg-muted/40 transition-colors">
                    <CardContent className="flex items-center gap-3">
                      <div className="grid min-w-0 flex-1 gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground font-mono text-xs">{c.protocolo}</span>
                          <ChamadoStatusBadge status={c.status} />
                          {c.prioridade === "urgente" || c.prioridade === "alta" ? (
                            <PrioridadeBadge prioridade={c.prioridade} />
                          ) : null}
                        </div>
                        <div className="truncate font-medium">{c.titulo}</div>
                        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {c.unidades?.nome ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" /> {c.unidades.nome}
                            </span>
                          ) : null}
                          <span>Aberto em {formatData(c.created_at)}</span>
                          {c.data_agendada ? (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="size-3" /> Visita {formatDataHora(c.data_agendada)}
                            </span>
                          ) : null}
                          {c.tecnico?.nome ? <span>Técnico: {c.tecnico.nome}</span> : null}
                        </div>
                      </div>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            base="/portal/chamados"
            params={sp}
            page={page}
            pageSize={PAGE_SIZE}
            total={count ?? 0}
          />
        </>
      )}
    </>
  );
}
