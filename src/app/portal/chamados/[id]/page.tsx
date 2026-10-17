import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Download, FileSignature, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AvaliacaoForm } from "@/components/chamados/avaliacao-form";
import { OsStatusBadge } from "@/components/os/resumo-os";
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
  const supabase = await createClient();
  const [eventos, anexos, { data: ordens }] = await Promise.all([
    carregarTimeline(id),
    carregarAnexos(id),
    // RLS: o cliente vê as OS concluídas, assinadas ou aguardando assinatura.
    supabase
      .from("ordens_servico")
      .select("id, numero, status, assinatura_recusada, pdf_path")
      .eq("chamado_id", id)
      .order("created_at", { ascending: false }),
  ]);
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
          {chamado.status === "resolvido" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {chamado.avaliacao_nota ? "Sua avaliação" : "Como foi o atendimento?"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chamado.avaliacao_nota ? (
                  <div className="grid gap-1 text-sm">
                    <span
                      className="text-xl text-amber-500"
                      aria-label={`${chamado.avaliacao_nota} de 5 estrelas`}
                    >
                      {"★".repeat(chamado.avaliacao_nota)}
                      <span className="text-muted-foreground/30">
                        {"★".repeat(5 - chamado.avaliacao_nota)}
                      </span>
                    </span>
                    {chamado.avaliacao_comentario ? (
                      <p className="whitespace-pre-wrap">{chamado.avaliacao_comentario}</p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">Obrigado pelo retorno!</p>
                  </div>
                ) : (
                  <AvaliacaoForm chamadoId={id} />
                )}
              </CardContent>
            </Card>
          ) : null}

          {ordens?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ordens de serviço</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {ordens.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                    <Link href={`/portal/os/${o.id}`} className="font-medium hover:underline">
                      OS {o.numero}
                    </Link>
                    <OsStatusBadge status={o.status} recusada={o.assinatura_recusada} />
                    <span className="flex-1" />
                    {o.status === "aguardando_assinatura" ? (
                      <Button size="sm" asChild>
                        <Link href={`/portal/os/${o.id}`}>
                          <FileSignature /> Assinar
                        </Link>
                      </Button>
                    ) : null}
                    {o.pdf_path ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/api/os/${o.id}/pdf`}>
                          <Download /> PDF
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
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
