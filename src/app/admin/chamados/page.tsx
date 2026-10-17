import Link from "next/link";
import { ClipboardList, Columns3, List, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { opcoesCategorias, opcoesTecnicos } from "@/lib/chamados";
import { opcoesClientes } from "@/lib/queries";
import { formatData, formatDataHora, isoDiasAtras } from "@/lib/format";
import { CHAMADO_STATUS, PRIORIDADE, PRIORIDADE_PESO } from "@/lib/labels";
import { slaPrincipal } from "@/lib/sla";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ClienteFilter, FilterSelect, PeriodoFilter, SearchInput } from "@/components/data/list-filters";
import { lerPagina, lerParam, Pagination, termoBusca } from "@/components/data/pagination";
import { ChamadoStatusBadge, PrioridadeBadge, SlaBadge } from "@/components/chamados/badges";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { KanbanChamados, type CardChamado } from "./kanban";

export const metadata = { title: "Chamados" };

const PAGE_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECT =
  "id, protocolo, titulo, status, prioridade, origem, created_at, data_agendada, sla_resposta_ate, sla_solucao_ate, primeira_resposta_em, resolvido_em, clientes(razao_social, nome_fantasia), unidades(nome), tecnico:profiles!chamados_tecnico_id_fkey(id, nome)";

