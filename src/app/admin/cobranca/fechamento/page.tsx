import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { carregarFechamento } from "@/lib/cobranca-consulta";
import { opcoesClientes } from "@/lib/queries";
import { formatBRL, formatDataHora, formatNumero } from "@/lib/format";
import { COBRANCA_TIPO, COBRANCA_TIPO_TOM } from "@/lib/labels";
import { mesAtualISO, mesPorExtenso, mesValido } from "@/lib/export";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ClienteFilter } from "@/components/data/list-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FaturarFechamento, SeletorMes } from "./fechamento-acoes";

export const metadata = { title: "Fechamento mensal" };

export default async function FechamentoPage({ searchParams }: PageProps<"/admin/cobranca/fechamento">) {
  await requireAdmin();
  const sp = await searchParams;
  const mesParam = typeof sp.mes === "string" ? sp.mes : "";
  const mes = mesValido(mesParam) ? mesParam : mesAtualISO();
  const clienteId = typeof sp.cliente === "string" ? sp.cliente : "";

  const [clientes, f] = await Promise.all([
    opcoesClientes(),
    clienteId ? carregarFechamento(clienteId, mes) : Promise.resolve(null),
  ]);

  const base = `/api/cobranca/fechamento?cliente=${clienteId}&mes=${mes}`;
  const todoFaturado =
    !!f &&
    f.visitas.every((v) => v.faturado) &&
    f.itens.every((i) => i.faturado) &&
    (f.visitas.length > 0 || f.itens.length > 0);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/cobranca">
          <ArrowLeft /> Cobrança de visitas
        </Link>
      </Button>
      <PageHeader
        titulo="Fechamento mensal"
        descricao="Mensalidade, visitas e materiais de um cliente em um mês, pronto para o financeiro."
      >
        {f ? (
          <>
            <Button variant="outline" asChild>
              <a href={`${base}&formato=pdf`}>
                <FileText /> PDF
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${base}&formato=xlsx`}>
                <FileSpreadsheet /> XLSX
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${base}&formato=csv`}>
                <Download /> CSV
              </a>
            </Button>
          </>
        ) : null}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ClienteFilter clientes={clientes} />
        <SeletorMes mes={mes} />
      </div>

      {!clienteId ? (
        <EmptyState
          icon={FileText}
          titulo="Escolha um cliente"
          descricao="Selecione o cliente e o mês para ver o fechamento."
        />
      ) : !f ? (
        <EmptyState icon={FileText} titulo="Cliente não encontrado" />
      ) : (
        <div className="grid gap-4">
          {f.resumo.semCalculo ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              {f.resumo.semCalculo} visita(s) deste mês estão sem cobrança calculada.{" "}
              <Link
                href={`/admin/cobranca?cliente=${clienteId}&faturamento=todos&tipo=sem_calculo`}
                className="font-medium underline underline-offset-4"
              >
                Ver e calcular
              </Link>
            </p>
          ) : null}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {f.cliente.nome} · {mesPorExtenso(f.mes)}
              </CardTitle>
              <FaturarFechamento
                clienteId={clienteId}
                mes={mes}
                faturado={todoFaturado}
                habilitado={f.visitas.length + f.itens.length > 0}
              />
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Resumo rotulo="Mensalidades" valor={formatBRL(f.resumo.mensalidades)} />
                <Resumo rotulo="Visitas cobradas" valor={formatBRL(f.resumo.totalVisitas)} />
                <Resumo rotulo="Materiais e serviços" valor={formatBRL(f.resumo.totalItens)} />
                <Resumo rotulo="Total do mês" valor={formatBRL(f.resumo.total)} destaque />
              </dl>
              <p className="text-muted-foreground mt-3 text-xs">
                A faturar: {formatBRL(f.resumo.visitasAFaturar + f.resumo.itensAFaturar)} · Já faturado:{" "}
                {formatBRL(f.resumo.visitasFaturadas + f.resumo.itensFaturados)} (visitas e materiais; a
                mensalidade é faturada à parte).
              </p>
            </CardContent>
          </Card>

          {f.contratos.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contrato(s) no mês</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {f.contratos.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border p-3"
                  >
                    <Link href={`/admin/contratos/${c.id}`} className="font-mono font-medium hover:underline">
                      {c.numero}
                    </Link>
                    <span className="text-muted-foreground">
                      Franquia: {c.visitasInclusas} visita(s) · {formatNumero(c.horasInclusas)} h
                    </span>
                    <span>
                      Usado: {c.visitasUsadas} visita(s) · {formatNumero(c.horasUsadas)} h ·{" "}
                      {c.visitasExcedentes} excedente(s)
                    </span>
                    <span className="flex-1" />
                    <strong className="tabular-nums">{formatBRL(c.valorMensal)}</strong>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visitas ({f.visitas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {!f.visitas.length ? (
                <p className="text-muted-foreground text-sm">Nenhuma visita de OS encerrada neste mês.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Visita</TableHead>
                        <TableHead className="hidden sm:table-cell">Horas</TableHead>
                        <TableHead>Cobrança</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="hidden sm:table-cell">Fat.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.visitas.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>
                            <span className="font-mono text-xs">{v.osNumero}</span>
                            <div className="text-muted-foreground text-xs">{formatDataHora(v.chegada)}</div>
                          </TableCell>
                          <TableCell className="hidden tabular-nums sm:table-cell">
                            {v.horas == null ? "—" : `${formatNumero(v.horas)} h`}
                          </TableCell>
                          <TableCell>
                            {v.tipo ? (
                              <StatusBadge tom={COBRANCA_TIPO_TOM[v.tipo]}>
                                {COBRANCA_TIPO[v.tipo]}
                              </StatusBadge>
                            ) : (
                              <StatusBadge tom="amarelo">Sem cálculo</StatusBadge>
                            )}
                            {v.tipo === "valor_por_hora" ? (
                              <span className="text-muted-foreground ml-2 text-xs tabular-nums">
                                {formatNumero(v.quantidadeHoras)} h × {formatBRL(v.valorUnitario)}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatBRL(v.valor)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{v.faturado ? "Sim" : "Não"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {f.itens.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Materiais e serviços cobrados ({f.itens.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="hidden sm:table-cell">OS</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.itens.map((i, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{i.descricao}</TableCell>
                          <TableCell className="hidden font-mono text-xs sm:table-cell">
                            {i.osNumero}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumero(i.quantidade)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatBRL(i.valor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd
        className={destaque ? "text-xl font-semibold tabular-nums" : "font-medium tabular-nums"}
        data-testid={`resumo-${rotulo}`}
      >
        {valor}
      </dd>
    </div>
  );
}
