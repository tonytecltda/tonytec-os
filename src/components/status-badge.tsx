import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Tom = "verde" | "amarelo" | "laranja" | "vermelho" | "azul" | "violeta" | "cinza";

const TONS: Record<Tom, string> = {
  verde: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  amarelo: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  laranja: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  vermelho: "bg-red-500/12 text-red-700 dark:text-red-400",
  azul: "bg-primary/12 text-primary",
  violeta: "bg-violet-500/12 text-violet-700 dark:text-violet-400",
  cinza: "bg-muted text-muted-foreground",
};

/** Badge colorida por "tom" (sem depender só da cor: o texto sempre diz o estado). */
export function StatusBadge({
  tom,
  children,
  className,
}: {
  tom: Tom;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("font-medium", TONS[tom], className)}>
      {children}
    </Badge>
  );
}

export function AtivoBadge({ ativo }: { ativo: boolean }) {
  return <StatusBadge tom={ativo ? "verde" : "cinza"}>{ativo ? "Ativo" : "Inativo"}</StatusBadge>;
}
