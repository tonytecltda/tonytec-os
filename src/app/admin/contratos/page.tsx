import Link from "next/link";
import { AlertTriangle, Plus, ScrollText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { situacaoContrato, vigenciaTexto } from "@/lib/contratos";
import { diasAte, formatBRL, hojeISO } from "@/lib/format";
import { CONTRATO_TIPO } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect, SearchInput } from "@/components/data/list-filters";
import { lerPagina, lerParam, Pagination, termoBusca } from "@/components/data/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Contratos" };

const PAGE_SIZE = 20;

function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default async function ContratosPage({ searchParams }: PageProps<"/admin/contratos">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = termoBusca(lerParam(sp.q));
  const status = lerParam(sp.status) || "ativo";
  const vencimento = lerParam(sp.vencimento);
  const page = lerPagina(sp.page);
  const hoje = hojeISO();
  const em30 = somarDias(hoje, 30);

  const supabase = await createClient();

  // Alerta de vencimento (30/15/7 dias) — sempre sobre os contratos ativos.
  const { data: vencendo } = await supabase
    .from("contratos")
    .select("data_fim")
    .eq("status", "ativo")
    .gte("data_fim", hoje)
    .lte("data_fim", em30);
  const faixas = { 7: 0, 15: 0, 30: 0 };
  (vencendo ?? []).forEach((c) => {
    const d = diasAte(c.data_fim!);
    if (d <= 7) faixas[7]++;
    else if (d <= 15) faixas[15]++;
    else faixas[30]++;
  });
  const totalVencendo = faixas[7] + faixas[15] + faixas[30];

  let query = supabase
    .from("contratos")
    .select(
      "id, numero, descricao, tipo, status, data_inicio, data_fim, valor_mensal, visitas_inclusas_mes, horas_inclusas_mes, cliente_id, clientes(razao_social, nome_fantasia)",
      { count: "exact" },
    );
  if (status !== "todos") query = query.eq("status", status as "ativo" | "suspenso" | "encerrado");
  if (vencimento === "30") query = query.eq("status", "ativo").gte("data_fim", hoje).lte("data_fim", em30);

  if (q) {
    const { data: cli } = await supabase
      .from("clientes")
      .select("id")
      .or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%`)
      .limit(200);
    const ids = (cli ?? []).map((c) => c.id);
    query = query.or(
      [`numero.ilike.%${q}%`, ids.length ? `cliente_id.in.(${ids.join(",")})` : null]
        .filter(Boolean)
        .join(","),
    );
  }

  const {
    data: contratos,
    count,
    error,
  } = await query
    .order("data_fim", { ascending: true, nullsFirst: false })
    .order("numero")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return (
    <>
      <PageHeader
        titulo="Contratos"
        descricao="Franquias de visitas/horas, política de excedente e SLA por cliente."
      >
        <Button asChild>
          <Link href="/admin/contratos/novo">
            <Plus /> Novo contrato
          </Link>
        </Button>
      </PageHeader>

      {totalVencendo > 0 ? (
        <Alert className="mb-4 border-amber-500/40">
          <AlertTriangle className="text-amber-600" />
          <AlertTitle>
            {totalVencendo} contrato{totalVencendo > 1 ? "s vencem" : " vence"} nos próximos 30 dias
          </AlertTitle>
          <AlertDescription>
            <span>
              {faixas[7]} em até 7 dias · {faixas[15]} entre 8 e 15 dias · {faixas[30]} entre 16 e 30 dias.{" "}
              <Link
                href="/admin/contratos?vencimento=30"
                className="font-medium underline underline-offset-4"
              >
                Ver contratos
              </Link>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput placeholder="Buscar por número ou cliente" />
        <FilterSelect
          param="status"
          padrao="ativo"
          placeholder="Status"
          opcoes={[
            { value: "ativo", label: "Ativos" },
            { value: "suspenso", label: "Suspensos" },
            { value: "encerrado", label: "Encerrados" },
            { value: "todos", label: "Todos" },
          ]}
        />
        <FilterSelect
          param="vencimento"
          placeholder="Vencimento"
          opcoes={[
            { value: "", label: "Qualquer vencimento" },
            { value: "30", label: "Vence em 30 dias" },
          ]}
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm">Não foi possível carregar os contratos.</p>
      ) : !contratos?.length ? (
        <EmptyState
          icon={ScrollText}
          titulo="Nenhum contrato encontrado"
          descricao={q || vencimento ? "Ajuste os filtros." : "Cadastre o primeiro contrato."}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Vigência</TableHead>
                  <TableHead className="hidden xl:table-cell">Inclusos/mês</TableHead>
                  <TableHead className="hidden md:table-cell">Mensal</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c) => {
                  const s = situacaoContrato(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/admin/contratos/${c.id}`}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {c.numero}
                        </Link>
                        {c.descricao ? (
                          <div className="text-muted-foreground max-w-56 truncate text-xs">{c.descricao}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-56 truncate">
                        <Link
                          href={`/admin/clientes/${c.cliente_id}?aba=contratos`}
                          className="hover:underline"
                        >
                          {c.clientes?.nome_fantasia || c.clientes?.razao_social}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{CONTRATO_TIPO[c.tipo]}</TableCell>
                      <TableCell className="hidden md:table-cell">{vigenciaTexto(c)}</TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {c.visitas_inclusas_mes} visita(s) · {Number(c.horas_inclusas_mes)} h
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {formatBRL(c.valor_mensal)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tom={s.tom}>{s.label}</StatusBadge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination
            base="/admin/contratos"
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
