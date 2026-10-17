import { cn } from "@/lib/utils";

/** Marca textual da Tonytec (a logo configurável entra na Fase 1). */
export function Brand({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-lg text-sm font-bold tracking-tight">
        TT
      </div>
      <div className="leading-tight">
        <div className="font-semibold tracking-tight">Tonytec OS</div>
        {subtitle ? <div className="text-xs opacity-70">{subtitle}</div> : null}
      </div>
    </div>
  );
}
