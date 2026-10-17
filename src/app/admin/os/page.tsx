import { Filtros } from "@/components/data/filtros";
import Link from "next/link";
import { Download, FileSignature, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { opcoesTecnicos } from "@/lib/chamados";
import { opcoesClientes } from "@/lib/queries";
import { formatData, formatDataHora } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ClienteFilter, FilterSelect, PeriodoFilter, SearchInput } from "@/components/data/list-filters";
import { lerPagina, lerParam, Pagination, termoBusca } from "@/components/data/pagination";
import { OsStatusBadge } from "@/components/os/resumo-os";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Ordens de serviço" };

const PAGE_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OsAdminPage({ searchParams }: PageProps<"/admin/os">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = termoBusca(lerParam(sp.q));
  const situacao = lerParam(sp.situacao) || "abertas";
  const tecnico = lerParam(sp.tecnico);
  const cliente = lerParam(sp.cliente);
  const de = lerParam(sp.de);
  const ate = lerParam(sp.ate);
  const page = lerPagina(sp.page);

  const [clientes, tecnicos] = await Promise.all([opcoesClientes(), opcoesTecnicos()]);
  const supabase = await createClient();
  let query = supabase
    .from("ordens_servico")
    .select(
      "id, numero, status, assinatura_recusada, created_at, finalizada_em, pdf_path, tecnico_nome_snapshot, chamados(protocolo, titulo), clientes(nome_fantasia, razao_social)",
      { count: "exact" },
    )
    .eq("ativo", true);

  if (situacao === "abertas") query = query.is("finalizada_em", null).neq("status", "cancelada");
  else if (situacao === "aguardando") query = query.eq("status", "aguardando_assinatura");
  else if (situacao === "encerradas") query = query.not("finalizada_em", "is", null);
  else if (situacao === "sem_assinatura")
    query = query.eq("assinatura_recusada", true).not("finalizada_em", "is", null);
  else if (situacao === "pendencias") query = query.eq("pendencias", true);
  else if (situacao === "canceladas") query = query.eq("status", "cancelada");
  if (q) {
    const { data: ch } = await supabase.from("chamados").select("id").ilike("protocolo", `%${q}%`).limit(50);
    const ids = (ch ?? []).map((c) => c.id);
    query = query.or(
      [`numero.ilike.%${q}%`, ids.length ? `chamado_id.in.(${ids.join(",")})` : null]
        .filter(Boolean)
        .join(","),
    );
  }
  if (UUID.test(tecnico)) query = query.eq("tecnico_id", tecnico);
  if (UUID.test(cliente)) query = query.eq("cliente_id", cliente);
  if (/^\d{4}-\d{2}-\d{2}$/.test(de)) query = query.gte("created_at", `${de}T00:00:00-03:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ate)) query = query.lte("created_at", `${ate}T23:59:59.999-03:00`);

  const {
    data: ordens,
    count,
    error,
  } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return (
    <>
      <PageHeader titulo="Ordens de serviço" descricao="Execução, assinatura e PDF das OS.">
        <Button asChild>
          <Link href="/admin/os/nova">
            <Plus /> Nova OS
          </Link>
        </Button>
      </PageHeader>
      <Filtros busca={<SearchInput placeholder="Nº da OS ou protocolo" />}>
        <FilterSelect
          param="situacao"
          padrao="abertas"
          placeholder="Situação"
          opcoes={[
            { value: "abertas", label: "Em aberto" },
            { value: "aguardando", label: "Aguardando assinatura" },
            { value: "encerradas", label: "Encerradas" },
            { value: "sem_assinatura", label: "Encerradas sem assinatura" },
            { value: "pendencias", label: "Com pendências" },
            { value: "canceladas", label: "Canceladas" },
            { value: "todas", label: "Todas" },
          ]}
        />
        <FilterSelect
          param="tecnico"
          placeholder="Técnico"
          opcoes={[{ value: "", label: "Todos os técnicos" }, ...tecnicos]}
        />
        <ClienteFilter clientes={clientes} />
        <PeriodoFilter />
      </Filtros>

      {error ? (
        <p className="text-destructive text-sm">Não foi possível carregar as OS.</p>
      ) : !ordens?.length ? (
        <EmptyState icon={FileSignature} titulo="Nenhuma OS encontrada" descricao="Ajuste os filtros." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Técnico</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="hidden md:table-cell">Criada</TableHead>
                  <TableHead className="hidden xl:table-cell">Encerrada</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">PDF</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordens.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/admin/os/${o.id}`}
                        className="font-mono text-sm font-medium hover:underline"
                      >
                        {o.numero}
                      </Link>
                      {o.chamados ? (
                        <div className="text-muted-foreground max-w-56 truncate text-xs">
                          {o.chamados.protocolo} · {o.chamados.titulo}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-xs">Sem chamado</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {o.clientes?.nome_fantasia || o.clientes?.razao_social}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{o.tecnico_nome_snapshot ?? "—"}</TableCell>
                    <TableCell>
                      <OsStatusBadge status={o.status} recusada={o.assinatura_recusada} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {formatData(o.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden xl:table-cell">
                      {o.finalizada_em ? formatDataHora(o.finalizada_em) : "—"}
                    </TableCell>
                    <TableCell>
                      {o.pdf_path ? (
                        <a
                          href={`/api/os/${o.id}/pdf`}
                          aria-label={`PDF da ${o.numero}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Download className="size-4" />
                        </a>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination base="/admin/os" params={sp} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
        </>
      )}
    </>
  );
}
