import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { carregarDetalhesOs, carregarOs, opcoesCatalogo, resumoParaExibicao } from "@/lib/os";
import { formatDataHora } from "@/lib/format";
import { TIPO_ATENDIMENTO } from "@/lib/labels";
import { PageHeader } from "@/components/page-header";
import { OsStatusBadge, ResumoOsCard } from "@/components/os/resumo-os";
import { AcoesAdminOs } from "@/components/os/acoes-os";
import { OsEditor } from "@/components/os/os-editor";
import { VisitasOs } from "@/components/os/visitas-os";
import { FotosOs } from "@/components/os/fotos-os";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkAssinaturaAdmin } from "./link-assinatura-admin";

export const metadata = { title: "Ordem de serviço" };
export const maxDuration = 60;

export default async function OsAdminDetalhePage({ params }: PageProps<"/admin/os/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const os = await carregarOs(id);
  if (!os) notFound();
  const [detalhes, pdfCfg] = await Promise.all([carregarDetalhesOs(id), getConfig("pdf")]);
  const finalizada = !!os.finalizada_em;
  const editavel = !finalizada && (os.status === "rascunho" || os.status === "em_execucao");
  const catalogo = editavel ? await opcoesCatalogo() : [];
  const cliente = os.clientes?.nome_fantasia || os.clientes?.razao_social;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/os">
          <ArrowLeft /> Ordens de serviço
        </Link>
      </Button>
      <PageHeader titulo={os.numero} descricao={`${cliente} · ${TIPO_ATENDIMENTO[os.tipo_atendimento]}`}>
        <OsStatusBadge status={os.status} recusada={os.assinatura_recusada} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {os.pdf_path ? (
          <Button asChild>
            <a href={`/api/os/${id}/pdf`}>
              <Download /> Baixar PDF
            </a>
          </Button>
        ) : null}
        {os.status === "aguardando_assinatura" && !finalizada ? (
          <LinkAssinaturaAdmin osId={id} numero={os.numero} />
        ) : null}
        <AcoesAdminOs
          osId={id}
          finalizada={finalizada}
          cancelada={os.status === "cancelada"}
          temPdf={!!os.pdf_path}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="grid min-w-0 content-start gap-4">
          {editavel ? (
            <>
              <VisitasOs
                osId={id}
                editavel
                visitas={detalhes.visitas.map((v) => ({
                  id: v.id,
                  chegada: v.data_hora_chegada,
                  saida: v.data_hora_saida,
                  horas: v.horas_trabalhadas == null ? null : Number(v.horas_trabalhadas),
                }))}
              />
              <FotosOs osId={id} fotos={detalhes.fotos} editavel />
              <OsEditor
                osId={id}
                podeConcluir={false}
                atualizadoEm={os.updated_at}
                catalogo={catalogo}
                urlAssinatura={`/admin/os/${id}`}
                inicial={{
                  tipo_atendimento: os.tipo_atendimento,
                  problema_relatado: os.problema_relatado ?? "",
                  diagnostico: os.diagnostico ?? "",
                  servico_executado: os.servico_executado ?? "",
                  observacoes_tecnicas: os.observacoes_tecnicas ?? "",
                  recomendacoes: os.recomendacoes ?? "",
                  pendencias: os.pendencias,
                  pendencias_texto: os.pendencias_texto ?? "",
                  itens: detalhes.itens.map((i) => ({
                    id: i.id,
                    catalogo_id: i.catalogo_id,
                    descricao: i.descricao,
                    tipo: i.tipo,
                    quantidade: i.quantidade,
                    valor_unitario: i.valor_unitario,
                    cobrado: i.cobrado,
                  })),
                }}
              />
            </>
          ) : (
            <ResumoOsCard r={resumoParaExibicao(os, detalhes, true)} />
          )}
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Chamado: </span>
                {os.chamados ? (
                  <Link href={`/admin/chamados/${os.chamados.id}`} className="underline underline-offset-4">
                    {os.chamados.protocolo}
                  </Link>
                ) : (
                  "sem chamado"
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Técnico: </span>
                {os.tecnico_nome_snapshot ?? os.tecnico?.nome ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Início: </span>
                {formatDataHora(os.data_inicio)}
              </p>
              <p>
                <span className="text-muted-foreground">Fim: </span>
                {formatDataHora(os.data_fim)}
              </p>
              {os.finalizada_em ? (
                <p>
                  <span className="text-muted-foreground">Encerrada: </span>
                  {formatDataHora(os.finalizada_em)}
                </p>
              ) : null}
              {os.assinatura_recusada ? (
                <p className="text-amber-700 dark:text-amber-400">Cliente não assinou: {os.motivo_recusa}</p>
              ) : null}
              {pdfCfg.exibir_valores ? null : (
                <p className="text-muted-foreground text-xs">
                  O PDF do cliente está configurado para não mostrar valores.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assinaturas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!detalhes.assinaturas.length ? (
                <p className="text-muted-foreground text-sm">Nenhuma assinatura registrada.</p>
              ) : (
                detalhes.assinaturas.map((a) => (
                  <div key={a.id} className="grid gap-1 rounded-lg border p-2">
                    {a.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.url}
                        alt={`Assinatura de ${a.nome}`}
                        className="h-16 rounded bg-white object-contain"
                      />
                    ) : null}
                    <div className="text-sm font-medium">{a.nome}</div>
                    <div className="text-muted-foreground text-xs">
                      {a.tipo === "tecnico"
                        ? "Técnico"
                        : a.remota
                          ? "Cliente (remota)"
                          : "Cliente (no local)"}
                      {a.documento ? ` · Doc. ${a.documento}` : ""} · {formatDataHora(a.assinadoEm)}
                    </div>
                  </div>
                ))
              )}
              {os.hash_conteudo ? (
                <p className="text-muted-foreground flex gap-1.5 text-[11px] break-all">
                  <ShieldCheck className="size-3.5 shrink-0" /> SHA-256: {os.hash_conteudo}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
