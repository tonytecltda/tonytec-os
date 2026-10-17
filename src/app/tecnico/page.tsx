import { CalendarClock, MapPin } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDataHora } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Meu dia" };

export default async function TecnicoHome() {
  const profile = await requireRole("tecnico");
  const supabase = await createClient();

  // A RLS já limita aos chamados atribuídos a este técnico.
  const { data: chamados, error } = await supabase
    .from("chamados")
    .select(
      "id, protocolo, titulo, status, prioridade, data_agendada, clientes(nome_fantasia, razao_social), unidades(nome, cidade)",
    )
    .eq("ativo", true)
    .not("status", "in", "(resolvido,cancelado)")
    .order("data_agendada", { ascending: true, nullsFirst: false })
    .limit(50);

  return (
    <>
      <PageHeader titulo="Meu dia" descricao={`Chamados atribuídos a ${profile.nome || "você"}`} />
      {error ? (
        <p className="text-destructive text-sm">Não foi possível carregar seus chamados.</p>
      ) : !chamados?.length ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhum chamado atribuído no momento.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {chamados.map((c) => (
            <Card key={c.id}>
              <CardContent className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground font-mono text-xs">{c.protocolo}</span>
                  <Badge variant={c.prioridade === "urgente" ? "destructive" : "secondary"}>
                    {c.prioridade}
                  </Badge>
                </div>
                <div className="font-medium">{c.titulo}</div>
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {c.clientes?.nome_fantasia || c.clientes?.razao_social}
                    {c.unidades ? ` — ${c.unidades.nome}` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    {c.data_agendada ? formatDataHora(c.data_agendada) : "Sem agendamento"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
