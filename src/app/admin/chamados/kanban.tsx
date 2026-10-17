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
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/types/database";
import { StatusBadge, type Tom } from "@/components/status-badge";
import { moverStatusChamado } from "@/actions/chamados";
import { CHAMADO_STATUS, PRIORIDADE, PRIORIDADE_TOM, STATUS_TOM } from "@/lib/labels";
import { formatDataHora } from "@/lib/format";
import { cn } from "@/lib/utils";

type Status = Database["public"]["Enums"]["chamado_status"];

export type CardChamado = {
  id: string;
  protocolo: string;
  titulo: string;
  status: Status;
  prioridade: Database["public"]["Enums"]["chamado_prioridade"];
  dataAgendada: string | null;
  cliente: string;
  unidade: string | null;
  tecnico: string | null;
  /** SLA já calculado no servidor (evita diferença de horário na hidratação). */
  sla: { texto: string; tom: Tom; tipo: string; estado: string } | null;
};

const COLUNAS: Status[] = [
  "aberto",
  "triagem",
  "agendado",
  "em_atendimento",
  "aguardando_cliente",
  "aguardando_peca",
  "resolvido",
];

function CardVisual({ c, arrastando }: { c: CardChamado; arrastando?: boolean }) {
  return (
    <div
      className={cn(
        "bg-card grid gap-2 rounded-lg border p-3 text-sm shadow-xs",
        arrastando && "ring-primary rotate-1 shadow-lg ring-2",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-mono text-[11px]">{c.protocolo}</span>
        {c.prioridade === "urgente" || c.prioridade === "alta" ? (
          <StatusBadge tom={PRIORIDADE_TOM[c.prioridade]}>{PRIORIDADE[c.prioridade]}</StatusBadge>
        ) : null}
      </div>
      <div className="line-clamp-2 font-medium">{c.titulo}</div>
      <div className="text-muted-foreground truncate text-xs">
        {c.cliente}
        {c.unidade ? ` · ${c.unidade}` : ""}
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3" /> {c.tecnico ?? "Sem técnico"}
        </span>
        {c.dataAgendada ? (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" /> {formatDataHora(c.dataAgendada)}
          </span>
        ) : null}
      </div>
      {c.sla && c.status !== "resolvido" ? (
        <StatusBadge tom={c.sla.tom} className="w-fit">
          {c.sla.tipo}: {c.sla.texto}
        </StatusBadge>
      ) : null}
    </div>
  );
}

function CardArrastavel({ c }: { c: CardChamado }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id, data: c });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
      {...listeners}
      {...attributes}
      aria-roledescription="Chamado arrastável"
      aria-label={`${c.protocolo} — ${c.titulo}. Status ${CHAMADO_STATUS[c.status]}.`}
    >
      <Link
        href={`/admin/chamados/${c.id}`}
        className="block rounded-lg outline-none focus-visible:ring-3"
        draggable={false}
      >
        <CardVisual c={c} />
      </Link>
    </div>
  );
}

function Coluna({ status, itens }: { status: Status; itens: CardChamado[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={CHAMADO_STATUS[status]}
      className={cn(
        "bg-muted/40 flex w-72 shrink-0 flex-col gap-2 rounded-xl border p-2 transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <header className="flex items-center justify-between px-1 py-1">
        <StatusBadge tom={STATUS_TOM[status]}>{CHAMADO_STATUS[status]}</StatusBadge>
        <span className="text-muted-foreground text-xs tabular-nums">{itens.length}</span>
      </header>
      <div className="grid min-h-24 content-start gap-2">
        {itens.map((c) => (
          <CardArrastavel key={c.id} c={c} />
        ))}
        {!itens.length ? (
          <p className="text-muted-foreground px-1 py-6 text-center text-xs">Arraste chamados para cá</p>
        ) : null}
      </div>
    </section>
  );
}

/** Quadro Kanban: arrastar um chamado muda o status (com confirmação do servidor). */
export function KanbanChamados({ chamados }: { chamados: CardChamado[] }) {
  const router = useRouter();
  const [itens, setItens] = useState(chamados);
  const [origem, setOrigem] = useState(chamados);
  const [ativo, setAtivo] = useState<CardChamado | null>(null);
  const [, startTransition] = useTransition();

  // Dados novos do servidor (após refresh/filtro): recomeça a partir deles.
  if (chamados !== origem) {
    setOrigem(chamados);
    setItens(chamados);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) => setAtivo((e.active.data.current as CardChamado) ?? null);

  const onDragEnd = (e: DragEndEvent) => {
    setAtivo(null);
    const destino = e.over?.id as Status | undefined;
    const card = itens.find((c) => c.id === e.active.id);
    if (!destino || !card || card.status === destino) return;

    const anterior = card.status;
    setItens((lista) => lista.map((c) => (c.id === card.id ? { ...c, status: destino } : c)));
    startTransition(async () => {
      const r = await moverStatusChamado(card.id, destino);
      if (!r.ok) {
        setItens((lista) => lista.map((c) => (c.id === card.id ? { ...c, status: anterior } : c)));
        toast.error(r.error);
        return;
      }
      toast.success(`${card.protocolo}: ${CHAMADO_STATUS[destino]}`);
      router.refresh();
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setAtivo(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para mover um chamado, pressione espaço ou enter, use as setas para escolher a coluna e pressione espaço ou enter de novo.",
        },
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-6 lg:px-6">
        <div className="flex min-w-max items-start gap-3">
          {COLUNAS.map((status) => (
            <Coluna key={status} status={status} itens={itens.filter((c) => c.status === status)} />
          ))}
        </div>
      </div>
      <DragOverlay>{ativo ? <CardVisual c={ativo} arrastando /> : null}</DragOverlay>
    </DndContext>
  );
}
