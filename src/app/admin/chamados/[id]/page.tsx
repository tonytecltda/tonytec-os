import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSignature } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { carregarAnexos, carregarChamado, carregarTimeline, opcoesTecnicos } from "@/lib/chamados";
import { formatDataHora, paraInputDataHora } from "@/lib/format";
import { ORIGEM } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { ChamadoStatusBadge, PrioridadeBadge } from "@/components/chamados/badges";
import { ListaAnexos } from "@/components/chamados/anexos";
import { ComentarioForm } from "@/components/chamados/comentario-form";
import { EnviarAnexos } from "@/components/chamados/enviar-anexos";
import { SlaPainel, UnidadeInfo } from "@/components/chamados/painel-info";
import { Timeline } from "@/components/chamados/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { AbrirOsChamadoButton } from "@/components/os/acoes-os";
import { OsStatusBadge } from "@/components/os/resumo-os";
import { GestaoChamadoForm } from "./gestao-form";

export async function generateMetadata({ params }: PageProps<"/admin/chamados/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { title: "Chamado" };
  const c = await carregarChamado(id);
  return { title: c ? `${c.protocolo} · ${c.titulo}` : "Chamado" };
}

export default async function ChamadoAdminPage({ params }: PageProps<"/admin/chamados/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const chamado = await carregarChamado(id);
  if (!chamado) notFound();
  const supabase = await createClient();
  const [eventos, anexos, tecnicos, { data: ordens }] = await Promise.all([
    carregarTimeline(id),
    carregarAnexos(id),
    opcoesTecnicos(),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, finalizada_em, assinatura_recusada")
      .eq("chamado_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // Técnico atual inativo continua aparecendo na lista para não "sumir" do formulário.
  if (chamado.tecnico && !tecnicos.some((t) => t.value === chamado.tecnico!.id)) {
    tecnicos.unshift({ value: chamado.tecnico.id, label: `${chamado.tecnico.nome} (inativo)` });
  }
  const clienteNome = chamado.clientes?.nome_fantasia || chamado.clientes?.razao_social;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/chamados">
          <ArrowLeft /> Chamados
        </Link>
      </Button>
      <PageHeader titulo={chamado.titulo} descricao={`${chamado.protocolo} · ${clienteNome}`}>
        <ChamadoStatusBadge status={chamado.status} />
        <PrioridadeBadge prioridade={chamado.prioridade} />
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{chamado.descricao || "—"}</p>
              <dl className="text-muted-foreground mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div>
                  <dt className="inline">Categoria: </dt>
                  <dd className="text-foreground inline">
                    {[chamado.categorias_servico?.nome, chamado.tipos_problema?.nome]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Origem: </dt>
                  <dd className="text-foreground inline">{ORIGEM[chamado.origem]}</dd>
                </div>
                <div>
                  <dt className="inline">Aberto por: </dt>
                  <dd className="text-foreground inline">{chamado.abertoPor?.nome ?? "—"}</dd>
                </div>
                <div>
                  <dt className="inline">Aberto em: </dt>
                  <dd className="text-foreground inline">{formatDataHora(chamado.created_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Anexos</CardTitle>
              <EnviarAnexos chamadoId={id} />
            </CardHeader>
            <CardContent>
              <ListaAnexos anexos={anexos} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linha do tempo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <Timeline eventos={eventos} />
              <ComentarioForm chamadoId={id} permitirInterno />
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gestão</CardTitle>
            </CardHeader>
            <CardContent>
              <GestaoChamadoForm
                key={`${chamado.status}-${chamado.updated_at}`}
                chamadoId={id}
                tecnicos={tecnicos}
                inicial={{
                  status: chamado.status,
                  prioridade: chamado.prioridade,
                  tecnico_id: chamado.tecnico?.id ?? "",
                  data_agendada: paraInputDataHora(chamado.data_agendada),
                  motivo: "",
                }}
              />
              <div className="mt-3 grid gap-2">
                {!ordens?.some((o) => !o.finalizada_em && o.status !== "cancelada") &&
                chamado.status !== "cancelado" ? (
                  <AbrirOsChamadoButton chamadoId={id} />
                ) : null}
                {(ordens ?? []).map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/os/${o.id}`}
                    className="hover:bg-muted/50 flex items-center gap-2 rounded-lg border p-2 text-sm"
                  >
                    <FileSignature className="text-primary size-4" />
                    <span className="font-medium">OS {o.numero}</span>
                    <span className="flex-1" />
                    <OsStatusBadge status={o.status} recusada={o.assinatura_recusada} />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
          {chamado.avaliacao_nota ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avaliação do cliente</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <span className="text-amber-500" aria-label={`${chamado.avaliacao_nota} de 5 estrelas`}>
                  {"★".repeat(chamado.avaliacao_nota)}
                  <span className="text-muted-foreground/40">{"★".repeat(5 - chamado.avaliacao_nota)}</span>
                </span>
                {chamado.avaliacao_comentario ? (
                  <p className="whitespace-pre-wrap">{chamado.avaliacao_comentario}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLA</CardTitle>
            </CardHeader>
            <CardContent>
              <SlaPainel chamado={chamado} />
              <p className="text-muted-foreground mt-3 text-xs">
                {chamado.contratos ? (
                  <>
                    Prazos do contrato{" "}
                    <Link
                      href={`/admin/contratos/${chamado.contratos.id}`}
                      className="underline underline-offset-4"
                    >
                      {chamado.contratos.numero}
                    </Link>
                    .
                  </>
                ) : (
                  "Prazos padrão por prioridade (cliente sem contrato vigente)."
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cliente e local</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Link
                href={`/admin/clientes/${chamado.cliente_id}`}
                className="text-sm font-medium hover:underline"
              >
                {clienteNome}
              </Link>
              <UnidadeInfo unidade={chamado.unidades} telefoneContato={chamado.telefone_contato} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
