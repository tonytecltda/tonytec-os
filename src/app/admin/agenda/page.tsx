import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { opcoesTecnicos } from "@/lib/chamados";
import { dataValida, mes, navegar, nomeMes, semana, tituloSemana } from "@/lib/agenda";
import { hojeISO, paraInputDataHora } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { FilterSelect } from "@/components/data/list-filters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgendaGrade, type EventoAgenda } from "./agenda-grade";

export const metadata = { title: "Agenda" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECT =
  "id, protocolo, titulo, status, prioridade, data_agendada, tecnico_id, clientes(razao_social, nome_fantasia), tecnico:profiles!chamados_tecnico_id_fkey(nome)";

export default async function AgendaPage({ searchParams }: PageProps<"/admin/agenda">) {
  await requireAdmin();
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  const visao = um(sp.view) === "mes" ? "mes" : "semana";
  const hoje = hojeISO();
  const data = dataValida(um(sp.data)) ? um(sp.data) : hoje;
  const tecnicoParam = um(sp.tecnico);
  const tecnico = tecnicoParam === "sem" || UUID.test(tecnicoParam) ? tecnicoParam : "";

  const grade = visao === "semana" ? semana(data) : mes(data);
  const mesRef = visao === "mes" ? (grade as ReturnType<typeof mes>).mesRef : data.slice(0, 7);

  const supabase = await createClient();
  const tecnicos = await opcoesTecnicos();
  const corDoTecnico = new Map(tecnicos.map((t, i) => [t.value, i]));

  const base = () => {
    let q = supabase.from("chamados").select(SELECT).eq("ativo", true).not("status", "in", "(cancelado)");
    if (tecnico === "sem") q = q.is("tecnico_id", null);
    else if (tecnico) q = q.eq("tecnico_id", tecnico);
    return q;
  };
  const [{ data: agendados }, { data: sem }] = await Promise.all([
    base()
      .gte("data_agendada", `${grade.inicio}T00:00:00-03:00`)
      .lt("data_agendada", `${grade.fimExclusivo}T00:00:00-03:00`)
      .order("data_agendada")
      .limit(500),
    base()
      .is("data_agendada", null)
      .not("status", "in", "(resolvido,cancelado)")
      .order("created_at")
      .limit(100),
  ]);

  const paraEvento = (c: NonNullable<typeof agendados>[number]): EventoAgenda => {
    const local = c.data_agendada ? paraInputDataHora(c.data_agendada) : null;
    return {
      id: c.id,
      protocolo: c.protocolo,
      titulo: c.titulo,
      cliente: c.clientes?.nome_fantasia || c.clientes?.razao_social || "—",
      tecnico: c.tecnico?.nome ?? null,
      dia: local ? local.slice(0, 10) : null,
      hora: local ? local.slice(11) : null,
      horarioLocal: local,
      prioridade: c.prioridade,
      status: c.status,
      cor: c.tecnico_id ? (corDoTecnico.get(c.tecnico_id) ?? 0) : 0,
    };
  };

  const link = (alvo: string, v = visao) => {
    const p = new URLSearchParams();
    if (v === "mes") p.set("view", "mes");
    p.set("data", alvo);
    if (tecnico) p.set("tecnico", tecnico);
    return `/admin/agenda?${p}`;
  };

  return (
    <>
      <PageHeader
        titulo="Agenda dos técnicos"
        descricao="No computador, arraste o chamado para outro dia. No celular, toque nele para escolher a data e a hora."
      >
        <div className="bg-muted flex rounded-lg p-0.5" role="group" aria-label="Visualização">
          {(["semana", "mes"] as const).map((v) => (
            <Link
              key={v}
              href={link(data, v)}
              aria-current={visao === v ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-md px-3 text-sm md:h-7 md:px-2.5",
                visao === v
                  ? "bg-background font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "semana" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          asChild
          aria-label={visao === "semana" ? "Semana anterior" : "Mês anterior"}
        >
          <Link href={link(navegar(data, visao, -1))}>
            <ChevronLeft />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          asChild
          aria-label={visao === "semana" ? "Próxima semana" : "Próximo mês"}
        >
          <Link href={link(navegar(data, visao, 1))}>
            <ChevronRight />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={link(hoje)}>
            <CalendarDays /> Hoje
          </Link>
        </Button>
        <h2 className="mx-2 text-base font-semibold first-letter:uppercase">
          {visao === "semana" ? tituloSemana(grade.dias) : nomeMes(mesRef)}
        </h2>
        <span className="flex-1" />
        <FilterSelect
          param="tecnico"
          placeholder="Técnico"
          opcoes={[
            { value: "", label: "Todos os técnicos" },
            { value: "sem", label: "Sem técnico" },
            ...tecnicos,
          ]}
        />
      </div>

      <AgendaGrade
        key={`${visao}-${data}-${tecnico}`}
        visao={visao}
        dias={grade.dias}
        mesRef={mesRef}
        hoje={hoje}
        eventos={(agendados ?? []).map(paraEvento)}
        semAgenda={(sem ?? []).map(paraEvento)}
      />

      {tecnicos.length ? (
        <ul
          className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs"
          aria-label="Legenda de técnicos"
        >
          {tecnicos.map((t, i) => (
            <li key={t.value} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block h-3 w-1 rounded-sm",
                  [
                    "bg-blue-500",
                    "bg-emerald-500",
                    "bg-amber-500",
                    "bg-violet-500",
                    "bg-rose-500",
                    "bg-cyan-500",
                    "bg-orange-500",
                    "bg-lime-600",
                  ][i % 8],
                )}
              />
              {t.label}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
