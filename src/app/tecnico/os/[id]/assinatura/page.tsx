import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, Download } from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarDetalhesOs, carregarOs, resumoParaExibicao } from "@/lib/os";
import { hashAtualOs } from "@/lib/os-encerramento";
import { formatDataHora } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { OsStatusBadge, ResumoOsCard } from "@/components/os/resumo-os";
import { ColetaAssinaturas } from "@/components/os/coleta-assinaturas";
import { VoltarEdicaoButton } from "@/components/os/acoes-os";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Assinatura da OS" };
// Encerrar a OS gera o PDF no servidor: dá folga ao tempo da função na Vercel.
export const maxDuration = 60;

export default async function AssinaturaOsPage({ params }: PageProps<"/tecnico/os/[id]/assinatura">) {
  const perfil = await requireRole("tecnico");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const os = await carregarOs(id);
  if (!os) notFound();
  if (!os.finalizada_em && os.status !== "aguardando_assinatura") redirect(`/tecnico/os/${id}`);

  const [detalhes, pdfCfg, assinaturaCfg] = await Promise.all([
    carregarDetalhesOs(id),
    getConfig("pdf"),
    getConfig("assinatura"),
  ]);
  const resumo = resumoParaExibicao(os, detalhes, pdfCfg.exibir_valores);
  const voltar = os.chamado_id ? `/tecnico/chamados/${os.chamado_id}` : "/tecnico";

  if (os.finalizada_em) {
    return (
      <>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={voltar}>
            <ArrowLeft /> Voltar
          </Link>
        </Button>
        <PageHeader titulo={`OS ${os.numero}`}>
          <OsStatusBadge status={os.status} recusada={os.assinatura_recusada} />
        </PageHeader>
        <Alert className="mb-4 border-emerald-500/40">
          <CircleCheck className="text-emerald-600" />
          <AlertTitle>
            {os.assinatura_recusada ? "OS encerrada sem assinatura do cliente" : "OS assinada e encerrada"}
          </AlertTitle>
          <AlertDescription>
            <span>
              Encerrada em {formatDataHora(os.finalizada_em)}.{" "}
              {os.chamado_id ? "O chamado foi marcado como resolvido." : ""}
            </span>
          </AlertDescription>
        </Alert>
        <div className="mb-4 flex flex-wrap gap-2">
          {os.pdf_path ? (
            <Button size="lg" asChild>
              <a href={`/api/os/${id}/pdf`}>
                <Download /> Baixar PDF
              </a>
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              O PDF está sendo gerado ou falhou; a Tonytec pode gerá-lo novamente.
            </p>
          )}
          <Button size="lg" variant="outline" asChild>
            <Link href="/tecnico">Voltar para Meu dia</Link>
          </Button>
        </div>
        <ResumoOsCard r={resumo} />
      </>
    );
  }

  // Aguardando assinatura
  // O técnico já assinou ESTE conteúdo (ex.: gerou o link antes)? Então não pede de novo.
  const sa = createAdminClient();
  const hash = await hashAtualOs(id);
  const { data: assinaturaTecnico } = hash
    ? await sa
        .from("os_assinaturas")
        .select("id")
        .eq("os_id", id)
        .eq("tipo", "tecnico")
        .eq("hash_documento", hash)
        .is("invalidada_em", null)
        .maybeSingle()
    : { data: null };
  const tecnicoJaAssinou = !!assinaturaTecnico;
  const { data: perfilDb } = await sa.from("profiles").select("assinatura_path").eq("id", perfil.id).single();
  const urlSalva = perfilDb?.assinatura_path
    ? ((await sa.storage.from("assinaturas").createSignedUrl(perfilDb.assinatura_path, 600)).data
        ?.signedUrl ?? null)
    : null;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href={voltar}>
          <ArrowLeft /> Voltar
        </Link>
      </Button>
      <PageHeader
        titulo={`Assinatura da OS ${os.numero}`}
        descricao="Confira o resumo com o cliente antes de assinar."
      >
        <VoltarEdicaoButton osId={id} destino={`/tecnico/os/${id}`} />
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ResumoOsCard r={resumo} />
        <ColetaAssinaturas
          osId={id}
          numero={os.numero}
          termo={assinaturaCfg.termo_aceite}
          urlAssinaturaSalva={urlSalva}
          tecnicoJaAssinou={tecnicoJaAssinou}
        />
      </div>
    </>
  );
}
