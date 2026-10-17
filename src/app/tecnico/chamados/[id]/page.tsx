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
import { createClient } from "@/lib/supabase/server";
import { IniciarAtendimentoButton } from "@/components/os/acoes-os";
import { OsStatusBadge } from "@/components/os/resumo-os";
import { Download, FileSignature } from "lucide-react";
import { StatusAcoesTecnico } from "./status-acoes";

export const metadata = { title: "Chamado" };

/** Ações de atendimento conforme a OS do chamado (iniciar/continuar, assinar, PDF). */
async function AtendimentoAcoes({
  chamadoId,
  status,
}: {
  chamadoId: string;
  status: Parameters<typeof StatusAcoesTecnico>[0]["status"];
}) {
  const supabase = await createClient();
  const { data: ordens } = await supabase
    .from("ordens_servico")
    .select("id, numero, status, finalizada_em, assinatura_recusada, pdf_path")
    .eq("chamado_id", chamadoId)
    .neq("status", "cancelada")
    .order("created_at", { ascending: false });
  const aberta = ordens?.find((o) => !o.finalizada_em);
  const encerradas = (ordens ?? []).filter((o) => o.finalizada_em);
  const encerrado = status === "resolvido" || status === "cancelado";

  return (
    <div className="grid gap-3">
      {!encerrado ? (
        aberta?.status === "aguardando_assinatura" ? (
          <Button size="lg" asChild>
            <Link href={`/tecnico/os/${aberta.id}/assinatura`}>
              <FileSignature /> Coletar assinatura da OS {aberta.numero}
            </Link>
          </Button>
        ) : (
          <IniciarAtendimentoButton
            chamadoId={chamadoId}
            rotulo={aberta ? `Continuar atendimento (OS ${aberta.numero})` : "Iniciar atendimento"}
          />
        )
      ) : null}
      {!encerrado ? <StatusAcoesTecnico chamadoId={chamadoId} status={status} /> : null}
      {encerradas.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="font-medium">OS {o.numero}</span>
          <OsStatusBadge status={o.status} recusada={o.assinatura_recusada} />
          <span className="flex-1" />
          {o.pdf_path ? (
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/os/${o.id}/pdf`}>
                <Download /> PDF
              </a>
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

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
          <AtendimentoAcoes chamadoId={id} status={chamado.status} />

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
