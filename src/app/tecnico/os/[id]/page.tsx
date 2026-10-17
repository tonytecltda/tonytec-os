import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { carregarDetalhesOs, carregarOs, opcoesCatalogo } from "@/lib/os";
import { enderecoCompleto } from "@/lib/endereco";
import { PageHeader } from "@/components/page-header";
import { OsStatusBadge } from "@/components/os/resumo-os";
import { OsEditor } from "@/components/os/os-editor";
import { VisitasOs } from "@/components/os/visitas-os";
import { FotosOs } from "@/components/os/fotos-os";
import { IniciarOsButton } from "@/components/os/acoes-os";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ordem de serviço" };

export default async function TecnicoOsPage({ params }: PageProps<"/tecnico/os/[id]">) {
  await requireRole("tecnico");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const os = await carregarOs(id); // RLS: só OS do próprio técnico
  if (!os) notFound();
  if (os.finalizada_em || os.status === "aguardando_assinatura") redirect(`/tecnico/os/${id}/assinatura`);
  if (os.status === "cancelada") redirect("/tecnico");

  const [detalhes, catalogo] = await Promise.all([carregarDetalhesOs(id), opcoesCatalogo()]);
  const naoIniciada = os.status === "rascunho" && !detalhes.visitas.length;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href={os.chamado_id ? `/tecnico/chamados/${os.chamado_id}` : "/tecnico"}>
          <ArrowLeft /> {os.chamados?.protocolo ?? "Meu dia"}
        </Link>
      </Button>
      <PageHeader
        titulo={`OS ${os.numero}`}
        descricao={[
          os.clientes?.nome_fantasia || os.clientes?.razao_social,
          os.unidades ? `${os.unidades.nome} · ${enderecoCompleto(os.unidades)}` : null,
        ]
          .filter(Boolean)
          .join(" — ")}
      >
        <OsStatusBadge status={os.status} recusada={os.assinatura_recusada} />
      </PageHeader>

      <div className="grid gap-4">
        {naoIniciada ? <IniciarOsButton osId={id} /> : null}
        <VisitasOs
          osId={id}
          editavel={!naoIniciada}
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
          atualizadoEm={os.updated_at}
          catalogo={catalogo}
          urlAssinatura={`/tecnico/os/${id}/assinatura`}
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
      </div>
    </>
  );
}
