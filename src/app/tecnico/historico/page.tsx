import Link from "next/link";
import { Download, History } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDataHora } from "@/lib/format";
import { lerPagina, Pagination } from "@/components/data/pagination";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { OsStatusBadge } from "@/components/os/resumo-os";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Histórico" };

const PAGE_SIZE = 20;

export default async function HistoricoTecnicoPage({ searchParams }: PageProps<"/tecnico/historico">) {
  await requireRole("tecnico");
  const sp = await searchParams;
  const page = lerPagina(sp.page);
  const supabase = await createClient();
  const { data: ordens, count } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, status, assinatura_recusada, finalizada_em, pdf_path, chamados(protocolo, titulo), clientes(nome_fantasia, razao_social)",
      { count: "exact" },
    )
    .not("finalizada_em", "is", null)
    .order("finalizada_em", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return (
    <>
      <PageHeader titulo="Histórico" descricao="Suas ordens de serviço encerradas." />
      {!ordens?.length ? (
        <EmptyState icon={History} titulo="Nenhuma OS encerrada ainda" />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-2">
            {ordens.map((o) => (
              <li key={o.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <Link href={`/tecnico/os/${o.id}/assinatura`} className="min-w-0 flex-1">
                      <div className="font-medium">
                        OS {o.numero}
                        {o.chamados ? (
                          <span className="text-muted-foreground font-normal"> · {o.chamados.protocolo}</span>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {o.clientes?.nome_fantasia || o.clientes?.razao_social}
                        {o.chamados?.titulo ? ` — ${o.chamados.titulo}` : ""} ·{" "}
                        {formatDataHora(o.finalizada_em)}
                      </div>
                    </Link>
                    <OsStatusBadge status={o.status} recusada={o.assinatura_recusada} />
                    {o.pdf_path ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/api/os/${o.id}/pdf`}>
                          <Download /> PDF
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination
            base="/tecnico/historico"
            params={sp}
            page={page}
            pageSize={PAGE_SIZE}
            total={count ?? 0}
          />
        </>
      )}
    </>
  );
}