export default async function ChamadosAdminPage({ searchParams }: PageProps<"/admin/chamados">) {
  await requireAdmin();
  const sp = await searchParams;
  const view = lerParam(sp.view) === "lista" ? "lista" : "kanban";
  const q = termoBusca(lerParam(sp.q));
  const status = lerParam(sp.status) || "abertos";
  const prioridade = lerParam(sp.prioridade);
  const tecnico = lerParam(sp.tecnico);
  const cliente = lerParam(sp.cliente);
  const categoria = lerParam(sp.categoria);
  const de = lerParam(sp.de);
  const ate = lerParam(sp.ate);
  const sla = lerParam(sp.sla);
  const page = lerPagina(sp.page);

  const [clientes, tecnicos, { categorias }] = await Promise.all([
    opcoesClientes(),
    opcoesTecnicos(),
    opcoesCategorias(),
  ]);

  const supabase = await createClient();
  const agora = new Date().toISOString();
  let query = supabase.from("chamados").select(SELECT, { count: "exact" }).eq("ativo", true);

  if (q) query = query.or(`protocolo.ilike.%${q}%,titulo.ilike.%${q}%`);
  if (prioridade in PRIORIDADE) query = query.eq("prioridade", prioridade as keyof typeof PRIORIDADE);
  if (tecnico === "sem") query = query.is("tecnico_id", null);
  else if (UUID.test(tecnico)) query = query.eq("tecnico_id", tecnico);
  if (UUID.test(cliente)) query = query.eq("cliente_id", cliente);
  if (UUID.test(categoria)) query = query.eq("categoria_id", categoria);
  if (/^\d{4}-\d{2}-\d{2}$/.test(de)) query = query.gte("created_at", `${de}T00:00:00-03:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ate)) query = query.lte("created_at", `${ate}T23:59:59.999-03:00`);
  if (sla === "estourado") {
    query = query
      .not("status", "in", "(resolvido,cancelado)")
      .or(`sla_solucao_ate.lt.${agora},and(primeira_resposta_em.is.null,sla_resposta_ate.lt.${agora})`);
  }

  if (view === "kanban") {
    // Kanban: tudo em andamento + resolvidos dos últimos 7 dias (cancelados ficam na lista).
    const seteDias = isoDiasAtras(7);
    query = query
      .neq("status", "cancelado")
      .or(`status.neq.resolvido,resolvido_em.gte.${seteDias}`)
      .limit(300);
  } else if (status === "abertos") {
    query = query.not("status", "in", "(resolvido,cancelado)");
  } else if (status in CHAMADO_STATUS) {
    query = query.eq("status", status as keyof typeof CHAMADO_STATUS);
  }

  const {
    data: chamados,
    count,
    error,
  } = view === "kanban"
    ? await query.order("created_at", { ascending: false })
    : await query
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const linhas = (chamados ?? []).map((c) => ({
    ...c,
    cliente: c.clientes?.nome_fantasia || c.clientes?.razao_social || "—",
    slaInfo: slaPrincipal(c),
  }));

  const hrefView = (v: "kanban" | "lista") => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(sp))
      if (typeof val === "string" && val && k !== "page" && k !== "view") p.set(k, val);
    if (v === "lista") p.set("view", "lista");
    const s = p.toString();
    return s ? `/admin/chamados?${s}` : "/admin/chamados";
  };

  return (
    <>
      <PageHeader titulo="Chamados" descricao="Triagem, atribuição, agendamento e acompanhamento.">
        <div className="bg-muted flex rounded-lg p-0.5" role="group" aria-label="Visualização">
          {(["kanban", "lista"] as const).map((v) => (
            <Link
              key={v}
              href={hrefView(v)}
              aria-current={view === v ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm",
                view === v
                  ? "bg-background font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "kanban" ? <Columns3 className="size-4" /> : <List className="size-4" />}
              {v === "kanban" ? "Kanban" : "Lista"}
            </Link>
          ))}
        </div>
        <Button asChild>
          <Link href="/admin/chamados/novo">
            <Plus /> Novo chamado
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput placeholder="Protocolo ou título" />
        {view === "lista" ? (
          <FilterSelect
            param="status"
            padrao="abertos"
            placeholder="Status"
            opcoes={[
              { value: "abertos", label: "Em andamento" },
              ...Object.entries(CHAMADO_STATUS).map(([value, label]) => ({ value, label })),
              { value: "todos", label: "Todos" },
            ]}
          />
        ) : null}
        <FilterSelect
          param="prioridade"
          placeholder="Prioridade"
          opcoes={[
            { value: "", label: "Todas as prioridades" },
            ...Object.entries(PRIORIDADE).map(([value, label]) => ({ value, label })),
          ]}
        />
        <FilterSelect
          param="tecnico"
          placeholder="Técnico"
          opcoes={[
            { value: "", label: "Todos os técnicos" },
            { value: "sem", label: "Sem técnico" },
            ...tecnicos,
          ]}
        />
        <FilterSelect
          param="categoria"
          placeholder="Categoria"
          opcoes={[{ value: "", label: "Todas as categorias" }, ...categorias]}
        />
        <FilterSelect
          param="sla"
          placeholder="SLA"
          opcoes={[
            { value: "", label: "Qualquer SLA" },
            { value: "estourado", label: "SLA estourado" },
          ]}
        />
        <ClienteFilter clientes={clientes} />
        <PeriodoFilter />
      </div>

      {error ? (
        <p className="text-destructive text-sm">Não foi possível carregar os chamados.</p>
      ) : view === "kanban" ? (
        <KanbanChamados
          chamados={linhas
            .sort(
              (a, b) =>
                PRIORIDADE_PESO[a.prioridade] - PRIORIDADE_PESO[b.prioridade] ||
                (a.data_agendada ?? "9999").localeCompare(b.data_agendada ?? "9999"),
            )
            .map((c): CardChamado => ({
              id: c.id,
              protocolo: c.protocolo,
              titulo: c.titulo,
              status: c.status,
              prioridade: c.prioridade,
              dataAgendada: c.data_agendada,
              cliente: c.cliente,
              unidade: c.unidades?.nome ?? null,
              tecnico: c.tecnico?.nome ?? null,
              sla:
                c.slaInfo.estado === "na"
                  ? null
                  : {
                      texto: c.slaInfo.texto,
                      tom: c.slaInfo.tom,
                      tipo: c.slaInfo.tipo,
                      estado: c.slaInfo.estado,
                    },
            }))}
        />
      ) : !linhas.length ? (
        <EmptyState icon={ClipboardList} titulo="Nenhum chamado encontrado" descricao="Ajuste os filtros." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chamado</TableHead>
                  <TableHead className="hidden md:table-cell">Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Técnico</TableHead>
                  <TableHead className="hidden xl:table-cell">Agendado</TableHead>
                  <TableHead className="hidden md:table-cell">SLA</TableHead>
                  <TableHead className="hidden sm:table-cell">Aberto em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-80">
                      <Link href={`/admin/chamados/${c.id}`} className="font-medium hover:underline">
                        {c.titulo}
                      </Link>
                      <div className="text-muted-foreground truncate text-xs">
                        <span className="font-mono">{c.protocolo}</span> · {c.cliente}
                        {c.unidades?.nome ? ` · ${c.unidades.nome}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <PrioridadeBadge prioridade={c.prioridade} />
                    </TableCell>
                    <TableCell>
                      <ChamadoStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {c.tecnico?.nome ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {c.data_agendada ? formatDataHora(c.data_agendada) : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <SlaBadge
                        sla={c.slaInfo}
                        prefixo={c.slaInfo.estado === "cumprido" ? undefined : c.slaInfo.tipo}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {formatData(c.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            base="/admin/chamados"
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
