import { AlarmClock, CircleCheck, CircleAlert, Clock } from "lucide-react";
import type { Database } from "@/types/database";
import { StatusBadge } from "@/components/status-badge";
import { CHAMADO_STATUS, PRIORIDADE, PRIORIDADE_TOM, STATUS_TOM } from "@/lib/labels";
import type { SlaSituacao } from "@/lib/sla";

type Enums = Database["public"]["Enums"];

export function ChamadoStatusBadge({ status }: { status: Enums["chamado_status"] }) {
  return <StatusBadge tom={STATUS_TOM[status]}>{CHAMADO_STATUS[status]}</StatusBadge>;
}

export function PrioridadeBadge({ prioridade }: { prioridade: Enums["chamado_prioridade"] }) {
  return <StatusBadge tom={PRIORIDADE_TOM[prioridade]}>{PRIORIDADE[prioridade]}</StatusBadge>;
}

const ICONE_SLA = {
  cumprido: CircleCheck,
  violado: CircleAlert,
  estourado: CircleAlert,
  vencendo: AlarmClock,
  no_prazo: Clock,
  na: Clock,
} as const;

/** Indicador de SLA. `prefixo` ex.: "Resposta" / "Solução". */
export function SlaBadge({ sla, prefixo }: { sla: SlaSituacao; prefixo?: string }) {
  if (sla.estado === "na") return null;
  const Icone = ICONE_SLA[sla.estado];
  return (
    <StatusBadge tom={sla.tom} className="gap-1">
      <Icone className="size-3" aria-hidden />
      {prefixo ? `${prefixo}: ` : ""}
      {sla.texto}
    </StatusBadge>
  );
}
