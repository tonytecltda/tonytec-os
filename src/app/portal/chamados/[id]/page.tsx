import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, UserRound } from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { carregarAnexos, carregarChamado, carregarTimeline } from "@/lib/chamados";
import { formatDataHora } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ChamadoStatusBadge, PrioridadeBadge } from "@/components/chamados/badges";
import { ListaAnexos } from "@/components/chamados/anexos";
import { ComentarioForm } from "@/components/chamados/comentario-form";
import { EnviarAnexos } from "@/components/chamados/enviar-anexos";
import { UnidadeInfo } from "@/components/chamados/painel-info";
import { Timeline } from "@/components/chamados/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Chamado" };

export default async function PortalChamadoPage({ params }: PageProps<"/portal/chamados/[id]">) {
  await requireRole("cliente");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const chamado = await carregarChamado(id);
  if (!chamado) notFound();
  const [eventos, anexos] = await Promise.all([carregarTimeline(id), carregarAnexos(id)]);
  const encerrado = chamado.status === "resolvido" || chamado.status === "cancelado";

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/portal/chamados">
          <ArrowLeft /> Meus chamados
        </Link>
      </Button>
      <PageHeader titulo={chamado.titulo} descricao={`Protocolo ${chamado.protocolo}`}>
        <ChamadoStatusBadge status={chamado.status} />
        <PrioridadeBadge prioridade={chamado.prioridade} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{chamado.descricao || "—"}</p>
              <p className="text-muted-foreground mt-3 text-xs">
                {[chamado.categorias_servico?.nome, chamado.tipos_problema?.nome].filter(Boolean).join(" · ")}
                {" · "}Aberto em {formatDataHora(chamado.created_at)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Anexos</CardTitle>
              {!encerrado ? <EnviarAnexos chamadoId={id} camera /> : null}
            </CardHeader>
            <CardContent>
              <ListaAnexos anexos={anexos} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acompanhamento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <Timeline eventos={eventos} />
              {!encerrado ? (
                <ComentarioForm chamadoId={id} permitirInterno={false} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Chamado encerrado. Precisa de algo mais? Abra um novo chamado.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center gap-2">
                <UserRound className="text-muted-foreground size-4" />
                <span>
                  {chamado.tecnico?.nome ? `Técnico: ${chamado.tecnico.nome}` : "Técnico ainda não definido"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className="text-muted-foreground size-4" />
                <span>
                  {chamado.data_agendada
                    ? `Visita em ${formatDataHora(chamado.data_agendada)}`
                    : "Visita ainda não agendada"}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Local</CardTitle>
            </CardHeader>
            <CardContent>
              <UnidadeInfo unidade={chamado.unidades} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
