import Link from "next/link";
import { CalendarCheck, Download, FileSpreadsheet, Receipt } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { opcoesClientes } from "@/lib/queries";
import { consultarVisitasCobranca, lerFiltrosCobranca, totaisCobranca } from "@/lib/cobranca-consulta";
import { formatBRL } from "@/lib/format";
import { COBRANCA_TIPO } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { ClienteFilter, FilterSelect, PeriodoFilter } from "@/components/data/list-filters";
import { lerPagina, Pagination } from "@/components/data/pagination";
import { Button } from "@/components/ui/button";
import { CalcularPendentesButton } from "./calcular-pendentes-button";
import { CobrancaTabela, type LinhaCobranca } from "./cobranca-tabela";

export const metadata = { title: "Cobrança de visitas" };

const PAGE_SIZE = 25;

export default async function CobrancaPage({ searchParams }: PageProps<"/admin/cobranca">) {
  await requireAdmin();
  const sp = await searchParams;
  const filtros = lerFiltrosCobranca(sp);
  const page = lerPagina(sp.page);

  const [clientes, { data, count, error }, totais] = await Promise.all([
    opcoesClientes(),
    consultarVisitasCobranca(filtros, { page, pageSize: PAGE_SIZE }),
    totaisCobranca(filtros),
  ]);

  const linhas: LinhaCobranca[] = (data ?? []).map((v) => ({
    id: v.id,
    cliente: v.ordens_servico?.clientes?.nome_fantasia || v.ordens_servico?.clientes?.razao_social || "—",
    osNumero: v.ordens_servico?.numero ?? "",
    protocolo: v.ordens_servico?.chamados?.protocolo ?? null,
    contrato: v.contratos?.numero ?? null,
    chegada: v.data_hora_chegada,
    horas: v.horas_trabalhadas == null ? null : Number(v.horas_trabalhadas),
    tipo: v.cobranca_tipo,
    valorUnitario: v.valor_unitario == null ? null : Number(v.valor_unitario),
    quantidadeHoras: v.quantidade_horas == null ? null : Number(v.quantidade_horas),
    valor: Number(v.valor_total ?? 0),
    justificativa: v.justificativa_isencao,
    observacoes: v.observacoes_financeiras,
    manual: v.cobranca_manual,
    faturado: v.faturado,
  }));

  // Link de exportação preserva os filtros ativos.
  const qs = new URLSearchParams();
  for (const [k, val] of Object.entries(filtros)) if (val) qs.set(k, String(val));
  const exportar = (formato: "csv" | "xlsx") =>
    `/api/cobranca/export?${new URLSearchParams({ ...Object.fromEntries(qs), formato })}`;
  const mesAtual = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .slice(0, 7);

  return (
    <>
      <PageHeader
        titulo="Cobrança de visitas"
        descricao="Valor de cada visita das OS encerradas, faturamento em lote e fechamento mensal."
      >
        <CalcularPendentesButton pendentes={totais.semCalculo} />
        <Button variant="outline" asChild>
          <Link href={`/admin/cobranca/fechamento?mes=${mesAtual}`}>
            <CalendarCheck /> Fechamento mensal
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          titulo="A faturar"
          valor={formatBRL(totais.aFaturar)}
          icon={Receipt}
          detalhe="visitas do filtro"
        />
        <StatCard
          titulo="Faturado"
          valor={formatBRL(totais.faturado)}
          icon={CalendarCheck}
          detalhe="visitas do filtro"
        />
        <StatCard
          titulo="Visitas no filtro"
          valor={totais.quantidade}
          icon={FileSpreadsheet}
          detalhe={totais.semCalculo ? `${totais.semCalculo} sem cálculo` : undefined}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect
          param="faturamento"
          padrao="a_faturar"
          placeholder="Faturamento"
          opcoes={[
            { value: "a_faturar", label: "A faturar" },
            { value: "faturado", label: "Faturadas" },
            { value: "todos", label: "Todas" },
          ]}
        />
        <FilterSelect
          param="tipo"
          placeholder="Tipo de cobrança"
          opcoes={[
            { value: "", label: "Todos os tipos" },
            ...Object.entries(COBRANCA_TIPO).map(([value, label]) => ({ value, label })),
            { value: "sem_calculo", label: "Sem cálculo" },
          ]}
        />
        <ClienteFilter clientes={clientes} />
        <PeriodoFilter />
        <span className="flex-1" />
        <Button variant="outline" asChild>
          <a href={exportar("csv")}>
            <Download /> CSV
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={exportar("xlsx")}>
            <FileSpreadsheet /> XLSX
          </a>
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm">Não foi possível carregar as visitas.</p>
      ) : !linhas.length ? (
        <EmptyState
          icon={Receipt}
          titulo="Nenhuma visita encontrada"
          descricao="Só aparecem visitas de OS já encerradas (assinadas ou com recusa registrada). Ajuste os filtros."
        />
      ) : (
        <>
          <CobrancaTabela linhas={linhas} />
          <Pagination
            base="/admin/cobranca"
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
