import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  titulo,
  valor,
  icon: Icon,
  detalhe,
}: {
  titulo: string;
  valor: string | number;
  icon: LucideIcon;
  detalhe?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{titulo}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{valor}</p>
          {detalhe ? <p className="text-muted-foreground mt-1 text-xs">{detalhe}</p> : null}
        </div>
        <div className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
