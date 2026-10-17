"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { reagendarChamado } from "@/actions/chamados";
import { diaDoMes, nomeDiaCurto } from "@/lib/agenda";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type EventoAgenda = {
  id: string;
  protocolo: string;
  titulo: string;
  cliente: string;
  tecnico: string | null;
  /** Dia (aaaa-mm-dd) e hora (hh:mm) de Brasília; null = sem agendamento. */
  dia: string | null;
  hora: string | null;
  horarioLocal: string | null;
  prioridade: string;
  status: string;
  cor: number;
};

const CORES = [
  "border-l-blue-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-violet-500",
  "border-l-rose-500",
  "border-l-cyan-500",
  "border-l-orange-500",
  "border-l-lime-600",
];

function Cartao({ e, compacto, arrastando }: { e: EventoAgenda; compacto?: boolean; arrastando?: boolean }) {
  return (
    <div
      className={cn(
        "bg-card grid gap-0.5 rounded-md border border-l-4 px-2 py-1.5 text-xs shadow-xs",
        CORES[e.cor % CORES.length],
        arrastando && "ring-primary rotate-1 shadow-lg ring-2",
      )}
    >
      <div className="flex items-center gap-1.5">
        {e.hora ? <span className="font-semibold tabular-nums">{e.hora}</span> : null}
        <span className="text-muted-foreground truncate font-mono text-[10px]">{e.protocolo}</span>
        {e.prioridade === "urgente" || e.prioridade === "alta" ? (
          <span className="rounded bg-red-500/15 px-1 text-[10px] font-medium text-red-700 dark:text-red-400">
            {e.prioridade === "urgente" ? "Urgente" : "Alta"}
          </span>
        ) : null}
      </div>
      <div className="line-clamp-2 leading-tight font-medium">{e.titulo}</div>
      {compacto ? null : (
        <div className="text-muted-foreground truncate">
          {e.cliente}
          {e.tecnico ? ` · ${e.tecnico}` : " · sem técnico"}
        </div>
      )}
    </div>
  );
}

function Arrastavel({
  e,
  compacto,
  onAbrir,
}: {
  e: EventoAgenda;
  compacto?: boolean;
  onAbrir: (e: EventoAgenda) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: e.id, data: e });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
      {...listeners}
      {...attributes}
      aria-roledescription="Chamado arrastável"
      aria-label={`${e.protocolo} — ${e.titulo}${e.hora ? ` às ${e.hora}` : ""}`}
    >
      <button
        type="button"
        className="block w-full rounded-md text-left outline-none focus-visible:ring-3"
        onClick={() => onAbrir(e)}
      >
        <Cartao e={e} compacto={compacto} />
      </button>
    </div>
  );
}

function Dia({
  dia,
  hoje,
  eventos,
  visao,
  foraDoMes,
  onAbrir,
}: {
  dia: string;
  hoje: string;
  eventos: EventoAgenda[];
  visao: "semana" | "mes";
  foraDoMes?: boolean;
  onAbrir: (e: EventoAgenda) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dia });
  const ehHoje = dia === hoje;
  const limite = visao === "mes" ? 3 : 99;
  return (
    <section
      ref={setNodeRef}
      aria-label={`${nomeDiaCurto(dia)} ${dia.split("-").reverse().slice(0, 2).join("/")}`}
      className={cn(
        "flex min-h-24 flex-col gap-1.5 rounded-lg border p-1.5 transition-colors",
        visao === "semana" && "min-h-56",
        foraDoMes && "bg-muted/30",
        ehHoje && "border-primary",
        isOver && "bg-primary/10 border-primary",
      )}
    >
      <header className="flex items-center justify-between px-0.5">
        <span
          className={cn(
            "text-xs font-medium",
            foraDoMes && "text-muted-foreground",
            ehHoje && "text-primary",
          )}
        >
          <span className="mr-1 capitalize">{nomeDiaCurto(dia)}</span>
          {diaDoMes(dia)}
        </span>
        {eventos.length ? (
          <span className="text-muted-foreground text-[10px] tabular-nums">{eventos.length}</span>
        ) : null}
      </header>
      <div className="grid gap-1">
        {eventos.slice(0, limite).map((e) => (
          <Arrastavel key={e.id} e={e} compacto={visao === "mes"} onAbrir={onAbrir} />
        ))}
        {eventos.length > limite ? (
          <span className="text-muted-foreground px-1 text-[11px]">+{eventos.length - limite} mais</span>
        ) : null}
      </div>
    </section>
  );
}

