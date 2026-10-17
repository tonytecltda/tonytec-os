import Link from "next/link";
import { CalendarClock, ChevronRight, MapPin, Navigation, Sun } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDataHora, hojeISO, paraInputDataHora } from "@/lib/format";
import { linkRotaMaps } from "@/lib/endereco";
import { PRIORIDADE_PESO } from "@/lib/labels";
import { slaPrincipal } from "@/lib/sla";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ChamadoStatusBadge, PrioridadeBadge, SlaBadge } from "@/components/chamados/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Meu dia" };

export default async function TecnicoHome() {
  const profile = await requireRole("tecnico");
  const supabase = await createClient();

  // A RLS já limita aos chamados atribuídos a este técnico.
  const { data: chamados, error } = await supabase
    .from("chamados")
    .select(
      "id, protocolo, titulo, status, prioridade, created_at, data_agendada, sla_resposta_ate, sla_solucao_ate, primeira_resposta_em, resolvido_em, clientes(nome_fantasia, razao_social), unidades(nome, logradouro, numero, bairro, cidade, uf, cep)",
    )
    .eq("ativo", true)
    .not("status", "in", "(resolvido,cancelado)")
    .limit(100);

  // Ordem: agendados (por horário), depois os sem agenda por prioridade.
  const lista = (chamados ?? []).sort((a, b) => {
    if (a.data_agendada && b.data_agendada) return a.data_agendada.localeCompare(b.data_agendada);
    if (a.data_agendada) return -1;
    if (b.data_agendada) return 1;
    return (
      PRIORIDADE_PESO[a.prioridade] - PRIORIDADE_PESO[b.prioridade] ||
      a.created_at.localeCompare(b.created_at)
    );
  });
  const hoje = hojeISO();
  const deHoje = lista.filter((c) => paraInputDataHora(c.data_agendada).slice(0, 10) === hoje);

  return (
    <>
      <PageHeader
        titulo="Meu dia"
        descricao={`${profile.nome || "Técnico"} · ${deHoje.length} visita(s) hoje · ${lista.length} chamado(s) em aberto`}
      />
      {error ? (
        <p className="text-destructive text-sm">Não foi possível carregar seus chamados.</p>
      ) : !lista.length ? (
        <EmptyState
          icon={Sun}
          titulo="Nenhum chamado atribuído"
          descricao="Quando a Tonytec atribuir um chamado a você, ele aparece aqui."
        />
      ) : (
        <ul className="grid gap-3">
          {lista.map((c) => {
            const rota = c.unidades ? linkRotaMaps(c.unidades) : null;
            const sla = slaPrincipal(c);
            return (
              <li key={c.id}>
                <Card>
                  <CardContent className="grid gap-3">
                    <Link
                      href={`/tecnico/chamados/${c.id}`}
                      className="grid gap-1.5 rounded-md outline-none focus-visible:ring-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground font-mono text-xs">{c.protocolo}</span>
                        <ChamadoStatusBadge status={c.status} />
                        <PrioridadeBadge prioridade={c.prioridade} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 font-medium">{c.titulo}</span>
                        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                      </div>
                      <div className="text-muted-foreground grid gap-1 text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" />
                          {c.clientes?.nome_fantasia || c.clientes?.razao_social}
                          {c.unidades ? ` — ${c.unidades.nome}` : ""}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="size-3.5 shrink-0" />
                          {c.data_agendada ? formatDataHora(c.data_agendada) : "Sem agendamento"}
                        </span>
                      </div>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      {rota ? (
                        <Button size="lg" asChild className="flex-1 sm:flex-none">
                          <a href={rota} target="_blank" rel="noopener noreferrer">
                            <Navigation /> Abrir rota
                          </a>
                        </Button>
                      ) : null}
                      <SlaBadge sla={sla} prefixo={sla.tipo} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
