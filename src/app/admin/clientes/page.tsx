import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { contratoVigente } from "@/lib/contratos";
import { formatarDocumento, normalizarDocumento } from "@/lib/documentos";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect, SearchInput } from "@/components/data/list-filters";
import { lerPagina, lerParam, Pagination, termoBusca } from "@/components/data/pagination";
import { AtivoBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Clientes" };

const PAGE_SIZE = 20;

export default async function ClientesPage({ searchParams }: PageProps<"/admin/clientes">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = termoBusca(lerParam(sp.q));
  const status = lerParam(sp.status) || "ativos";
  const page = lerPagina(sp.page);

  const supabase = await createClient();
  let query = supabase
    .from("clientes")
    .select(
      "id, razao_social, nome_fantasia, cnpj_cpf, telefone, ativo, unidades(count), contratos(status, data_inicio, data_fim)",
      { count: "exact" },
    );

  if (status === "ativos") query = query.eq("ativo", true);
  else if (status === "inativos") query = query.eq("ativo", false);

  if (q) {
    const filtros = [`razao_social.ilike.%${q}%`, `nome_fantasia.ilike.%${q}%`];
    const doc = normalizarDocumento(q);
    if (doc.length >= 3) filtros.push(`cnpj_cpf.ilike.%${doc}%`);
    query = query.or(filtros.join(","));
  }

  const {
    data: clientes,
    count,
    error,
  } = await query.order("razao_social").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao="Cadastro de clientes, unidades, usuários do portal e contratos."
      >
        <Button asChild>
          <Link href="/admin/clientes/novo">
            <Plus /> Novo cliente
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput placeholder="Buscar por nome ou CPF/CNPJ" />
        <FilterSelect
          param="status"
          padrao="ativos"
          placeholder="Status"
          opcoes={[
            { value: "ativos", label: "Ativos" },
            { value: "inativos", label: "Inativos" },
            { value: "todos", label: "Todos" },
          ]}
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm">Não foi possível carregar os clientes.</p>
      ) : !clientes?.length ? (
        <EmptyState
          icon={Users}
          titulo={q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          descricao={q ? "Tente outro termo de busca." : "Cadastre o primeiro cliente para começar."}
        >
          {!q ? (
            <Button asChild>
              <Link href="/admin/clientes/novo">
                <Plus /> Novo cliente
              </Link>
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">CPF/CNPJ</TableHead>
                  <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                  <TableHead className="hidden md:table-cell">Unidades</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden w-8 sm:table-cell">
                    <span className="sr-only">Abrir</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => {
                  const vigente = c.contratos.some(contratoVigente);
                  return (
                    <TableRow key={c.id} className={c.ativo ? undefined : "opacity-60"}>
                      <TableCell className="max-w-72">
                        <Link href={`/admin/clientes/${c.id}`} className="font-medium hover:underline">
                          {c.nome_fantasia || c.razao_social}
                        </Link>
                        {c.nome_fantasia ? (
                          <div className="text-muted-foreground truncate text-xs">{c.razao_social}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs sm:table-cell">
                        {c.cnpj_cpf ? formatarDocumento(c.cnpj_cpf) : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{c.telefone || "—"}</TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {c.unidades[0]?.count ?? 0}
                      </TableCell>
                      <TableCell>
                        {vigente ? (
                          <StatusBadge tom="verde">Com contrato</StatusBadge>
                        ) : (
                          <StatusBadge tom="cinza">Avulso</StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <AtivoBadge ativo={c.ativo} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          aria-label={`Abrir ${c.razao_social}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination
            base="/admin/clientes"
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
