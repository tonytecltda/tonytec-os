import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { carregarAnexos, carregarChamado, carregarTimeline } from "@/lib/chamados";
import { formatDataHora } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ChamadoStatusBadge, PrioridadeBadge, SlaBadge } from "@/components/chamados/badges";
import { ListaAnexos } from "@/components/chamados/anexos";
import { ComentarioForm } from "@/components/chamados/comentario-form";
import { EnviarAnexos } from "@/components/chamados/enviar-anexos";
import { UnidadeInfo } from "@/components/chamados/painel-info";
import { Timeline } from "@/components/chamados/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { slaPrincipal } from "@/lib/sla";
import { StatusAcoesTecnico } from "./status-acoes";

export const metadata = { title: "Chamado" };

export default async function TecnicoChamadoPage({ params }: PageProps<"/tecnico/chamados/[id]">) {
  await requireRole("tecnico");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  // A RLS só devolve chamados atribuídos a este técnico.
  const chamado = await carregarChamado(id);
  if (!chamado) notFound();
  const [eventos, anexos] = await Promise.all([carregarTimeline(id), carregarAnexos(id)]);
  const sla = slaPrincipal(chamado);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/tecnico">
          <ArrowLeft /> Meu dia
        </Link>
      </Button>
      <PageHeader
        titulo={chamado.titulo}
        descricao={`${chamado.protocolo} · ${chamado.clientes?.nome_fantasia || chamado.clientes?.razao_social}`}
      >
        <ChamadoStatusBadge status={chamado.status} />
        <PrioridadeBadge prioridade={chamado.prioridade} />
        <SlaBadge sla={sla} prefixo={sla.tipo} />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid min-w-0 content-start gap-4">
          <StatusAcoesTecnico chamadoId={id} status={chamado.status} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Local</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {chamado.data_agendada ? (
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="text-primary size-4" /> Visita agendada:{" "}
                  {formatDataHora(chamado.data_agendada)}
                </p>
              ) : null}
              <UnidadeInfo unidade={chamado.unidades} telefoneContato={chamado.telefone_contato} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Problema relatado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{chamado.descricao || "—"}</p>
              <p className="text-muted-foreground mt-3 text-xs">
                {[chamado.categorias_servico?.nome, chamado.tipos_problema?.nome].filter(Boolean).join(" · ")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Fotos e anexos</CardTitle>
              <EnviarAnexos chamadoId={id} camera />
            </CardHeader>
            <CardContent>
              <ListaAnexos anexos={anexos} />
            </CardContent>
          </Card>
        </div>

        <Card className="content-start">
          <CardHeader>
            <CardTitle className="text-base">Mensagens</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <ComentarioForm chamadoId={id} permitirInterno />
            <Timeline eventos={[...eventos].reverse()} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
