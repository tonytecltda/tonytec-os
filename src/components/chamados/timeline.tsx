import { History, Lock, MessageSquare } from "lucide-react";
import type { EventoTimeline } from "@/lib/chamados";
import { formatDataHora } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Linha do tempo do chamado: mensagens + mudanças automáticas (histórico). */
export function Timeline({ eventos }: { eventos: EventoTimeline[] }) {
  if (!eventos.length) {
    return <p className="text-muted-foreground text-sm">Nenhuma movimentação ainda.</p>;
  }
  return (
    <ol className="before:bg-border relative grid gap-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px">
      {eventos.map((e) =>
        e.tipo === "historico" ? (
          <li key={e.id} className="relative flex gap-3 pl-0">
            <span className="bg-background text-muted-foreground relative z-10 grid size-6 shrink-0 place-items-center rounded-full border">
              <History className="size-3" />
            </span>
            <div className="text-muted-foreground min-w-0 pt-0.5 text-xs">
              <span className="text-foreground/80">{e.texto}</span>
              {e.autor ? ` · ${e.autor}` : ""} · {formatDataHora(e.data)}
            </div>
          </li>
        ) : (
          <li key={e.id} className="relative flex gap-3">
            <span
              className={cn(
                "relative z-10 grid size-6 shrink-0 place-items-center rounded-full border",
                e.interno
                  ? "border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950"
                  : "bg-primary text-primary-foreground border-primary",
              )}
            >
              {e.interno ? <Lock className="size-3" /> : <MessageSquare className="size-3" />}
            </span>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-lg border p-3",
                e.interno ? "border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/30" : "bg-card",
              )}
            >
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                <span className="text-sm font-medium">{e.autor}</span>
                {e.papel ? <span className="text-muted-foreground">{e.papel}</span> : null}
                {e.interno ? (
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Nota interna (cliente não vê)
                  </span>
                ) : null}
                <span className="text-muted-foreground ml-auto">{formatDataHora(e.data)}</span>
              </div>
              <p className="text-sm break-words whitespace-pre-wrap">{e.mensagem}</p>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}
