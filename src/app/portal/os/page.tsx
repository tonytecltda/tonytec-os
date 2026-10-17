import Link from "next/link";
import { ChevronRight, Download, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatData } from "@/lib/format";
import { lerPagina, Pagination } from "@/components/data/pagination";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { OsStatusBadge } from "@/components/os/resumo-os";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Ordens de serviço" };

const PAGE_SIZE = 20;

export default async function PortalOsPage({ searchParams }: PageProps<"/portal/os">) {
  await requireRole("cliente");
  const sp = await searchParams;
  const page = lerPagina(sp.page);
  const supabase = await createClient();
  // A RLS mostra ao cliente só as OS dele que já foram concluídas/assinadas ou aguardam assinatura.
  const { data: ordens, count } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, status, assinatura_recusada, data_fim, finalizada_em, pdf_path, chamados(protocolo, titulo), unidades(nome)",
      {
        count: "exact",
      },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return (
    <>
      <PageHeader
        titulo="Ordens de serviço"
        descricao="Atendimentos realizados pela Tonytec, com o PDF assinado."
      />
      {!ordens?.length ? (
        <EmptyState icon={FileText} titulo="Nenhuma ordem de serviço ainda" />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3">
            {ordens.map((o) => (
              <li key={o.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <Link href={`/portal/os/${o.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">OS {o.numero}</span>
                        <OsStatusBadge status={o.status} recusada={o.assinatura_recusada} />
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {[o.chamados?.titulo, o.unidades?.nome, o.data_fim ? formatData(o.data_fim) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </Link>
                    {o.pdf_path ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/api/os/${o.id}/pdf`}>
                          <Download /> PDF
                        </a>
                      </Button>
                    ) : (
                      <ChevronRight className="text-muted-foreground size-4" />
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination base="/portal/os" params={sp} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
        </>
      )}
    </>
  );
}
