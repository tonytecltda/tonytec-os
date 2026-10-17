import Link from "next/link";
import {
  AlarmClock,
  BadgeDollarSign,
  CheckCircle2,
  Clock,
  FileSignature,
  Hourglass,
  Inbox,
  PenLine,
  Receipt,
  ScrollText,
  Smile,
  Timer,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { carregarDashboard, horasLegivel, pct } from "@/lib/dashboard";
import { formatBRL, formatDataHora, hojeISO } from "@/lib/format";
import { resolverPeriodo } from "@/lib/periodo";
import { FiltroPeriodo } from "@/components/data/filtro-periodo";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { GraficoBarras, GraficoDias } from "@/components/graficos/graficos";
import { PrioridadeBadge } from "@/components/chamados/badges";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIORIDADE } from "@/lib/labels";

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

function Grafico({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descricao ? <CardDescription>{descricao}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const profile = await requireAdmin();
  const sp = await searchParams;
  const periodo = resolverPeriodo(sp);
  const supabase = await createClient();
  const hoje = hojeISO();

  const contar = (r: PromiseLike<{ count: number | null }>) => Promise.resolve(r).then((x) => x.count ?? 0);
  const chamados = () =>
    supabase.from("chamados").select("id", { count: "exact", head: true }).eq("ativo", true);

  const [d, novos, semTecnico, contratosVencendo] = await Promise.all([
    carregarDashboard(periodo),
    contar(chamados().eq("status", "aberto")),
    contar(chamados().not("status", "in", "(resolvido,cancelado)").is("tecnico_id", null)),
    contar(
      supabase
        .from("contratos")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo")
        .gte("data_fim", hoje)
        .lte("data_fim", somarDias(hoje, 30)),
    ),
  ]);

  const primeiroNome = profile.nome.split(" ")[0] || "admin";

  if (!d) {
    return (
      <>
        <PageHeader titulo={`Olá, ${primeiroNome}`} descricao="Visão geral da operação" />
        <p className="text-destructive text-sm">Não foi possível carregar os indicadores. Tente novamente.</p>
      </>
    );
  }

  const slaSolucao = pct(d.sla.solucao_ok, d.sla.solucao_total);
  const slaResposta = pct(d.sla.resposta_ok, d.sla.resposta_total);
  const prioridades = d.por_prioridade.map((p) => ({
    nome: PRIORIDADE[p.nome as keyof typeof PRIORIDADE] ?? p.nome,
    qtd: Number(p.qtd),
  }));
  const ordemPrio = ["Urgente", "Alta", "Média", "Baixa"];
  prioridades.sort((a, b) => ordemPrio.indexOf(a.nome) - ordemPrio.indexOf(b.nome));

  return (
    <>
      <PageHeader titulo={`Olá, ${primeiroNome}`} descricao={periodo.rotulo}>
        <FiltroPeriodo preset={periodo.preset} deData={periodo.deData} ateData={periodo.ateData} />
      </PageHeader>

      {/* Atenção agora (não depende do período) */}
      <section aria-label="Atenção agora" className="mb-6 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <CardLink href="/admin/chamados?view=lista&status=aberto">
          <StatCard titulo="Novos (aguardando triagem)" valor={novos} icon={Inbox} />
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
            titulo="SLA estourado agora"
            valor={d.sla_risco.filter((r) => r.situacao === "estourado").length}
            icon={AlarmClock}
            detalhe="resposta ou solução"
          />
        </CardLink>
        <CardLink href="/admin/contratos?vencimento=30">
          <StatCard
            titulo="Contratos a vencer"
            valor={contratosVencendo}
            icon={ScrollText}
            detalhe="nos próximos 30 dias"
          />
        </CardLink>
      </section>

      {/* Chamados do período */}
      <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
        Chamados no período
      </h2>
      <section className="mb-6 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard
          titulo="Abertos"
          valor={d.chamados.abertos}
          icon={Inbox}
          detalhe="aguardando triagem ou visita"
        />
        <StatCard titulo="Em atendimento" valor={d.chamados.em_atendimento} icon={Wrench} />
        <StatCard
          titulo="Aguardando"
          valor={d.chamados.aguardando}
          icon={Hourglass}
          detalhe="cliente ou peça"
        />
        <StatCard
          titulo="Resolvidos"
          valor={d.chamados.resolvidos}
          icon={CheckCircle2}
          detalhe="resolvidos no período"
        />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard
          titulo="Tempo médio de 1ª resposta"
          valor={horasLegivel(d.tempos.resposta_h)}
          icon={Timer}
        />
        <StatCard titulo="Tempo médio de resolução" valor={horasLegivel(d.tempos.resolucao_h)} icon={Clock} />
        <StatCard
          titulo="SLA cumprido (solução)"
          valor={slaSolucao}
          icon={AlarmClock}
          detalhe={`Resposta: ${slaResposta}`}
        />
        <StatCard
          titulo="Satisfação"
          valor={
            d.satisfacao.media == null ? "—" : `${Number(d.satisfacao.media).toLocaleString("pt-BR")} / 5`
          }
          icon={Smile}
          detalhe={`${d.satisfacao.avaliacoes} avaliação(ões)`}
        />
      </section>

      <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
        Ordens de serviço e faturamento
      </h2>
      <section className="mb-6 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <CardLink href="/admin/os?situacao=encerradas">
          <StatCard
            titulo="OS concluídas"
            valor={d.os.concluidas}
            icon={FileSignature}
            detalhe="encerradas no período"
          />
        </CardLink>
        <CardLink href="/admin/os?situacao=aguardando">
          <StatCard
            titulo="OS aguardando assinatura"
            valor={d.os.aguardando_assinatura}
            icon={PenLine}
            detalhe="agora"
          />
        </CardLink>
        <CardLink href="/admin/cobranca">
          <StatCard
            titulo="A faturar"
            valor={formatBRL(d.faturamento.a_faturar)}
            icon={Receipt}
            detalhe="visitas e materiais"
          />
        </CardLink>
        <StatCard
          titulo="Faturado"
          valor={formatBRL(d.faturamento.faturado)}
          icon={BadgeDollarSign}
          detalhe="visitas e materiais"
        />
      </section>

      {/* SLA em risco */}
      {d.sla_risco.length ? (
        <Card className="mb-6 border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-amber-600" /> Chamados com SLA estourado ou vencendo
            </CardTitle>
            <CardDescription>Abertos agora, com prazo vencido ou nas próximas 4 horas.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {d.sla_risco.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/chamados/${r.id}`}
                    className="hover:bg-muted/50 -mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-sm"
                  >
                    <span className="text-muted-foreground font-mono text-xs">{r.protocolo}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{r.titulo}</span>
                    <span className="text-muted-foreground hidden truncate sm:inline">{r.cliente_nome}</span>
                    <PrioridadeBadge prioridade={r.prioridade as keyof typeof PRIORIDADE} />
                    <StatusBadge tom={r.situacao === "estourado" ? "vermelho" : "amarelo"}>
                      {r.situacao === "estourado" ? "Estourado" : "Vencendo"} · {formatDataHora(r.prazo)}
                    </StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Gráficos */}
      <section className="grid gap-4 xl:grid-cols-2" aria-label="Gráficos">
        <div className="xl:col-span-2">
          <Grafico titulo="Chamados por dia" descricao="Abertos e resolvidos em cada dia do período.">
            <GraficoDias dados={d.por_dia} />
          </Grafico>
        </div>
        <Grafico titulo="Por categoria">
          <GraficoBarras
            dados={d.por_categoria.map((x) => ({ nome: x.nome, qtd: Number(x.qtd) }))}
            rotulo="Chamados por categoria"
          />
        </Grafico>
        <Grafico titulo="Por prioridade">
          <GraficoBarras dados={prioridades} rotulo="Chamados por prioridade" cor="var(--chart-4)" />
        </Grafico>
        <Grafico titulo="Por técnico">
          <GraficoBarras
            dados={d.por_tecnico.map((x) => ({ nome: x.nome, qtd: Number(x.qtd) }))}
            rotulo="Chamados por técnico"
            cor="var(--chart-2)"
          />
        </Grafico>
        <Grafico
          titulo="Receita por mês"
          descricao="Visitas e materiais de OS encerradas — últimos 12 meses."
        >
          <GraficoBarras
            horizontal={false}
            formato="moeda"
            cor="var(--chart-3)"
            rotulo="Receita"
            dados={d.receita_mensal.map((x) => ({
              nome: x.mes.split("-").reverse().join("/"),
              qtd: Number(x.valor),
            }))}
          />
        </Grafico>
        <Grafico titulo="Clientes com mais chamados">
          <GraficoBarras
            dados={d.top_clientes.map((x) => ({ nome: x.nome, qtd: Number(x.qtd) }))}
            rotulo="Chamados por cliente"
          />
        </Grafico>
        <Grafico titulo="Problemas mais frequentes">
          <GraficoBarras
            dados={d.top_problemas.map((x) => ({ nome: x.nome, qtd: Number(x.qtd) }))}
            rotulo="Chamados por tipo de problema"
            cor="var(--chart-5)"
          />
        </Grafico>
      </section>
      <p className="text-muted-foreground mt-4 text-xs">
        Mais detalhes, filtros e exportação em{" "}
        <Link href="/admin/relatorios" className="underline underline-offset-4">
          Relatórios
        </Link>
        .
      </p>
    </>
  );
}
