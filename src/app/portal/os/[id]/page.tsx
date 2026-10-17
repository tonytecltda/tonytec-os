import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Hourglass } from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarDetalhesOs, carregarOs, resumoParaExibicao } from "@/lib/os";
import { formatDataHora } from "@/lib/format";
import { assinarPeloPortal } from "@/actions/os";
import { PageHeader } from "@/components/page-header";
import { OsStatusBadge, ResumoOsCard } from "@/components/os/resumo-os";
import { AssinaturaClienteForm } from "@/components/os/assinatura-cliente-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ordem de serviço" };
export const maxDuration = 60;

export default async function PortalOsDetalhePage({ params }: PageProps<"/portal/os/[id]">) {
  const perfil = await requireRole("cliente");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const os = await carregarOs(id); // RLS: só OS do próprio cliente
  if (!os) notFound();
  const [detalhes, pdfCfg, assinaturaCfg] = await Promise.all([
    carregarDetalhesOs(id),
    getConfig("pdf"),
    getConfig("assinatura"),
  ]);

  // Pode assinar pelo portal se a OS aguarda assinatura e o técnico já assinou.
  const aguardando = os.status === "aguardando_assinatura" && !os.finalizada_em;
  const { data: assTecnico } = aguardando
    ? await createAdminClient()
        .from("os_assinaturas")
        .select("id")
        .eq("os_id", id)
        .eq("tipo", "tecnico")
        .is("invalidada_em", null)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/portal/os">
          <ArrowLeft /> Ordens de serviço
        </Link>
      </Button>
      <PageHeader
        titulo={`OS ${os.numero}`}
        descricao={os.chamados ? `Chamado ${os.chamados.protocolo}` : undefined}
      >
        <OsStatusBadge status={os.status} recusada={os.assinatura_recusada} />
      </PageHeader>

      {os.pdf_path ? (
        <Button size="lg" asChild className="mb-4">
          <a href={`/api/os/${id}/pdf`}>
            <Download /> Baixar PDF
          </a>
        </Button>
      ) : null}
      {os.finalizada_em ? (
        <p className="text-muted-foreground mb-4 text-sm">Encerrada em {formatDataHora(os.finalizada_em)}.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ResumoOsCard r={resumoParaExibicao(os, detalhes, pdfCfg.exibir_valores)} />
        {aguardando ? (
          assTecnico ? (
            <AssinaturaClienteForm
              acao={assinarPeloPortal.bind(null, id)}
              termo={assinaturaCfg.termo_aceite}
              nomeSugerido={perfil.nome}
            />
          ) : (
            <Alert>
              <Hourglass />
              <AlertTitle>Aguardando o técnico</AlertTitle>
              <AlertDescription>
                A assinatura fica disponível assim que o técnico concluir a OS.
              </AlertDescription>
            </Alert>
          )
        ) : null}
      </div>
    </>
  );
}