/** Calendário (semana ou mês): arraste um chamado para outro dia ou clique para escolher o horário. */
export function AgendaGrade({
  visao,
  dias,
  mesRef,
  hoje,
  eventos,
  semAgenda,
}: {
  visao: "semana" | "mes";
  dias: string[];
  mesRef: string;
  hoje: string;
  eventos: EventoAgenda[];
  semAgenda: EventoAgenda[];
}) {
  const router = useRouter();
  const [ativo, setAtivo] = useState<EventoAgenda | null>(null);
  const [editando, setEditando] = useState<EventoAgenda | null>(null);
  const [horario, setHorario] = useState("");
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const todos = [...eventos, ...semAgenda];

  const aoSoltar = (ev: DragEndEvent) => {
    setAtivo(null);
    const dia = ev.over?.id as string | undefined;
    const item = todos.find((e) => e.id === ev.active.id);
    if (!dia || !item || item.dia === dia) return;
    startTransition(async () => {
      const r = await reagendarChamado(item.id, { dia });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${item.protocolo} reagendado para ${dia.split("-").reverse().join("/")}.`);
      router.refresh();
    });
  };

  const abrir = (e: EventoAgenda) => {
    setEditando(e);
    setHorario(e.horarioLocal ?? `${e.dia ?? hoje}T09:00`);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(ev) => setAtivo((ev.active.data.current as EventoAgenda) ?? null)}
      onDragEnd={aoSoltar}
      onDragCancel={() => setAtivo(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para reagendar, pressione espaço ou enter, use as setas até o dia desejado e pressione espaço ou enter de novo. Ou abra o chamado e escolha a data.",
        },
      }}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <div
          className={cn(
            "grid gap-1.5",
            visao === "semana"
              ? "sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
              : "grid-cols-1 sm:grid-cols-7",
          )}
        >
          {dias.map((dia) => (
            <Dia
              key={dia}
              dia={dia}
              hoje={hoje}
              visao={visao}
              foraDoMes={visao === "mes" && !dia.startsWith(mesRef)}
              eventos={eventos.filter((e) => e.dia === dia)}
              onAbrir={abrir}
            />
          ))}
        </div>

        <aside aria-label="Chamados sem agendamento" className="rounded-lg border p-2 xl:self-start">
          <h2 className="mb-2 px-1 text-sm font-semibold">Sem agendamento ({semAgenda.length})</h2>
          <p className="text-muted-foreground mb-2 px-1 text-xs">
            Arraste para um dia do calendário (horário padrão 09:00).
          </p>
          <div className="grid max-h-[28rem] gap-1.5 overflow-y-auto">
            {semAgenda.map((e) => (
              <Arrastavel key={e.id} e={e} onAbrir={abrir} />
            ))}
            {!semAgenda.length ? (
              <p className="text-muted-foreground px-1 py-4 text-center text-xs">Tudo agendado.</p>
            ) : null}
          </div>
        </aside>
      </div>

      <DragOverlay>{ativo ? <Cartao e={ativo} arrastando /> : null}</DragOverlay>

      {editando ? (
        <Dialog open onOpenChange={(o) => !o && !pending && setEditando(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editando.protocolo} · {editando.titulo}
              </DialogTitle>
              <DialogDescription>
                {editando.cliente}
                {editando.tecnico ? ` · ${editando.tecnico}` : " · sem técnico"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="ag-horario">Visita agendada para</Label>
              <Input
                id="ag-horario"
                type="datetime-local"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
              />
            </div>
            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" asChild>
                <Link href={`/admin/chamados/${editando.id}`}>Abrir chamado</Link>
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditando(null)} disabled={pending}>
                  Cancelar
                </Button>
                <Button
                  disabled={pending || !horario}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await reagendarChamado(editando.id, { horario });
                      if (!r.ok) return void toast.error(r.error);
                      toast.success(r.message);
                      setEditando(null);
                      router.refresh();
                    })
                  }
                >
                  {pending ? <Spinner /> : <CalendarClock />} Reagendar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </DndContext>
  );
}
