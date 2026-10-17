import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { resolverPeriodo } from "@/lib/periodo";
import { RELATORIO_POR_ID, exibirValor } from "@/lib/relatorios";
import { carregarRelatorio, type SecaoCarregada } from "@/lib/relatorios-server";
import { FiltroPeriodo } from "@/components/data/filtro-periodo";
import { GraficoBarras, GraficoEvolucao, MapaCalor } from "@/components/graficos/graficos";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileBarChart } from "lucide-react";

export async function generateMetadata({ params }: PageProps<"/admin/relatorios/[id]">) {
  const { id } = await params;
  return { title: RELATORIO_POR_ID.get(id)?.titulo ?? "Relatório" };
}

const LIMITE_TELA = 500;
const NUMERICOS = ["inteiro", "numero", "moeda", "percentual"];

function Grafico({ s }: { s: SecaoCarregada }) {
  const l = s.linhas as Record<string, number | string>[];
  if (s.def.grafico === "evolucao") {
    return (
      <GraficoEvolucao
        dados={l.map((x) => ({
          mes: String(x.mes),
          abertos: Number(x.abertos),
          resolvidos: Number(x.resolvidos),
          backlog_final: Number(x.backlog_final),
        }))}
      />
    );
  }
  if (s.def.grafico === "faturamento_mes") {
    return (
      <GraficoBarras
        horizontal={false}
        formato="moeda"
        cor="var(--chart-3)"
        rotulo="Faturamento"
        dados={l.map((x) => ({ nome: String(x.grupo).split("-").reverse().join("/"), qtd: Number(x.total) }))}
      />
    );
  }
  if (s.def.grafico === "calor") {
    return (
      <MapaCalor
        dados={l.map((x) => ({
          dia_semana: Number(x.dia_semana),
          hora: Number(x.hora),
          chamados: Number(x.chamados),
        }))}
      />
    );
  }
  return null;
}

export default async function RelatorioPage({ params, searchParams }: PageProps<"/admin/relatorios/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const def = RELATORIO_POR_ID.get(id);
  if (!def) notFound();
  const sp = await searchParams;
  const periodo = resolverPeriodo(sp);
  const secoes = await carregarRelatorio(def, periodo);

  const qs = new URLSearchParams({ periodo: periodo.preset, de: periodo.deData, ate: periodo.ateData });
  const exportar = (formato: string) => `/api/relatorios/${id}?${qs}&formato=${formato}`;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/relatorios">
          <ArrowLeft /> Relatórios
        </Link>
      </Button>
      <PageHeader titulo={def.titulo} descricao={def.descricao}>
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
        <Button variant="outline" asChild>
          <a href={exportar("pdf")}>
            <FileText /> PDF
          </a>
        </Button>
      </PageHeader>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <FiltroPeriodo preset={periodo.preset} deData={periodo.deData} ateData={periodo.ateData} />
      </div>
      <p className="text-muted-foreground mb-4 text-sm">{periodo.rotulo}</p>

      <div className="grid gap-6">
        {secoes.map((s) => (
          <Card key={s.def.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {s.def.titulo}
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  {s.linhas.length} linha(s)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {s.erro ? (
                <p className="text-destructive text-sm">Não foi possível carregar esta seção.</p>
              ) : null}
              {s.def.grafico ? <Grafico s={s} /> : null}
              {s.def.somenteGrafico ? null : !s.linhas.length && !s.erro ? (
                <EmptyState icon={FileBarChart} titulo="Sem dados no período" />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {s.def.colunas.map((c) => (
                          <TableHead
                            key={c.chave}
                            className={NUMERICOS.includes(c.formato ?? "") ? "text-right" : undefined}
                          >
                            {c.titulo}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.linhas.slice(0, LIMITE_TELA).map((linha, i) => (
                        <TableRow key={i}>
                          {s.def.colunas.map((c) => (
                            <TableCell
                              key={c.chave}
                              className={
                                NUMERICOS.includes(c.formato ?? "")
                                  ? "text-right tabular-nums"
                                  : "max-w-72 truncate"
                              }
                              title={c.formato ? undefined : String(linha[c.chave] ?? "")}
                            >
                              {exibirValor(linha[c.chave], c.formato)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {s.linhas.length > LIMITE_TELA ? (
                <p className="text-muted-foreground text-xs">
                  Mostrando as primeiras {LIMITE_TELA} linhas. A exportação traz todas.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
